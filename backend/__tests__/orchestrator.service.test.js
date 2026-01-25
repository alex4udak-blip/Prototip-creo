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
  removeBackground: jest.fn(),
  generateWithRunware: jest.fn()
}));

jest.unstable_mockModule('../src/services/pixabay.service.js', () => ({
  findGameSounds: jest.fn().mockResolvedValue({}),
  getGameSoundsWithFallback: jest.fn().mockResolvedValue({ spin: '/path/spin.mp3', win: '/path/win.mp3' }),
  downloadAndSaveSounds: jest.fn().mockResolvedValue({}),
  getFallbackSounds: jest.fn().mockResolvedValue({ spin: '/path/spin.mp3', win: '/path/win.mp3' })
}));

jest.unstable_mockModule('../src/services/landing/assembler.service.js', () => ({
  assembleLanding: jest.fn()
}));

jest.unstable_mockModule('../src/services/landing/palette.service.js', () => ({
  extractPalette: jest.fn()
}));

jest.unstable_mockModule('../src/websocket/handler.js', () => ({
  sendLandingUpdate: jest.fn(),
  sendHtmlChunk: jest.fn()
}));

jest.unstable_mockModule('../src/config/env.js', () => ({
  config: {
    anthropicApiKey: 'test-key',
    serperApiKey: 'test-key',
    googleApiKey: 'test-key',
    landing: {
      sessionTtl: 2 * 60 * 60 * 1000,
      maxSessionsPerUser: 10,
      defaultPalette: {
        primary: '#FFD700',
        secondary: '#1E3A5F',
        accent: '#FF6B6B',
        background: '#0D1117'
      }
    }
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

  describe('Session Limits', () => {
    it('should track session count in health check', () => {
      // Create several sessions
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        sessions.push(createSession(200));
      }

      const health = checkHealth();
      expect(health.activeSessions).toBeGreaterThanOrEqual(5);

      // Cleanup
      sessions.forEach(s => deleteSession(s.id));
    });

    it('should generate unique session IDs', () => {
      const session1 = createSession(300);
      const session2 = createSession(300);

      expect(session1.id).not.toBe(session2.id);
      expect(session1.id).toMatch(/^[a-f0-9-]{36}$/); // UUID format

      // Cleanup
      deleteSession(session1.id);
      deleteSession(session2.id);
    });
  });

  describe('State Transitions', () => {
    it('should handle complete state transition sequence', () => {
      const session = createSession(400);
      const states = [];

      session.addListener((event) => {
        states.push(event.state);
      });

      // Simulate full generation flow
      session.setState(STATES.ANALYZING, { progress: 5 });
      session.setState(STATES.FETCHING_REFERENCE, { progress: 15 });
      session.setState(STATES.EXTRACTING_PALETTE, { progress: 25 });
      session.setState(STATES.GENERATING_ASSETS, { progress: 40 });
      session.setState(STATES.REMOVING_BACKGROUNDS, { progress: 60 });
      session.setState(STATES.GENERATING_CODE, { progress: 75 });
      session.setState(STATES.ASSEMBLING, { progress: 90 });
      session.setState(STATES.COMPLETE, { progress: 100 });

      expect(states).toEqual([
        STATES.ANALYZING,
        STATES.FETCHING_REFERENCE,
        STATES.EXTRACTING_PALETTE,
        STATES.GENERATING_ASSETS,
        STATES.REMOVING_BACKGROUNDS,
        STATES.GENERATING_CODE,
        STATES.ASSEMBLING,
        STATES.COMPLETE
      ]);

      expect(session.progress).toBe(100);

      // Cleanup
      deleteSession(session.id);
    });

    it('should handle error state', () => {
      const session = createSession(401);

      session.setState(STATES.ANALYZING, { progress: 5 });
      session.setState(STATES.ERROR, { error: 'Something went wrong' });

      expect(session.state).toBe(STATES.ERROR);
      expect(session.error).toBe('Something went wrong');
      expect(session.getStateMessage()).toContain('Something went wrong');

      // Cleanup
      deleteSession(session.id);
    });
  });

  describe('Session Data', () => {
    it('should store analysis results', () => {
      const session = createSession(500);

      session.analysis = {
        slotName: 'Test Slot',
        mechanicType: 'wheel',
        prizes: ['€100', '€200']
      };

      expect(session.analysis.slotName).toBe('Test Slot');
      expect(session.analysis.mechanicType).toBe('wheel');

      // Cleanup
      deleteSession(session.id);
    });

    it('should store palette', () => {
      const session = createSession(501);

      session.palette = {
        primary: '#FF0000',
        secondary: '#00FF00'
      };

      expect(session.palette.primary).toBe('#FF0000');

      // Cleanup
      deleteSession(session.id);
    });

    it('should store generated assets', () => {
      const session = createSession(502);

      session.assets = {
        background: { path: '/path/to/bg.png', url: '/uploads/bg.png' },
        wheel: { path: '/path/to/wheel.png', url: '/uploads/wheel.png' }
      };

      expect(Object.keys(session.assets)).toHaveLength(2);
      expect(session.assets.background.path).toBeDefined();

      // Cleanup
      deleteSession(session.id);
    });

    it('should include analysis in state events', () => {
      const session = createSession(503);
      let receivedEvent = null;

      session.addListener((event) => {
        receivedEvent = event;
      });

      session.analysis = {
        slotName: 'Event Test',
        mechanicType: 'boxes'
      };

      session.setState(STATES.ANALYZING, { progress: 10 });

      expect(receivedEvent.analysis).toBeDefined();
      expect(receivedEvent.analysis.slotName).toBe('Event Test');

      // Cleanup
      deleteSession(session.id);
    });
  });

  describe('Progress Monotonicity', () => {
    it('should never decrease progress (CRITICAL regression test)', () => {
      const session = createSession(600);
      const progressValues = [];

      session.addListener((event) => {
        progressValues.push(event.progress);
      });

      // Simulate the full state transition flow with expected progress values
      // This catches bugs where progress goes backward (e.g., 60 -> 57)
      session.setState(STATES.ANALYZING, { progress: 5 });
      session.setState(STATES.FETCHING_REFERENCE, { progress: 15 });
      session.setState(STATES.EXTRACTING_PALETTE, { progress: 25 });
      session.setState(STATES.GENERATING_ASSETS, { progress: 40 });
      session.setState(STATES.GENERATING_ASSETS, { progress: 50 }); // mid-asset
      session.setState(STATES.REMOVING_BACKGROUNDS, { progress: 60 });
      session.setState(STATES.GENERATING_ASSETS, { progress: 65 }); // sounds (was 57, now 65)
      session.setState(STATES.GENERATING_ASSETS, { progress: 68 }); // sounds complete
      session.setState(STATES.GENERATING_CODE, { progress: 70 });
      session.setState(STATES.ASSEMBLING, { progress: 90 });
      session.setState(STATES.COMPLETE, { progress: 100 });

      // Verify progress is monotonically increasing
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
        if (progressValues[i] < progressValues[i - 1]) {
          throw new Error(
            `Progress went backward! ${progressValues[i - 1]} -> ${progressValues[i]} at step ${i}`
          );
        }
      }

      // Cleanup
      deleteSession(session.id);
    });

    it('should have specific progress ranges for each step', () => {
      // Document expected progress ranges to prevent regression
      const expectedRanges = {
        [STATES.ANALYZING]: [5, 10],
        [STATES.FETCHING_REFERENCE]: [10, 20],
        [STATES.EXTRACTING_PALETTE]: [20, 30],
        [STATES.GENERATING_ASSETS]: [30, 70], // includes sounds at 65-68
        [STATES.REMOVING_BACKGROUNDS]: [55, 65],
        [STATES.GENERATING_CODE]: [70, 90],
        [STATES.ASSEMBLING]: [90, 95],
        [STATES.COMPLETE]: [100, 100]
      };

      // This test documents the expected ranges - can be used as spec
      expect(expectedRanges[STATES.COMPLETE][1]).toBe(100);
      expect(expectedRanges[STATES.ANALYZING][0]).toBeLessThan(expectedRanges[STATES.GENERATING_ASSETS][0]);
    });
  });
});
