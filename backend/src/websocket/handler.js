import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';
import { pool } from '../db/connection.js';
import * as orchestrator from '../services/landing/orchestrator.service.js';
import { checkWebSocketRateLimit } from '../middleware/rateLimit.middleware.js';

// Хранилище соединений по chatId
const connections = new Map(); // chatId -> Set<WebSocket>

// Хранилище соединений по landingId
const landingConnections = new Map(); // landingId -> Set<WebSocket>

// Глобальная ссылка на WSS
let wss = null;

/**
 * Инициализация WebSocket сервера
 */
export function initWebSocket(server) {
  wss = new WebSocketServer({
    server,
    path: '/ws'
  });

  wss.on('connection', handleConnection);

  log.info('WebSocket server initialized on /ws');

  // Периодическая очистка мёртвых соединений
  setInterval(cleanupConnections, 30000);

  return wss;
}

/**
 * Обработка нового соединения
 */
function handleConnection(ws, req) {
  // Rate limit check for WebSocket connections
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                   req.socket.remoteAddress ||
                   'unknown';

  if (checkWebSocketRateLimit(clientIp)) {
    log.warn('WebSocket connection rate limited', { ip: clientIp });
    ws.close(4029, 'Too Many Requests');
    return;
  }

  // Получаем параметры из URL
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const chatId = url.searchParams.get('chatId');

  // Проверяем токен
  let userId;
  try {
    if (!token) {
      throw new Error('Token required');
    }
    const decoded = jwt.verify(token, config.jwtSecret);
    userId = decoded.userId;
  } catch (error) {
    log.warn('WebSocket auth failed', { error: error.message, ip: clientIp });
    ws.close(4001, 'Unauthorized');
    return;
  }

  // Сохраняем метаданные
  ws.userId = userId;
  ws.chatId = chatId ? parseInt(chatId) : null;
  ws.isAlive = true;

  // Добавляем в connections
  if (ws.chatId) {
    if (!connections.has(ws.chatId)) {
      connections.set(ws.chatId, new Set());
    }
    connections.get(ws.chatId).add(ws);
  }

  log.debug('WebSocket connected', { userId, chatId: ws.chatId });

  // Обработчик сообщений
  ws.on('message', (data) => {
    handleMessage(ws, data);
  });

  // Обработчик pong (heartbeat)
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Обработчик закрытия
  ws.on('close', () => {
    // Cleanup chat connections
    if (ws.chatId && connections.has(ws.chatId)) {
      connections.get(ws.chatId).delete(ws);
      if (connections.get(ws.chatId).size === 0) {
        connections.delete(ws.chatId);
      }
    }
    // Cleanup landing connections
    if (ws.landingId && landingConnections.has(ws.landingId)) {
      landingConnections.get(ws.landingId).delete(ws);
      if (landingConnections.get(ws.landingId).size === 0) {
        landingConnections.delete(ws.landingId);
      }
    }
    log.debug('WebSocket disconnected', { userId: ws.userId, chatId: ws.chatId, landingId: ws.landingId });
  });

  // Обработчик ошибок
  ws.on('error', (error) => {
    log.error('WebSocket error', { error: error.message, userId: ws.userId });
  });

  // Отправляем подтверждение
  sendToClient(ws, {
    type: 'connected',
    userId,
    chatId: ws.chatId
  });
}

/**
 * Обработка входящих сообщений
 */
