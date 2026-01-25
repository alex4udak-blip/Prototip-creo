/**
 * Tests for auth.routes.js
 * Basic route tests without full JWT flow (testing edge cases and validation)
 */
import { jest, describe, it, expect, beforeAll, beforeEach, test } from '@jest/globals';

// Create mocks before imports
const mockGetOne = jest.fn();
const mockQuery = jest.fn();

// Mock database
jest.unstable_mockModule('../src/db/client.js', () => ({
  db: {
    query: mockQuery,
    getOne: mockGetOne,
    getMany: jest.fn(),
    insert: jest.fn(),
    update: jest.fn()
  },
  pool: {
    connect: jest.fn(),
    on: jest.fn()
  },
  testConnection: jest.fn().mockResolvedValue(true)
}));

// Mock config
jest.unstable_mockModule('../src/config/env.js', () => ({
  config: {
    jwtSecret: 'test-secret-key-12345-very-long-secret',
    nodeEnv: 'test',
    port: 3000,
    frontendUrl: 'http://localhost:5173'
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

// Now import express and supertest
const express = (await import('express')).default;
const request = (await import('supertest')).default;

// Create minimal app for testing
const createTestApp = async () => {
  const { default: authRoutes } = await import('../src/routes/auth.routes.js');

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);

  return app;
};

describe('Auth Routes', () => {
  let app;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    mockQuery.mockClear();
    mockGetOne.mockClear();
  });

  describe('GET /api/auth/invite/:token - Validation', () => {
    test('should return 400 for short token', async () => {
      const response = await request(app)
        .get('/api/auth/invite/short');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Невалидный');
    });

    test('should return 404 for invalid token (user not found)', async () => {
      mockGetOne.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/auth/invite/12345678901234567890123456789012');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('недействительна');
    });

    test('should return 403 for inactive user', async () => {
      mockGetOne.mockResolvedValueOnce({
        id: 1,
        name: 'Test User',
        is_active: false,
        created_at: new Date()
      });

      const response = await request(app)
        .get('/api/auth/invite/12345678901234567890123456789012');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('деактивирован');
    });
  });

  describe('GET /api/auth/me - Authentication', () => {
    test('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    test('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    test('should return 401 for malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'NotBearer token');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/invites - Admin endpoint', () => {
    test('should return 503 when ADMIN_SECRET not configured', async () => {
      const originalEnv = process.env.ADMIN_SECRET;
      delete process.env.ADMIN_SECRET;

      const response = await request(app)
        .get('/api/auth/invites');

      expect(response.status).toBe(503);
      process.env.ADMIN_SECRET = originalEnv;
    });

    test('should return 403 for wrong secret', async () => {
      process.env.ADMIN_SECRET = 'test-admin-secret';

      const response = await request(app)
        .get('/api/auth/invites?secret=wrongsecret');

      expect(response.status).toBe(403);
    });

    test('should return invites for correct secret', async () => {
      process.env.ADMIN_SECRET = 'test-admin-secret';

      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'User 1', invite_token: 'token1' },
          { name: 'User 2', invite_token: 'token2' }
        ]
      });

      const response = await request(app)
        .get('/api/auth/invites?secret=test-admin-secret');

      expect(response.status).toBe(200);
      expect(response.body.invites).toBeDefined();
      expect(response.body.invites).toHaveLength(2);
      expect(response.body.invites[0].name).toBe('User 1');
    });

    test('should return empty array when no users', async () => {
      process.env.ADMIN_SECRET = 'test-admin-secret';
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/auth/invites?secret=test-admin-secret');

      expect(response.status).toBe(200);
      expect(response.body.invites).toEqual([]);
    });
  });

  describe('POST /api/auth/refresh - Authentication', () => {
    test('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh');

      expect(response.status).toBe(401);
    });

    test('should return 401 for invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });
});
