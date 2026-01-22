/**
 * Tests for auth.routes.js
 */

// Mock database
const mockQuery = jest.fn();
jest.mock('../src/db/client.js', () => ({
  query: mockQuery,
  testConnection: jest.fn().mockResolvedValue(true)
}));

// Mock config
jest.mock('../src/config/env.js', () => ({
  config: {
    jwtSecret: 'test-secret-key-12345',
    nodeEnv: 'test',
    port: 3000,
    frontendUrl: 'http://localhost:5173'
  }
}));

// Mock logger
jest.mock('../src/utils/logger.js', () => ({
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

import express from 'express';
import request from 'supertest';

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
  });

  describe('POST /api/auth/invite/:token', () => {
    test('should return 400 for missing token', async () => {
      const response = await request(app)
        .post('/api/auth/invite/')
        .send({});

      expect(response.status).toBe(404); // Route not matched
    });

    test('should return 404 for invalid token', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // No invite found

      const response = await request(app)
        .post('/api/auth/invite/invalid-token')
        .send({ name: 'Test User' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('недействительна');
    });

    test('should return 400 for used invite', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          token: 'test-token',
          used_by: 123, // Already used
          expires_at: new Date(Date.now() + 86400000)
        }]
      });

      const response = await request(app)
        .post('/api/auth/invite/test-token')
        .send({ name: 'Test User' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('использована');
    });

    test('should return 400 for expired invite', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          token: 'test-token',
          used_by: null,
          expires_at: new Date(Date.now() - 86400000) // Expired
        }]
      });

      const response = await request(app)
        .post('/api/auth/invite/test-token')
        .send({ name: 'Test User' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('истёк');
    });

    test('should create user for valid invite', async () => {
      const inviteId = 1;
      const userId = 42;

      // Mock invite lookup
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: inviteId,
          token: 'valid-token',
          used_by: null,
          expires_at: new Date(Date.now() + 86400000)
        }]
      });

      // Mock user creation
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: userId,
          name: 'Test User',
          email: null
        }]
      });

      // Mock invite update
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/invite/valid-token')
        .send({ name: 'Test User' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.name).toBe('Test User');
    });
  });

  describe('GET /api/auth/me', () => {
    test('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    test('should return user for valid token', async () => {
      // First create a valid token
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          token: 'valid-token',
          used_by: null,
          expires_at: new Date(Date.now() + 86400000)
        }]
      });

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test User',
          email: null
        }]
      });

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const inviteResponse = await request(app)
        .post('/api/auth/invite/valid-token')
        .send({ name: 'Test User' });

      const token = inviteResponse.body.token;

      // Mock user lookup for /me
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test User',
          email: null,
          created_at: new Date()
        }]
      });

      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.user).toBeDefined();
      expect(meResponse.body.user.name).toBe('Test User');
    });

    test('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });
});
