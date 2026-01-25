/**
 * Landing V2 Routes Tests
 *
 * Integration tests for the landing generator API endpoints.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock auth middleware
jest.unstable_mockModule('../src/middleware/auth.middleware.js', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    next();
  }
}));

// Mock database
jest.unstable_mockModule('../src/db/connection.js', () => ({
  pool: {
    query: jest.fn()
  }
}));

// Mock orchestrator
const mockCreateSession = jest.fn();
const mockGetSession = jest.fn();
const mockGenerateLanding = jest.fn();

jest.unstable_mockModule('../src/services/landing/orchestrator.service.js', () => ({
  createSession: mockCreateSession,
  getSession: mockGetSession,
  generateLanding: mockGenerateLanding,
  deleteSession: jest.fn(),
  checkHealth: jest.fn(() => ({ activeSessions: 0 }))
}));

// Mock assembler
jest.unstable_mockModule('../src/services/landing/assembler.service.js', () => ({
  listLandings: jest.fn().mockResolvedValue([]),
  getLanding: jest.fn(),
  getLandingHtml: jest.fn(),
  getLandingZipStream: jest.fn(),
  deleteLanding: jest.fn()
}));

// Mock claude service
jest.unstable_mockModule('../src/services/claude.service.js', () => ({
  analyzeRequest: jest.fn(),
  checkHealth: jest.fn(() => ({ configured: true }))
}));

// Mock logger
jest.unstable_mockModule('../src/utils/logger.js', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Import after mocking
const landingRoutes = (await import('../src/routes/landing.v2.routes.js')).default;
const { pool } = await import('../src/db/connection.js');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/landing/v2', landingRoutes);

describe('Landing V2 Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/landing/v2/generate', () => {
    it('should start generation with valid prompt', async () => {
      const mockSession = {
        id: 'test-landing-id',
        userId: 1,
        state: 'idle'
      };

      mockCreateSession.mockReturnValue(mockSession);
      mockGenerateLanding.mockResolvedValue();

      const response = await request(app)
        .post('/api/landing/v2/generate')
        .send({
          prompt: 'Gates of Olympus wheel landing',
          prizes: ['€500', '€200'],
          language: 'en'
        });

      expect(response.status).toBe(202);
      expect(response.body.landingId).toBe('test-landing-id');
      expect(response.body.status).toBe('started');
      expect(mockCreateSession).toHaveBeenCalledWith(1);
    });

    it('should reject empty prompt', async () => {
      const response = await request(app)
        .post('/api/landing/v2/generate')
        .send({ prompt: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('5 characters');
    });

    it('should reject short prompt', async () => {
      const response = await request(app)
        .post('/api/landing/v2/generate')
        .send({ prompt: 'abc' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/landing/v2/status/:landingId', () => {
    it('should return session status', async () => {
      const mockSession = {
        id: 'test-id',
        userId: 1,
        state: 'generating_assets',
        progress: 45,
        analysis: { slotName: 'Test Slot' },
        palette: { primary: '#FF0000' },
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        getStateMessage: () => 'Generating assets...'
      };

      mockGetSession.mockReturnValue(mockSession);

      const response = await request(app)
        .get('/api/landing/v2/status/test-id');

      expect(response.status).toBe(200);
      expect(response.body.state).toBe('generating_assets');
      expect(response.body.progress).toBe(45);
    });

    it('should return 404 for unknown session', async () => {
      mockGetSession.mockReturnValue(null);

      const response = await request(app)
        .get('/api/landing/v2/status/unknown-id');

      expect(response.status).toBe(404);
    });

    it('should return 403 for other user session', async () => {
      const mockSession = {
        id: 'other-user-id',
        userId: 999, // Different user
        state: 'complete'
      };

      mockGetSession.mockReturnValue(mockSession);

      const response = await request(app)
        .get('/api/landing/v2/status/other-user-id');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/landing/v2/list', () => {
    it('should return user landings', async () => {
      pool.query.mockResolvedValue({
        rows: [
          { landing_id: 'land-1', type: 'wheel', slot_name: 'Test Slot' }
        ],
        rowCount: 1
      });

      const response = await request(app)
        .get('/api/landing/v2/list');

      expect(response.status).toBe(200);
      expect(response.body.landings).toHaveLength(1);
      expect(response.body.landings[0].type).toBe('wheel');
    });
  });

  describe('GET /api/landing/v2/mechanics', () => {
    it('should return all supported mechanics', async () => {
      const response = await request(app)
        .get('/api/landing/v2/mechanics');

      expect(response.status).toBe(200);
      expect(response.body.mechanics).toBeInstanceOf(Array);

      const ids = response.body.mechanics.map(m => m.id);
      expect(ids).toContain('wheel');
      expect(ids).toContain('boxes');
      expect(ids).toContain('crash');
      expect(ids).toContain('loader');
    });

    it('should include complexity for each mechanic', async () => {
      const response = await request(app)
        .get('/api/landing/v2/mechanics');

      for (const mechanic of response.body.mechanics) {
        expect(mechanic).toHaveProperty('id');
        expect(mechanic).toHaveProperty('name');
        expect(mechanic).toHaveProperty('description');
        expect(mechanic).toHaveProperty('complexity');
      }
    });
  });

  describe('GET /api/landing/v2/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/landing/v2/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body).toHaveProperty('orchestrator');
      expect(response.body).toHaveProperty('claude');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/landing/v2/analyze', () => {
    it('should analyze request', async () => {
      const { analyzeRequest } = await import('../src/services/claude.service.js');

      analyzeRequest.mockResolvedValue({
        slotName: 'Gates of Olympus',
        mechanicType: 'wheel',
        confidence: 90
      });

      const response = await request(app)
        .post('/api/landing/v2/analyze')
        .send({ prompt: 'Gates of Olympus wheel landing' });

      expect(response.status).toBe(200);
      expect(response.body.slotName).toBe('Gates of Olympus');
    });

    it('should reject empty prompt', async () => {
      const response = await request(app)
        .post('/api/landing/v2/analyze')
        .send({ prompt: '' });

      expect(response.status).toBe(400);
    });
  });
});