async function handleMessage(ws, data) {
  try {
    const message = JSON.parse(data.toString());

    switch (message.type) {
      case 'ping':
        sendToClient(ws, { type: 'pong' });
        break;

      case 'subscribe':
        // Подписка на чат
        if (message.chatId) {
          const requestedChatId = parseInt(message.chatId);

          // SECURITY: Verify chat ownership before subscribing
          try {
            const chatResult = await pool.query(
              'SELECT user_id FROM chats WHERE id = $1',
              [requestedChatId]
            );

            if (chatResult.rows.length === 0) {
              sendToClient(ws, {
                type: 'error',
                code: 'NOT_FOUND',
                message: 'Chat not found'
              });
              break;
            }

            if (chatResult.rows[0].user_id !== ws.userId) {
              log.warn('WebSocket subscribe denied - not chat owner', {
                requestingUserId: ws.userId,
                ownerUserId: chatResult.rows[0].user_id,
                chatId: requestedChatId
              });
              sendToClient(ws, {
                type: 'error',
                code: 'FORBIDDEN',
                message: 'You do not have access to this chat'
              });
              break;
            }
          } catch (dbError) {
            log.error('Failed to verify chat ownership', { error: dbError.message });
            sendToClient(ws, {
              type: 'error',
              code: 'INTERNAL_ERROR',
              message: 'Failed to verify chat access'
            });
            break;
          }

          // Отписываемся от старого
          if (ws.chatId && connections.has(ws.chatId)) {
            connections.get(ws.chatId).delete(ws);
          }

          // Подписываемся на новый
          ws.chatId = requestedChatId;
          if (!connections.has(ws.chatId)) {
            connections.set(ws.chatId, new Set());
          }
          connections.get(ws.chatId).add(ws);

          sendToClient(ws, {
            type: 'subscribed',
            chatId: ws.chatId
          });

          log.debug('WebSocket subscribed to chat', {
            userId: ws.userId,
            chatId: ws.chatId
          });
        }
        break;

      case 'unsubscribe':
        // Отписка от чата
        if (ws.chatId && connections.has(ws.chatId)) {
          connections.get(ws.chatId).delete(ws);
          if (connections.get(ws.chatId).size === 0) {
            connections.delete(ws.chatId);
          }
        }
        ws.chatId = null;
        sendToClient(ws, { type: 'unsubscribed' });
        break;

      case 'subscribe_landing':
        // Подписка на landing generation events
        // SECURITY: Verify ownership before allowing subscription
        if (message.landingId) {
          // Check if the user owns this landing session
          const session = orchestrator.getSession(message.landingId);
          if (session && session.userId !== ws.userId) {
            // SECURITY: Reject subscription to other user's landing
            log.warn('WebSocket subscribe_landing denied - not owner', {
              requestingUserId: ws.userId,
              ownerUserId: session.userId,
              landingId: message.landingId
            });
            sendToClient(ws, {
              type: 'error',
              code: 'FORBIDDEN',
              message: 'You do not have access to this landing'
            });
            break;
          }

          // Отписываемся от старого
          if (ws.landingId && landingConnections.has(ws.landingId)) {
            landingConnections.get(ws.landingId).delete(ws);
          }

          // Подписываемся на новый
          ws.landingId = message.landingId;
          if (!landingConnections.has(ws.landingId)) {
            landingConnections.set(ws.landingId, new Set());
          }
          landingConnections.get(ws.landingId).add(ws);

          sendToClient(ws, {
            type: 'subscribed_landing',
            landingId: ws.landingId
          });

          log.debug('WebSocket subscribed to landing', {
            userId: ws.userId,
            landingId: ws.landingId
          });
        }
        break;

      case 'unsubscribe_landing':
        // Отписка от landing
        if (ws.landingId && landingConnections.has(ws.landingId)) {
          landingConnections.get(ws.landingId).delete(ws);
          if (landingConnections.get(ws.landingId).size === 0) {
            landingConnections.delete(ws.landingId);
          }
        }
        ws.landingId = null;
        sendToClient(ws, { type: 'unsubscribed_landing' });
        break;

      default:
        log.debug('Unknown WebSocket message type', { type: message.type });
    }

  } catch (error) {
    log.error('WebSocket message parse error', { error: error.message });
  }
}

/**
 * Отправка сообщения одному клиенту
 */
function sendToClient(ws, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

/**
 * Отправка сообщения всем подписчикам чата
 */
export function broadcastToChat(chatId, data) {
  // Убедимся что chatId — число
  const numericChatId = typeof chatId === 'string' ? parseInt(chatId) : chatId;

  const chatConnections = connections.get(numericChatId);

  if (!chatConnections || chatConnections.size === 0) {
    log.warn('No WebSocket connections for chat', {
      chatId: numericChatId,
      type: data.type,
      availableChats: Array.from(connections.keys())
    });
    return;
  }

  const message = JSON.stringify(data);
  let sentCount = 0;

  for (const ws of chatConnections) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
      sentCount++;
    }
  }

  log.info('Broadcast to chat', {
    chatId: numericChatId,
    type: data.type,
    recipients: sentCount
  });
}

/**
 * Отправка сообщения конкретному пользователю (во все его соединения)
 */
export function sendToUser(userId, data) {
  if (!wss) return;

  const message = JSON.stringify(data);
  let sent = 0;

  wss.clients.forEach(ws => {
    if (ws.userId === userId && ws.readyState === ws.OPEN) {
      ws.send(message);
      sent++;
    }
  });

  log.debug('Sent to user', { userId, type: data.type, connections: sent });
}

