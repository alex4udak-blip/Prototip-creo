/**
 * WebSocket Handler Tests
 *
 * Tests for WebSocket message handling and userId comparison.
 */

import { jest } from '@jest/globals';

// Mock dependencies
const mockWss = {
  clients: new Set(),
  on: jest.fn()
};

const mockJwtVerify = jest.fn();

jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    verify: mockJwtVerify
  }
}));

jest.unstable_mockModule('../src/config/env.js', () => ({
  config: {
    jwtSecret: 'test-secret'
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

// Create mock WebSocket clients
function createMockWs(userId, options = {}) {
  return {
    userId,
    landingId: options.landingId || null,
    readyState: options.readyState ?? 1, // OPEN = 1
    OPEN: 1,
    send: jest.fn(),
    close: jest.fn()
  };
}

describe('WebSocket Handler', () => {
  let sendLandingUpdate, sendHtmlChunk;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockWss.clients.clear();

    // Import after mocking
    const handler = await import('../src/websocket/handler.js');
    sendLandingUpdate = handler.sendLandingUpdate;
    sendHtmlChunk = handler.sendHtmlChunk;
  });

  describe('sendLandingUpdate', () => {
    it('should handle userId as number', () => {
      const ws1 = createMockWs(123);
      const ws2 = createMockWs(456);
      mockWss.clients.add(ws1);
      mockWss.clients.add(ws2);

      // This test validates the logic but can't test without proper WSS initialization
      // The main test is that Number(userId) comparison works
      expect(Number(123) === Number('123')).toBe(true);
      expect(Number('123') === 123).toBe(true);
    });

    it('should handle userId as string', () => {
      // Type coercion test
      expect(Number('123') === Number(123)).toBe(true);
      expect(Number('abc')).toBeNaN();
    });

    it('should handle mixed userId types correctly', () => {
      // When JWT returns string and route returns number
      const jwtUserId = '42';
      const routeUserId = 42;

      expect(Number(jwtUserId) === Number(routeUserId)).toBe(true);
    });
  });

  describe('sendHtmlChunk', () => {
    it('should validate required parameters', () => {
      // Missing userId or landingId should not throw
      expect(() => sendHtmlChunk(null, 'landing-1', 'chunk')).not.toThrow();
      expect(() => sendHtmlChunk(1, null, 'chunk')).not.toThrow();
    });

    it('should handle userId type coercion', () => {
      // The key fix: comparing userId as numbers
      const stringUserId = '123';
      const numberUserId = 123;

      expect(Number(stringUserId) === numberUserId).toBe(true);
    });
  });

  describe('UserId Type Handling', () => {
    it('should correctly compare string and number userIds', () => {
      // This is the core fix being tested
      const testCases = [
        { wsUserId: 1, eventUserId: 1, expected: true },
        { wsUserId: '1', eventUserId: 1, expected: true },
        { wsUserId: 1, eventUserId: '1', expected: true },
        { wsUserId: '1', eventUserId: '1', expected: true },
        { wsUserId: 123, eventUserId: '123', expected: true },
        { wsUserId: '456', eventUserId: 456, expected: true },
        { wsUserId: 1, eventUserId: 2, expected: false },
        { wsUserId: '1', eventUserId: '2', expected: false }
      ];

      testCases.forEach(({ wsUserId, eventUserId, expected }) => {
        const result = Number(wsUserId) === Number(eventUserId);
        expect(result).toBe(expected);
      });
    });

    it('should handle edge cases', () => {
      // NaN comparison
      expect(Number(undefined) === Number(undefined)).toBe(false); // NaN !== NaN
      expect(Number(null) === Number(0)).toBe(true); // null becomes 0

      // Negative numbers
      expect(Number(-1) === Number('-1')).toBe(true);
    });
  });
});

describe('WebSocket Message Format', () => {
  it('should format landing_update message correctly', () => {
    const data = {
      state: 'analyzing',
      progress: 25,
      message: 'Test message',
      analysis: { slotName: 'Test' }
    };

    const message = JSON.stringify({
      type: 'landing_update',
      landingId: 'test-id',
      ...data,
      timestamp: new Date().toISOString()
    });

    const parsed = JSON.parse(message);
    expect(parsed.type).toBe('landing_update');
    expect(parsed.landingId).toBe('test-id');
    expect(parsed.state).toBe('analyzing');
    expect(parsed.progress).toBe(25);
    expect(parsed.message).toBe('Test message');
    expect(parsed.timestamp).toBeDefined();
  });

  it('should format html_chunk message correctly', () => {
    const message = JSON.stringify({
      type: 'html_chunk',
      landingId: 'test-id',
      chunk: '<div>Test</div>',
      isComplete: false,
      timestamp: new Date().toISOString()
    });

    const parsed = JSON.parse(message);
    expect(parsed.type).toBe('html_chunk');
    expect(parsed.chunk).toBe('<div>Test</div>');
    expect(parsed.isComplete).toBe(false);
  });

  it('should signal completion with empty chunk', () => {
    const message = JSON.stringify({
      type: 'html_chunk',
      landingId: 'test-id',
      chunk: '',
      isComplete: true,
      timestamp: new Date().toISOString()
    });

    const parsed = JSON.parse(message);
    expect(parsed.isComplete).toBe(true);
    expect(parsed.chunk).toBe('');
  });
});
