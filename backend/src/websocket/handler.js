import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

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
    log.warn('WebSocket auth failed', { error: error.message });
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
    if (ws.chatId && connections.has(ws.chatId)) {
      connections.get(ws.chatId).delete(ws);
      if (connections.get(ws.chatId).size === 0) {
        connections.delete(ws.chatId);
      }
    }
    log.debug('WebSocket disconnected', { userId: ws.userId, chatId: ws.chatId });
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
function handleMessage(ws, data) {
  try {
    const message = JSON.parse(data.toString());

    switch (message.type) {
      case 'ping':
        sendToClient(ws, { type: 'pong' });
        break;

      case 'subscribe':
        // Подписка на чат
        if (message.chatId) {
          // Отписываемся от старого
          if (ws.chatId && connections.has(ws.chatId)) {
            connections.get(ws.chatId).delete(ws);
          }

          // Подписываемся на новый
          ws.chatId = parseInt(message.chatId);
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
        if (message.landingId) {
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

  const message = JSON.stringify({
    type: 'landing_update',
    landingId,
    ...data,
    timestamp: new Date().toISOString()
  });

  let sent = 0;

  wss.clients.forEach(ws => {
    if (ws.userId === userId && ws.readyState === ws.OPEN) {
      ws.send(message);
      sent++;
    }
  });

  // Also broadcast to landing-specific subscriptions
  broadcastToLanding(landingId, { type: 'landing_update', ...data });

  log.debug('Sent landing update', { userId, landingId, connections: sent });
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
