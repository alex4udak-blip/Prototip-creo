/**
 * Tests for runware.service.js — Runware Fallback для 18+ контента
 */
import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Runware Service', () => {
  let runwareService;
  let originalRunwareKey;

  beforeAll(async () => {
    // Save original env
    originalRunwareKey = process.env.RUNWARE_API_KEY;
    process.env.RUNWARE_API_KEY = 'test-runware-key';
    process.env.GOOGLE_API_KEY = 'test-google-key';

    try {
      runwareService = await import('../src/services/runware.service.js');
    } catch (e) {
      // Module may fail without actual API keys
    }
  });

  afterAll(() => {
    process.env.RUNWARE_API_KEY = originalRunwareKey;
  });

  describe('Module exports', () => {
    it('should export generateWithRunware function', () => {
      expect(typeof runwareService?.generateWithRunware).toBe('function');
    });

    it('should export checkRunwareHealth function', () => {
      expect(typeof runwareService?.checkRunwareHealth).toBe('function');
    });
  });

  describe('checkRunwareHealth', () => {
    it('should be a callable async function', () => {
      // Не вызываем реально - это пытается подключиться к API
      expect(typeof runwareService?.checkRunwareHealth).toBe('function');
    });

    it('should return a Promise when called', () => {
      // Проверяем что возвращает Promise, но не ждём его
      const result = runwareService?.checkRunwareHealth();
      expect(result).toBeInstanceOf(Promise);
      // Отменяем Promise чтобы не ждать таймаут
      result?.catch?.(() => {}); // Ignore rejection
    });
  });

  describe('generateWithRunware parameters', () => {
    it('should accept prompt and options', () => {
      expect(runwareService?.generateWithRunware.length).toBeGreaterThanOrEqual(1);
    });
  });
});
