/**
 * Landing Orchestrator Tests
 *
 * Tests for the main landing generation pipeline.
 */

import { jest } from '@jest/globals';

// Mock all dependent services
jest.unstable_mockModule('../src/services/claude.service.js', () => ({
  analyzeRequest: jest.fn(),
  generateLandingCode: jest.fn()
}));

jest.unstable_mockModule('../src/services/serper.service.js', () => ({
  getSlotReferenceImage: jest.fn()
}));

jest.unstable_mockModule('../src/services/gemini.service.js', () => ({
  sendMessageStream: jest.fn()
}));

jest.unstable_mockModule('../src/services/runware.service.js', () => ({
  removeBackground: jest.fn()
}));

jest.unstable_mockModule('../src/services/landing/assembler.service.js', () => ({
  assembleLanding: jest.fn()
}));

jest.unstable_mockModule('../src/services/landing/palette.service.js', () => ({
  extractPalette: jest.fn()
}));

jest.unstable_mockModule('../src/websocket/handler.js', () => ({
  sendLandingUpdate: jest.fn()
}));

jest.unstable_mockModule('../src/config/env.js', () => ({
  config: {
    anthropicApiKey: 'test-key',
    serperApiKey: 'test-key',
    googleApiKey: 'test-key'
  }
}));

jest.unstable_mockModule('../src/utils/logger.js', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Import after mocking
const {
  STATES,
  MECHANICS,
  createSession,
  getSession,
  deleteSession,
  checkHealth
} = await import('../src/services/landing/orchestrator.service.js');

describe('Landing Orchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constants', () => {
    it('should define all states', () => {
      expect(STATES.IDLE).toBe('idle');
      expect(STATES.ANALYZING).toBe('analyzing');
      expect(STATES.GENERATING_ASSETS).toBe('generating_assets');
      expect(STATES.COMPLETE).toBe('complete');
      expect(STATES.ERROR).toBe('error');
    });

    it('should define all mechanics', () => {
      expect(MECHANICS.WHEEL).toBe('wheel');
      expect(MECHANICS.BOXES).toBe('boxes');
      expect(MECHANICS.CRASH).toBe('crash');
      expect(MECHANICS.BOARD).toBe('board');
      expect(MECHANICS.SCRATCH).toBe('scratch');
      expect(MECHANICS.LOADER).toBe('loader');
      expect(MECHANICS.SLOT).toBe('slot');
    });
  });

  describe('Session Management', () => {
    it('should create a new session', () => {
      const session = createSession(123);

      expect(session.id).toBeDefined();
      expect(session.userId).toBe(123);
      expect(session.state).toBe(STATES.IDLE);
      expect(session.progress).toBe(0);
    });

    it('should retrieve session by ID', () => {
      const session = createSession(456);
      const retrieved = getSession(session.id);

      expect(retrieved).toBe(session);
    });

    it('should return null for unknown session', () => {
      const result = getSession('unknown-id');
      expect(result).toBeNull();
    });

    it('should delete session', () => {
      const session = createSession(789);
      const id = session.id;

      deleteSession(id);

      expect(getSession(id)).toBeNull();
    });
  });

  describe('Session State Management', () => {
    it('should update state and progress', () => {
      const session = createSession(100);

      session.setState(STATES.ANALYZING, { progress: 10 });

      expect(session.state).toBe(STATES.ANALYZING);
      expect(session.progress).toBe(10);
    });

    it('should notify listeners on state change', () => {
      const session = createSession(101);
      const listener = jest.fn();

      session.addListener(listener);
      session.setState(STATES.GENERATING_ASSETS, { progress: 50, message: 'Test' });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          landingId: session.id,
          state: STATES.GENERATING_ASSETS,
          progress: 50,
          message: 'Test'
        })
      );
    });

    it('should allow removing listeners', () => {
      const session = createSession(102);
      const listener = jest.fn();

      const unsubscribe = session.addListener(listener);
      unsubscribe();

      session.setState(STATES.COMPLETE, { progress: 100 });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should get human-readable state messages', () => {
      const session = createSession(103);

      session.setState(STATES.ANALYZING);
      expect(session.getStateMessage()).toContain('Анализ');

      session.setState(STATES.GENERATING_ASSETS);
      expect(session.getStateMessage()).toContain('ассет');

      session.error = 'Test error';
      session.setState(STATES.ERROR);
      expect(session.getStateMessage()).toContain('Test error');
    });
  });

  describe('Health Check', () => {
    it('should return service status', () => {
      const health = checkHealth();

      expect(health).toHaveProperty('activeSessions');
      expect(health).toHaveProperty('claudeConfigured');
      expect(health).toHaveProperty('serperConfigured');
      expect(health).toHaveProperty('geminiConfigured');
    });
  });
});
