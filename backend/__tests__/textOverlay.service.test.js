/**
 * Tests for textOverlay.service.js
 * Тестирование извлечения текста и определения стиля
 */
import { jest, describe, it, expect, beforeAll } from '@jest/globals';

describe('TextOverlay Service', () => {
  let textOverlayService;

  beforeAll(async () => {
    process.env.GOOGLE_API_KEY = 'test-key';
    textOverlayService = await import('../src/services/textOverlay.service.js');
  });

  describe('Module exports', () => {
    it('should export extractTextFromPrompt function', () => {
      expect(typeof textOverlayService?.extractTextFromPrompt).toBe('function');
    });

    it('should export detectTextStyle function', () => {
      expect(typeof textOverlayService?.detectTextStyle).toBe('function');
    });

    it('should export overlayPngText function', () => {
      expect(typeof textOverlayService?.overlayPngText).toBe('function');
    });
  });

  describe('extractTextFromPrompt', () => {
    it('should extract text in double quotes', () => {
      const prompt = 'Создай баннер с текстом "БОНУС 500€"';
      const result = textOverlayService.extractTextFromPrompt(prompt);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('БОНУС 500€');
    });

    it('should extract text in Russian quotes «»', () => {
      const prompt = 'Баннер казино с надписью «ИГРАЙ СЕЙЧАС»';
      const result = textOverlayService.extractTextFromPrompt(prompt);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('ИГРАЙ СЕЙЧАС');
    });

    it('should extract multiple texts', () => {
      const prompt = 'Баннер "БОНУС 100%" с кнопкой "ПОЛУЧИТЬ"';
      const result = textOverlayService.extractTextFromPrompt(prompt);

      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should identify CTA type for action words', () => {
      const prompt = 'Кнопка "ИГРАТЬ СЕЙЧАС"';
      const result = textOverlayService.extractTextFromPrompt(prompt);

      expect(result[0].type).toBe('cta');
    });

    it('should identify headline type for bonus text', () => {
      const prompt = 'Заголовок "БОНУС 1500€"';
      const result = textOverlayService.extractTextFromPrompt(prompt);

      expect(result[0].type).toBe('headline');
    });

    it('should identify disclaimer type for 18+', () => {
      const prompt = 'Текст "18+ T&C apply"';
      const result = textOverlayService.extractTextFromPrompt(prompt);

      expect(result[0].type).toBe('disclaimer');
    });

    it('should return empty array for no quoted text', () => {
      const prompt = 'Просто баннер казино без текста';
      const result = textOverlayService.extractTextFromPrompt(prompt);

      expect(result).toHaveLength(0);
    });

    it('should deduplicate same texts', () => {
      const prompt = '"БОНУС" и ещё раз "БОНУС" и "бонус"';
      const result = textOverlayService.extractTextFromPrompt(prompt);

      expect(result).toHaveLength(1);
    });

    it('should ignore very long texts (>50 chars)', () => {
      const prompt = '"Это очень длинный текст который превышает пятьдесят символов и не должен быть извлечён"';
      const result = textOverlayService.extractTextFromPrompt(prompt);

      expect(result).toHaveLength(0);
    });
  });

  describe('detectTextStyle', () => {
    it('should return casino for default prompts', () => {
      const style = textOverlayService.detectTextStyle('Баннер слоты');
      expect(style).toBe('casino');
    });

    it('should return crypto for crypto keywords', () => {
      const style = textOverlayService.detectTextStyle('Bitcoin trading banner');
      expect(style).toBe('crypto');
    });

    it('should return crypto for Russian crypto keywords', () => {
      const style = textOverlayService.detectTextStyle('Крипто биржа баннер');
      expect(style).toBe('crypto');
    });

    it('should return betting for betting keywords', () => {
      const style = textOverlayService.detectTextStyle('Sports betting banner');
      expect(style).toBe('betting');
    });

    it('should return betting for Russian betting keywords', () => {
      const style = textOverlayService.detectTextStyle('Ставки на спорт');
      expect(style).toBe('betting');
    });

    it('should return bonus for bonus keywords', () => {
      const style = textOverlayService.detectTextStyle('Free bonus promotion');
      expect(style).toBe('bonus');
    });

    it('should return bonus for Russian bonus keywords', () => {
      const style = textOverlayService.detectTextStyle('Бесплатные фриспины');
      expect(style).toBe('bonus');
    });

    it('should be case insensitive', () => {
      const style1 = textOverlayService.detectTextStyle('BITCOIN');
      const style2 = textOverlayService.detectTextStyle('bitcoin');
      expect(style1).toBe(style2);
    });
  });
});