/**
 * Очистка мёртвых соединений
 */
function cleanupConnections() {
  if (!wss) return;

  wss.clients.forEach(ws => {
    if (!ws.isAlive) {
      log.debug('Terminating dead WebSocket', { userId: ws.userId });
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}

/**
 * Отправка сообщения подписчикам landing generation
 */
export function broadcastToLanding(landingId, data) {
  const landingConns = landingConnections.get(landingId);

  if (!landingConns || landingConns.size === 0) {
    log.debug('No WebSocket connections for landing', { landingId });
    return;
  }

  const message = JSON.stringify({
    ...data,
    landingId,
    timestamp: new Date().toISOString()
  });

  let sentCount = 0;

  for (const ws of landingConns) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
      sentCount++;
    }
  }

  log.debug('Broadcast to landing', {
    landingId,
    type: data.type,
    recipients: sentCount
  });
}

/**
 * Отправка landing update пользователю
 * Отправляет во все соединения пользователя
 */
export function sendLandingUpdate(userId, landingId, data) {
  if (!wss) return;

  // Ensure userId is compared correctly (may be string or number)
  const numericUserId = Number(userId);

  const message = JSON.stringify({
    type: 'landing_update',
    landingId,
    ...data,
    timestamp: new Date().toISOString()
  });

  let sent = 0;

  wss.clients.forEach(ws => {
    // Compare as numbers to avoid type mismatch
    if (Number(ws.userId) === numericUserId && ws.readyState === ws.OPEN) {
      ws.send(message);
      sent++;
    }
  });

  // Also broadcast to landing-specific subscriptions
  broadcastToLanding(landingId, { type: 'landing_update', ...data });

  log.debug('Sent landing update', { userId, landingId, connections: sent });
}

/**
 * Send HTML chunk for real-time preview (like Deepseek Artifacts)
 * Streams partial HTML to the frontend for live preview
 * Only sends to the owner user to prevent data leakage
 */
export function sendHtmlChunk(userId, landingId, chunk, isComplete = false) {
  if (!wss) return;

  // Validate inputs
  if (!userId || !landingId) {
    log.warn('sendHtmlChunk called with invalid params', { userId, landingId });
    return;
  }

  // Ensure userId is compared correctly (may be string or number)
  const numericUserId = Number(userId);

  const message = JSON.stringify({
    type: 'html_chunk',
    landingId,
    chunk,
    isComplete,
    timestamp: new Date().toISOString()
  });

  let sent = 0;
  const sentWsSet = new Set(); // Track sent connections to avoid duplicates

  // Send to user's connections
  wss.clients.forEach(ws => {
    // Compare as numbers to avoid type mismatch
    if (Number(ws.userId) === numericUserId && ws.readyState === ws.OPEN && !sentWsSet.has(ws)) {
      try {
        ws.send(message);
        sentWsSet.add(ws);
        sent++;
      } catch (error) {
        log.warn('Failed to send HTML chunk', { error: error.message, userId });
      }
    }
  });

  // Also broadcast to landing-specific subscriptions (only for same user - security)
  const landingConns = landingConnections.get(landingId);
  if (landingConns) {
    for (const ws of landingConns) {
      // Security: Only send to the owner user (compare as numbers)
      if (ws.readyState === ws.OPEN && Number(ws.userId) === numericUserId && !sentWsSet.has(ws)) {
        try {
          ws.send(message);
          sentWsSet.add(ws);
          sent++;
        } catch (error) {
          log.warn('Failed to send HTML chunk to landing subscriber', { error: error.message });
        }
      }
    }
  }

  if (sent > 0 && !isComplete) {
    log.debug('HTML chunk sent', { landingId, chunkLength: chunk?.length || 0, recipients: sent });
  }
}

/**
 * Получить статистику соединений
 */
export function getConnectionStats() {
  return {
    totalConnections: wss ? wss.clients.size : 0,
    activeChats: connections.size,
    activeLandings: landingConnections.size,
    connectionsByChat: Object.fromEntries(
      Array.from(connections.entries()).map(([chatId, set]) => [chatId, set.size])
    ),
    connectionsByLanding: Object.fromEntries(
      Array.from(landingConnections.entries()).map(([landingId, set]) => [landingId, set.size])
    )
  };
}
