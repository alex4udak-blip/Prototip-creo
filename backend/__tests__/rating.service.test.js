/**
 * Rating Service Tests
 *
 * Tests for RLHF-style learning system: rating submission,
 * example retrieval, feedback recording, and statistics.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Create mock functions before imports
const mockQuery = jest.fn();

// Mock database
jest.unstable_mockModule('../src/db/connection.js', () => ({
  db: { query: mockQuery }
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

// Import service after mocking
const ratingService = await import('../src/services/rating.service.js');

describe('Rating Service', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('rateLanding', () => {
    it('should submit a rating successfully', async () => {
      const mockRating = {
        id: 1,
        landing_id: 100,
        user_id: 1,
        score: 5,
        feedback_text: 'Great landing!',
        design_score: 5,
        code_quality_score: 4,
        animation_score: 5,
        relevance_score: 4,
        positive_aspects: '["fast", "responsive"]',
        negative_aspects: '[]',
        created_at: new Date()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockRating] }) // INSERT rating
        .mockResolvedValueOnce({ rows: [{ avg_score: '4.50', count: '3' }] }); // SELECT AVG

      const result = await ratingService.rateLanding({
        landingId: 100,
        userId: 1,
        score: 5,
        feedbackText: 'Great landing!',
        designScore: 5,
        codeQualityScore: 4,
        animationScore: 5,
        relevanceScore: 4,
        positiveAspects: ['fast', 'responsive'],
        negativeAspects: []
      });

      expect(result.rating.score).toBe(5);
      expect(result.landingStats.avgScore).toBe(4.5);
      expect(result.landingStats.ratingCount).toBe(3);
      expect(result.landingStats.isPromoted).toBe(true);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should handle upsert behavior (update existing rating)', async () => {
      const updatedRating = {
        id: 1,
        landing_id: 100,
        user_id: 1,
        score: 4,
        updated_at: new Date()
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [updatedRating] })
        .mockResolvedValueOnce({ rows: [{ avg_score: '4.00', count: '1' }] });

      const result = await ratingService.rateLanding({
        landingId: 100,
        userId: 1,
        score: 4
      });

      expect(result.rating.score).toBe(4);
      // Verify ON CONFLICT query was used (SQL contains UPSERT logic)
      expect(mockQuery.mock.calls[0][0]).toContain('ON CONFLICT');
    });

    it('should return isPromoted=false when avg < 4.5', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, score: 3 }] })
        .mockResolvedValueOnce({ rows: [{ avg_score: '3.50', count: '2' }] });

      const result = await ratingService.rateLanding({
        landingId: 100,
        userId: 1,
        score: 3
      });

      expect(result.landingStats.isPromoted).toBe(false);
    });

    it('should return isPromoted=false when count < 3', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, score: 5 }] })
        .mockResolvedValueOnce({ rows: [{ avg_score: '5.00', count: '2' }] });

      const result = await ratingService.rateLanding({
        landingId: 100,
        userId: 1,
        score: 5
      });

      expect(result.landingStats.isPromoted).toBe(false);
    });

    it('should handle rating without optional fields', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, score: 4 }] })
        .mockResolvedValueOnce({ rows: [{ avg_score: '4.00', count: '1' }] });

      const result = await ratingService.rateLanding({
        landingId: 100,
        userId: 1,
        score: 4
      });

      expect(result.rating.score).toBe(4);
      // Verify null values passed for optional params
      const callArgs = mockQuery.mock.calls[0][1];
      expect(callArgs[3]).toBeNull(); // feedbackText
      expect(callArgs[4]).toBeNull(); // designScore
    });

    it('should throw error on database failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(
        ratingService.rateLanding({
          landingId: 100,
          userId: 1,
          score: 5
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('should serialize positiveAspects and negativeAspects as JSON', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, score: 5 }] })
        .mockResolvedValueOnce({ rows: [{ avg_score: '5.00', count: '1' }] });

      await ratingService.rateLanding({
        landingId: 100,
        userId: 1,
        score: 5,
        positiveAspects: ['good design', 'fast loading'],
        negativeAspects: ['needs more animations']
      });

      const callArgs = mockQuery.mock.calls[0][1];
      expect(callArgs[8]).toBe('["good design","fast loading"]');
      expect(callArgs[9]).toBe('["needs more animations"]');
    });
  });

  describe('getLandingRatings', () => {
    it('should fetch all ratings for a landing', async () => {
      const mockRatings = [
        { id: 1, landing_id: 100, user_id: 1, score: 5, user_email: 'user1@test.com' },
        { id: 2, landing_id: 100, user_id: 2, score: 4, user_email: 'user2@test.com' }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockRatings });

      const result = await ratingService.getLandingRatings(100);

      expect(result).toHaveLength(2);
      expect(result[0].score).toBe(5);
      expect(result[0].user_email).toBe('user1@test.com');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no ratings exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await ratingService.getLandingRatings(999);

      expect(result).toEqual([]);
    });

    it('should order ratings by created_at DESC', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await ratingService.getLandingRatings(100);

      expect(mockQuery.mock.calls[0][0]).toContain('ORDER BY lr.created_at DESC');
    });

    it('should join with users table for email', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await ratingService.getLandingRatings(100);

      expect(mockQuery.mock.calls[0][0]).toContain('LEFT JOIN users u');
      expect(mockQuery.mock.calls[0][0]).toContain('u.email as user_email');
    });
  });

  describe('getLandingAvgRating', () => {
    it('should calculate average scores correctly', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          avg_score: '4.25',
          avg_design: '4.50',
          avg_code_quality: '4.00',
          avg_animation: '4.25',
          avg_relevance: '4.50',
          rating_count: '4'
        }]
      });

      const result = await ratingService.getLandingAvgRating(100);

      expect(result.avg_score).toBe('4.25');
      expect(result.avg_design).toBe('4.50');
      expect(result.rating_count).toBe('4');
    });

    it('should return null averages when no ratings exist', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          avg_score: null,
          avg_design: null,
          avg_code_quality: null,
          avg_animation: null,
          avg_relevance: null,
          rating_count: '0'
        }]
      });

      const result = await ratingService.getLandingAvgRating(999);

      expect(result.avg_score).toBeNull();
      expect(result.rating_count).toBe('0');
    });

    it('should query with correct landing_id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{}] });

      await ratingService.getLandingAvgRating(123);

      expect(mockQuery.mock.calls[0][1]).toEqual([123]);
    });
  });

  describe('getBestExamplesForMechanic', () => {
    it('should return examples from DB function', async () => {
      const mockExamples = [
        { id: 1, name: 'Example 1', html_code: '<div>1</div>', avg_rating: 4.8 },
        { id: 2, name: 'Example 2', html_code: '<div>2</div>', avg_rating: 4.6 }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockExamples });

      const result = await ratingService.getBestExamplesForMechanic('wheel', 3);

      expect(result).toHaveLength(2);
      expect(result[0].avg_rating).toBe(4.8);
      expect(mockQuery.mock.calls[0][0]).toContain('get_best_examples');
    });

    it('should use fallback query when DB function returns empty', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // get_best_examples returns empty
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Fallback Example' }] }); // Fallback query

      const result = await ratingService.getBestExamplesForMechanic('wheel', 3);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Fallback Example');
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should return empty array on error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      const result = await ratingService.getBestExamplesForMechanic('wheel');

      expect(result).toEqual([]);
    });

    it('should use default limit of 3', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

      await ratingService.getBestExamplesForMechanic('wheel');

      expect(mockQuery.mock.calls[0][1]).toEqual(['wheel', 3]);
    });

    it('should respect custom limit', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

      await ratingService.getBestExamplesForMechanic('wheel', 5);

      expect(mockQuery.mock.calls[0][1]).toEqual(['wheel', 5]);
    });

    it('should order fallback by avg_rating DESC, is_curated DESC', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await ratingService.getBestExamplesForMechanic('wheel');

      expect(mockQuery.mock.calls[1][0]).toContain('ORDER BY avg_rating DESC, is_curated DESC');
    });
  });

  describe('recordGenerationFeedback', () => {
    it('should record feedback successfully', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 42 }] });

      const result = await ratingService.recordGenerationFeedback({
        landingId: 100,
        originalPrompt: 'Create a wheel game',
        mechanicType: 'wheel',
        slotName: 'Fortune Wheel',
        language: 'en',
        examplesUsed: [1, 2, 3],
        promptTokens: 500,
        completionTokens: 1000
      });

      expect(result).toBe(42);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should serialize examplesUsed as JSON', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await ratingService.recordGenerationFeedback({
        landingId: 100,
        originalPrompt: 'Test',
        mechanicType: 'wheel',
        slotName: 'Test',
        language: 'en',
        examplesUsed: [1, 2],
        promptTokens: 100,
        completionTokens: 200
      });

      const callArgs = mockQuery.mock.calls[0][1];
      expect(callArgs[5]).toBe('[1,2]'); // examplesUsed serialized
    });

    it('should handle empty examplesUsed array', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await ratingService.recordGenerationFeedback({
        landingId: 100,
        originalPrompt: 'Test',
        mechanicType: 'wheel',
        slotName: 'Test',
        language: 'en',
        examplesUsed: [],
        promptTokens: 100,
        completionTokens: 200
      });

      const callArgs = mockQuery.mock.calls[0][1];
      expect(callArgs[5]).toBe('[]');
    });

    it('should handle null examplesUsed', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await ratingService.recordGenerationFeedback({
        landingId: 100,
        originalPrompt: 'Test',
        mechanicType: 'wheel',
        slotName: 'Test',
        language: 'en',
        examplesUsed: null,
        promptTokens: 100,
        completionTokens: 200
      });

      const callArgs = mockQuery.mock.calls[0][1];
      expect(callArgs[5]).toBe('[]');
    });

    it('should return null on error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Insert failed'));

      const result = await ratingService.recordGenerationFeedback({
        landingId: 100,
        originalPrompt: 'Test',
        mechanicType: 'wheel',
        slotName: 'Test',
        language: 'en',
        examplesUsed: [],
        promptTokens: 100,
        completionTokens: 200
      });

      expect(result).toBeNull();
    });
  });

  describe('updateGenerationFeedbackScore', () => {
    it('should update feedback score successfully', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await ratingService.updateGenerationFeedbackScore(100, 4.5);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][1]).toEqual([100, 4.5]);
    });

    it('should not throw on error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Update failed'));

      // Should not throw
      await expect(
        ratingService.updateGenerationFeedbackScore(100, 4.5)
      ).resolves.toBeUndefined();
    });
  });

  describe('getSuccessfulPatterns', () => {
    it('should return patterns for high-rated generations', async () => {
      const mockPatterns = [
        { mechanic_type: 'wheel', slot_name: 'Fortune', final_score: 5 },
        { mechanic_type: 'wheel', slot_name: 'Lucky', final_score: 4.5 }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockPatterns });

      const result = await ratingService.getSuccessfulPatterns('wheel', 4);

      expect(result).toHaveLength(2);
      expect(result[0].final_score).toBe(5);
    });

    it('should use default minScore of 4', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await ratingService.getSuccessfulPatterns('wheel');

      expect(mockQuery.mock.calls[0][1]).toEqual(['wheel', 4]);
    });

    it('should order by final_score DESC', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await ratingService.getSuccessfulPatterns('wheel');

      expect(mockQuery.mock.calls[0][0]).toContain('ORDER BY gf.final_score DESC');
    });

    it('should limit to 20 results', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await ratingService.getSuccessfulPatterns('wheel');

      expect(mockQuery.mock.calls[0][0]).toContain('LIMIT 20');
    });
  });

  describe('addCuratedExample', () => {
    it('should create a curated example successfully', async () => {
      const mockExample = {
        id: 1,
        name: 'Test Example',
        mechanic_type: 'wheel',
        language: 'en',
        html_code: '<div>Test</div>',
        is_curated: true,
        avg_rating: 5.0
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockExample] });

      const result = await ratingService.addCuratedExample({
        name: 'Test Example',
        mechanicType: 'wheel',
        language: 'en',
        htmlCode: '<div>Test</div>',
        cssCode: '.test { color: red; }',
        jsCode: 'console.log("test")',
        configCode: '{ "test": true }',
        features: ['responsive', 'animated']
      });

      expect(result.name).toBe('Test Example');
      expect(result.is_curated).toBe(true);
      expect(result.avg_rating).toBe(5.0);
    });

    it('should use default language "en" when not provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await ratingService.addCuratedExample({
        name: 'Test',
        mechanicType: 'wheel',
        htmlCode: '<div>Test</div>'
      });

      const callArgs = mockQuery.mock.calls[0][1];
      expect(callArgs[2]).toBe('en'); // language
    });

    it('should serialize features as JSON', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await ratingService.addCuratedExample({
        name: 'Test',
        mechanicType: 'wheel',
        htmlCode: '<div>Test</div>',
        features: ['feature1', 'feature2']
      });

      const callArgs = mockQuery.mock.calls[0][1];
      expect(callArgs[7]).toBe('["feature1","feature2"]');
    });

    it('should handle empty features array', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await ratingService.addCuratedExample({
        name: 'Test',
        mechanicType: 'wheel',
        htmlCode: '<div>Test</div>',
        features: []
      });

      const callArgs = mockQuery.mock.calls[0][1];
      expect(callArgs[7]).toBe('[]');
    });

    it('should handle null optional fields', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await ratingService.addCuratedExample({
        name: 'Test',
        mechanicType: 'wheel',
        htmlCode: '<div>Test</div>'
      });

      const callArgs = mockQuery.mock.calls[0][1];
      expect(callArgs[4]).toBeNull(); // cssCode
      expect(callArgs[5]).toBeNull(); // jsCode
      expect(callArgs[6]).toBeNull(); // configCode
    });

    it('should return undefined when ON CONFLICT causes no insert', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // No rows returned

      const result = await ratingService.addCuratedExample({
        name: 'Duplicate',
        mechanicType: 'wheel',
        htmlCode: '<div>Test</div>'
      });

      expect(result).toBeUndefined();
    });

    it('should use ON CONFLICT DO NOTHING', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await ratingService.addCuratedExample({
        name: 'Test',
        mechanicType: 'wheel',
        htmlCode: '<div>Test</div>'
      });

      expect(mockQuery.mock.calls[0][0]).toContain('ON CONFLICT DO NOTHING');
    });
  });

  describe('markExampleUsed', () => {
    it('should increment usage count and update timestamp', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await ratingService.markExampleUsed(42);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain('usage_count = usage_count + 1');
      expect(mockQuery.mock.calls[0][0]).toContain('last_used_at = NOW()');
      expect(mockQuery.mock.calls[0][1]).toEqual([42]);
    });

    it('should not throw on error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Update failed'));

      // markExampleUsed doesn't have error handling, so it will throw
      await expect(ratingService.markExampleUsed(42)).rejects.toThrow('Update failed');
    });
  });

  describe('getLearningStats', () => {
    it('should return comprehensive learning statistics', async () => {
      const mockStats = {
        total_ratings: '150',
        active_examples: '25',
        curated_examples: '10',
        auto_promoted_examples: '15',
        global_avg_rating: '4.25',
        successful_generations: '80'
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockStats] });

      const result = await ratingService.getLearningStats();

      expect(result.total_ratings).toBe('150');
      expect(result.active_examples).toBe('25');
      expect(result.curated_examples).toBe('10');
      expect(result.auto_promoted_examples).toBe('15');
      expect(result.global_avg_rating).toBe('4.25');
      expect(result.successful_generations).toBe('80');
    });

    it('should return zeros when no data exists', async () => {
      const mockStats = {
        total_ratings: '0',
        active_examples: '0',
        curated_examples: '0',
        auto_promoted_examples: '0',
        global_avg_rating: null,
        successful_generations: '0'
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockStats] });

      const result = await ratingService.getLearningStats();

      expect(result.total_ratings).toBe('0');
      expect(result.global_avg_rating).toBeNull();
    });

    it('should query all required statistics in one call', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{}] });

      await ratingService.getLearningStats();

      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain('landing_ratings');
      expect(query).toContain('landing_examples');
      expect(query).toContain('generation_feedback');
      expect(query).toContain('is_curated = true');
      expect(query).toContain('is_curated = false');
      expect(query).toContain('final_score >= 4');
    });
  });

  describe('Default export', () => {
    it('should export all functions as default object', async () => {
      const defaultExport = ratingService.default;

      expect(defaultExport.rateLanding).toBeDefined();
      expect(defaultExport.getLandingRatings).toBeDefined();
      expect(defaultExport.getLandingAvgRating).toBeDefined();
      expect(defaultExport.getBestExamplesForMechanic).toBeDefined();
      expect(defaultExport.recordGenerationFeedback).toBeDefined();
      expect(defaultExport.updateGenerationFeedbackScore).toBeDefined();
      expect(defaultExport.getSuccessfulPatterns).toBeDefined();
      expect(defaultExport.addCuratedExample).toBeDefined();
      expect(defaultExport.markExampleUsed).toBeDefined();
      expect(defaultExport.getLearningStats).toBeDefined();
      expect(defaultExport.importFilesystemExamples).toBeDefined();
    });
  });
});
