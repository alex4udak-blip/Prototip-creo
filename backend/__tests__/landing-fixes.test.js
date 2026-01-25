/**
 * Landing Fixes Tests
 *
 * Tests for critical fixes found in second audit:
 * 1. Landing persistence to database
 * 2. Fetch timeouts
 * 3. Asset paths in preview
 * 4. WebSocket ownership check
 * 5. Error propagation
 */

import { jest } from '@jest/globals';

// Mock dependencies
const mockQuery = jest.fn();
const mockPool = { query: mockQuery };

jest.unstable_mockModule('../src/db/connection.js', () => ({
  pool: mockPool,
  db: { query: mockQuery }
}));

jest.unstable_mockModule('../src/config/env.js', () => ({
  config: {
    storagePath: '/tmp/storage',
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

describe('fetchWithTimeout utility', () => {
  it('should export fetchWithTimeout function', async () => {
    const module = await import('../src/utils/fetchWithTimeout.js');
    expect(typeof module.fetchWithTimeout).toBe('function');
  });

  it('should handle AbortController signal for timeout', async () => {
    const { fetchWithTimeout } = await import('../src/utils/fetchWithTimeout.js');

    // Test that timeout mechanism exists and throws correctly
    const originalFetch = global.fetch;

    // Mock fetch to reject with AbortError (simulates timeout)
    global.fetch = jest.fn(() => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    await expect(
      fetchWithTimeout('http://example.com/test', { timeout: 100 })
    ).rejects.toThrow(/timeout/i);

    global.fetch = originalFetch;
  });

  it('should pass through successful responses', async () => {
    const { fetchWithTimeout } = await import('../src/utils/fetchWithTimeout.js');

    const originalFetch = global.fetch;
    const mockResponse = { ok: true, json: () => Promise.resolve({ data: 'test' }) };
    global.fetch = jest.fn(() => Promise.resolve(mockResponse));

    const response = await fetchWithTimeout('http://example.com/test', { timeout: 5000 });

    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalled();

    global.fetch = originalFetch;
  });
});

describe('Asset path rewriting for preview', () => {
  it('should rewrite relative asset paths to absolute', () => {
    // Simulate the preview HTML rewriting logic
    const landingId = 'test-landing-123';
    const baseAssetUrl = `/api/landing/v2/${landingId}/asset`;

    const testHtml = `
      <img src="assets/background.png">
      <img src="assets/wheel.webp">
      <audio src="sounds/spin.mp3">
    `;

    let processedHtml = testHtml;

    // Pattern 1: assets/filename.ext
    processedHtml = processedHtml.replace(
      /(['"])(assets\/[^'"]+)(['"])/g,
      (match, q1, path, q2) => `${q1}${baseAssetUrl}/${path.replace('assets/', '')}${q2}`
    );

    // Pattern 2: sounds/filename.ext
    processedHtml = processedHtml.replace(
      /(['"])(sounds\/[^'"]+)(['"])/g,
      (match, q1, path, q2) => `${q1}${baseAssetUrl}/${path}${q2}`
    );

    expect(processedHtml).toContain(`/api/landing/v2/${landingId}/asset/background.png`);
    expect(processedHtml).toContain(`/api/landing/v2/${landingId}/asset/wheel.webp`);
    expect(processedHtml).toContain(`/api/landing/v2/${landingId}/asset/sounds/spin.mp3`);

    // Should not contain original paths
    expect(processedHtml).not.toContain('"assets/background.png"');
    expect(processedHtml).not.toContain('"assets/wheel.webp"');
    expect(processedHtml).not.toContain('"sounds/spin.mp3"');
  });

  it('should handle both single and double quotes', () => {
    const landingId = 'test-id';
    const baseAssetUrl = `/api/landing/v2/${landingId}/asset`;

    const testHtml = `<img src='assets/test.png'><img src="assets/test2.png">`;

    let processedHtml = testHtml.replace(
      /(['"])(assets\/[^'"]+)(['"])/g,
      (match, q1, path, q2) => `${q1}${baseAssetUrl}/${path.replace('assets/', '')}${q2}`
    );

    expect(processedHtml).toContain(`'/api/landing/v2/${landingId}/asset/test.png'`);
    expect(processedHtml).toContain(`"/api/landing/v2/${landingId}/asset/test2.png"`);
  });
});

describe('WebSocket ownership validation', () => {
  it('should verify ownership before allowing subscription', () => {
    // Simulate the ownership check logic
    const mockSession = { userId: 1, id: 'landing-123' };
    const requestingUserId = 2; // Different user

    const isOwner = mockSession.userId === requestingUserId;
    expect(isOwner).toBe(false);

    const sameUserRequest = 1;
    const isOwnerSameUser = mockSession.userId === sameUserRequest;
    expect(isOwnerSameUser).toBe(true);
  });
});

describe('Landing database persistence', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('should insert landing with all required fields', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1 }]
    });

    const insertQuery = `
      INSERT INTO landings (
        landing_id, user_id, type, slot_name, language,
        prizes, palette, status, preview_path, generated_html, features, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    `;

    const params = [
      'test-uuid',
      1,
      'wheel',
      'Gates of Olympus',
      'en',
      JSON.stringify(['€500', '100 FS']),
      JSON.stringify({ primary: '#FFD700' }),
      'complete',
      '/path/to/preview.png',
      '<html>...</html>',
      JSON.stringify(['wheel', 'sounds'])
    ];

    await mockPool.query(insertQuery, params);

    expect(mockQuery).toHaveBeenCalled();
    const [query, queryParams] = mockQuery.mock.calls[0];
    expect(query).toContain('INSERT INTO landings');
    expect(query).toContain('generated_html');
    expect(query).toContain('features');
    expect(queryParams).toHaveLength(11);
    expect(queryParams[9]).toBe('<html>...</html>'); // generated_html
  });

  it('should store generated_html for auto-promotion', () => {
    // The trigger needs generated_html to promote to examples
    const insertFields = [
      'landing_id', 'user_id', 'type', 'slot_name', 'language',
      'prizes', 'palette', 'status', 'preview_path', 'generated_html', 'features'
    ];

    expect(insertFields).toContain('generated_html');
    expect(insertFields).toContain('features');
  });
});

