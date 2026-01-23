/**
 * Tests for generate.routes.js
 */
import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

// Mock database
const mockQuery = jest.fn();
const mockGetOne = jest.fn();
const mockInsert = jest.fn();

jest.unstable_mockModule('../src/db/client.js', () => ({
  db: {
    query: mockQuery,
    getOne: mockGetOne,
    insert: mockInsert
  }
}));

// Mock config
jest.unstable_mockModule('../src/config/env.js', () => ({
  config: {
    jwtSecret: 'test-secret-key-12345',
    nodeEnv: 'test',
    port: 3000,
    frontendUrl: 'http://localhost:5173',
    storagePath: '/tmp/uploads',
    googleApiKey: 'test-api-key'
  }
}));

// Mock logger
jest.unstable_mockModule('../src/utils/logger.js', () => ({
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock auth middleware
jest.unstable_mockModule('../src/middleware/auth.middleware.js', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { id: 1, name: 'Test User' };
    next();
  },
  checkGenerationLimit: (req, res, next) => next(),
  incrementGenerationStats: jest.fn().mockResolvedValue()
}));

// Mock upload middleware
jest.unstable_mockModule('../src/middleware/upload.middleware.js', () => ({
  uploadMiddleware: {
    array: () => (req, res, next) => {
      req.files = [];
      next();
    },
    single: () => (req, res, next) => {
      req.file = null;
      next();
    }
  },
  handleUploadError: (req, res, next) => next(),
  getFileUrl: (filename) => `/uploads/${filename}`
}));

// Mock Gemini service
const mockSendMessageStream = jest.fn();
const mockDeleteChat = jest.fn();
const mockCheckHealth = jest.fn();

jest.unstable_mockModule('../src/services/gemini.service.js', () => ({
  sendMessageStream: mockSendMessageStream,
  deleteChat: mockDeleteChat,
  checkHealth: mockCheckHealth
}));

// Mock WebSocket handler
jest.unstable_mockModule('../src/websocket/handler.js', () => ({
  broadcastToChat: jest.fn()
}));

// Now import express and supertest
const express = (await import('express')).default;
const request = (await import('supertest')).default;

// Create minimal app for testing
const createTestApp = async () => {
  const { default: generateRoutes } = await import('../src/routes/generate.routes.js');

  const app = express();
  app.use(express.json());
  app.use('/api/generate', generateRoutes);

  return app;
};

describe('Generate Routes', () => {
  let app;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    mockQuery.mockClear();
    mockGetOne.mockClear();
    mockInsert.mockClear();
    mockSendMessageStream.mockClear();
    mockDeleteChat.mockClear();
    mockCheckHealth.mockClear();
  });

  describe('POST /api/generate', () => {
    it('should return 400 for empty prompt', async () => {
      const response = await request(app)
        .post('/api/generate')
        .send({ prompt: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Введите');
    });

    it('should return 400 for missing prompt', async () => {
      const response = await request(app)
        .post('/api/generate')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should create new chat if chat_id not provided', async () => {
      // Mock chat creation
      mockInsert.mockResolvedValueOnce({ id: 1, title: 'Test prompt' });
      // Mock message creation
      mockInsert.mockResolvedValueOnce({ id: 1 });

      mockSendMessageStream.mockResolvedValue({
        text: 'Response',
        images: [],
        finishReason: 'STOP'
      });

      const response = await request(app)
        .post('/api/generate')
        .send({ prompt: 'Test prompt' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.chatId).toBe(1);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should use existing chat if chat_id provided', async () => {
      // Mock chat lookup
      mockGetOne.mockResolvedValueOnce({ id: 5 });
      // Mock message creation
      mockInsert.mockResolvedValueOnce({ id: 10 });

      mockSendMessageStream.mockResolvedValue({
        text: 'Response',
        images: [],
        finishReason: 'STOP'
      });

      const response = await request(app)
        .post('/api/generate')
        .send({ prompt: 'Test prompt', chat_id: '5' });

      expect(response.status).toBe(200);
      expect(response.body.chatId).toBe(5);
    });

    it('should return 404 for non-existent chat', async () => {
      // Mock chat not found
      mockGetOne.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/generate')
        .send({ prompt: 'Test prompt', chat_id: '999' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('не найден');
    });
  });

  describe('POST /api/generate/upload', () => {
    it('should return 400 for missing file', async () => {
      const response = await request(app)
        .post('/api/generate/upload');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('не загружен');
    });
  });

  describe('DELETE /api/generate/chat/:id', () => {
    it('should delete chat and messages', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .delete('/api/generate/chat/123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockDeleteChat).toHaveBeenCalledWith(123);
      expect(mockQuery).toHaveBeenCalledTimes(2); // messages + chat
    });
  });

  describe('GET /api/generate/health', () => {
    it('should return health status', async () => {
      mockCheckHealth.mockResolvedValue({
        available: true,
        model: 'gemini-3-pro-image-preview',
        features: ['image-generation']
      });

      const response = await request(app)
        .get('/api/generate/health');

      expect(response.status).toBe(200);
      expect(response.body.available).toBe(true);
      expect(response.body.model).toBe('gemini-3-pro-image-preview');
    });

    it('should return 500 on health check error', async () => {
      mockCheckHealth.mockRejectedValue(new Error('API unavailable'));

      const response = await request(app)
        .get('/api/generate/health');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('API unavailable');
    });
  });
});