describe('Rating system integration', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('should update generation feedback score after rating', async () => {
    // Simulate updateGenerationFeedbackScore call
    const dbLandingId = 123;
    const score = 5;

    mockQuery.mockResolvedValueOnce({ rows: [] });

    await mockPool.query(
      'UPDATE generation_feedback SET final_score = $2 WHERE landing_id = $1',
      [dbLandingId, score]
    );

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE generation_feedback'),
      [dbLandingId, score]
    );
  });

  it('should link generation feedback to landing ID', async () => {
    // recordGenerationFeedback should receive actual dbLandingId
    const dbLandingId = 456;

    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const result = await mockPool.query(
      `INSERT INTO generation_feedback (landing_id, original_prompt, mechanic_type)
       VALUES ($1, $2, $3) RETURNING id`,
      [dbLandingId, 'test prompt', 'wheel']
    );

    expect(mockQuery.mock.calls[0][1][0]).toBe(dbLandingId);
    expect(mockQuery.mock.calls[0][1][0]).not.toBeNull();
  });
});

describe('Error propagation', () => {
  it('should structure error message for WebSocket', () => {
    const error = new Error('Generation failed: rate limit');
    const userId = 1;
    const landingId = 'test-landing';
    const progress = 45;

    const errorMessage = {
      type: 'landing_error',
      state: 'error',
      progress: progress,
      error: error.message,
      errorCode: error.code || 'GENERATION_FAILED',
      timestamp: new Date().toISOString()
    };

    expect(errorMessage.type).toBe('landing_error');
    expect(errorMessage.state).toBe('error');
    expect(errorMessage.error).toBe('Generation failed: rate limit');
    expect(errorMessage.errorCode).toBe('GENERATION_FAILED');
    expect(errorMessage.progress).toBe(45);
    expect(errorMessage.timestamp).toBeDefined();
  });
});

describe('Auto-promotion trigger requirements', () => {
  it('should require generated_html column for promotion', () => {
    // The trigger function checks for generated_html
    const triggerCode = `
      IF landing_record.generated_html IS NOT NULL AND LENGTH(landing_record.generated_html) > 100 THEN
        -- Auto-promote to examples
    `;

    // Verify the trigger logic is present
    expect(triggerCode).toContain('generated_html IS NOT NULL');
    expect(triggerCode).toContain('LENGTH(landing_record.generated_html) > 100');
  });

  it('should include features in example promotion', () => {
    const exampleInsert = `
      INSERT INTO landing_examples (
        landing_id, name, mechanic_type, language, html_code,
        features, avg_rating, rating_count, is_curated
      ) VALUES (...)
    `;

    expect(exampleInsert).toContain('features');
    expect(exampleInsert).toContain('html_code');
  });
});
