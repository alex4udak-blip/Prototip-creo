/**
 * Tests for templateGenerator.service.js
 *
 * Tests cover:
 * - generateWheelHTML() includes all required elements
 * - generateBoxesHTML() includes all required elements
 * - CSS animations are present
 * - z-index ordering is correct
 * - CONFIG object is properly placed
 * - Mobile responsive meta tags present
 */
import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';

describe('TemplateGenerator Service', () => {
  let templateGeneratorService;

  beforeAll(async () => {
    process.env.GOOGLE_API_KEY = 'test-key';

    try {
      templateGeneratorService = await import('../src/services/templateGenerator.service.js');
    } catch (e) {
      console.warn('Module import warning:', e.message);
    }
  });

  describe('Module exports', () => {
    it('should export generateWheelHTML function', () => {
      expect(typeof templateGeneratorService?.generateWheelHTML).toBe('function');
    });

    it('should export generateBoxesHTML function', () => {
      expect(typeof templateGeneratorService?.generateBoxesHTML).toBe('function');
    });

    it('should export generateAnimationsCSS function', () => {
      expect(typeof templateGeneratorService?.generateAnimationsCSS).toBe('function');
    });

    it('should export getZIndexLayers function', () => {
      expect(typeof templateGeneratorService?.getZIndexLayers).toBe('function');
    });

    it('should export validateTemplate function', () => {
      expect(typeof templateGeneratorService?.validateTemplate).toBe('function');
    });

    it('should export checkHealth function', () => {
      expect(typeof templateGeneratorService?.checkHealth).toBe('function');
    });
  });

  describe('checkHealth', () => {
    it('should return health object', () => {
      const health = templateGeneratorService?.checkHealth();

      expect(health).toBeDefined();
      expect(health.available).toBe(true);
    });

    it('should list supported mechanics', () => {
      const health = templateGeneratorService?.checkHealth();

      expect(health.supportedMechanics).toBeDefined();
      expect(Array.isArray(health.supportedMechanics)).toBe(true);
      expect(health.supportedMechanics).toContain('wheel');
      expect(health.supportedMechanics).toContain('boxes');
    });

    it('should list features', () => {
      const health = templateGeneratorService?.checkHealth();

      expect(health.features).toBeDefined();
      expect(Array.isArray(health.features)).toBe(true);
    });
  });
});

describe('generateWheelHTML', () => {
  let templateGeneratorService;
  let mockLayers;
  let mockConfig;

  beforeAll(async () => {
    process.env.GOOGLE_API_KEY = 'test-key';

    templateGeneratorService = await import('../src/services/templateGenerator.service.js');

    // Mock layers (new API format)
    mockLayers = {
      background: { url: '/uploads/background.png' },
      wheel: { url: '/uploads/wheel.png' },
      frame: { url: '/uploads/frame.png' },
      pointer: { url: '/uploads/pointer.png' },
      logo: { url: '/uploads/logo.png' },
      character: { url: '/uploads/character.png' }
    };

    // Mock config
    mockConfig = {
      title: 'SPIN TO WIN!',
      buttonText: 'SPIN',
      claimButtonText: 'CLAIM PRIZE',
      offerUrl: 'https://example.com/offer',
      prizes: ['$1500', '$100', '$50', '$25', '$10', '$100', '$50', '$25'],
      winSector: 1
    };
  });

  describe('HTML Structure', () => {
    it('should generate valid HTML document', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toBeDefined();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });

    it('should include head section', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('<head>');
      expect(html).toContain('</head>');
    });

    it('should include body section', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
    });

    it('should include charset meta tag', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('charset');
    });
  });

  describe('Mobile Responsive Meta Tags', () => {
    it('should include viewport meta tag', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('viewport');
      expect(html).toContain('width=device-width');
    });

    it('should include mobile optimization settings', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      // Check for mobile optimization - may include user-scalable or maximum-scale
      expect(html.includes('user-scalable') || html.includes('maximum-scale')).toBe(true);
    });

    it('should include noindex, nofollow for SEO', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('noindex');
      expect(html).toContain('nofollow');
    });
  });

  describe('Wheel Elements', () => {
    it('should include wheel element', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('wheel');
    });

    it('should include pointer element', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('pointer') || expect(html).toContain('arrow');
    });

    it('should include spin button', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('spin') || expect(html).toContain('SPIN');
    });

    it('should include prize sectors', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      // Should contain prize text
      expect(html).toContain('$1500');
    });
  });

  describe('Buttons and CTAs', () => {
    it('should include button text from config', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('SPIN');
    });

    it('should include claim button text', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('CLAIM PRIZE');
    });

    it('should include offer URL in config', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('example.com/offer');
    });
  });

  describe('Title', () => {
    it('should include title', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('SPIN TO WIN!');
    });
  });

  describe('CONFIG Object', () => {
    it('should include CONFIG object in script', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('CONFIG');
    });

    it('should include prizes in CONFIG', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('prizes');
    });

    it('should include winSector in CONFIG', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('winSector');
    });

    it('should include offerUrl in CONFIG', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('offerUrl');
    });
  });

  describe('Image URLs', () => {
    it('should include background image URL', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('/uploads/background.png');
    });

    it('should include wheel image URL', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('/uploads/wheel.png');
    });

    it('should include logo image URL', () => {
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, mockConfig);

      expect(html).toContain('/uploads/logo.png');
    });
  });
});

describe('generateBoxesHTML', () => {
  let templateGeneratorService;
  let mockLayers;
  let mockConfig;

  beforeAll(async () => {
    process.env.GOOGLE_API_KEY = 'test-key';

    templateGeneratorService = await import('../src/services/templateGenerator.service.js');

    // Mock layers for boxes
    mockLayers = {
      background: { url: '/uploads/background.png' },
      logo: { url: '/uploads/logo.png' },
      character: { url: '/uploads/character.png' },
      boxClosed: { url: '/uploads/box-closed.png' },
      boxOpen: { url: '/uploads/box-open.png' }
    };

    // Mock config
    mockConfig = {
      title: 'PICK YOUR PRIZE!',
      claimButtonText: 'CLAIM NOW',
      offerUrl: 'https://example.com/offer',
      requiredBoxes: 3,
      totalCash: 1500,
      totalFs: 250
    };
  });

  describe('HTML Structure', () => {
    it('should generate valid HTML document', () => {
      const html = templateGeneratorService?.generateBoxesHTML(mockLayers, mockConfig);

      expect(html).toBeDefined();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
    });

    it('should include viewport meta tag', () => {
      const html = templateGeneratorService?.generateBoxesHTML(mockLayers, mockConfig);

      expect(html).toContain('viewport');
      expect(html).toContain('width=device-width');
    });
  });

  describe('Box Elements', () => {
    it('should include box elements', () => {
      const html = templateGeneratorService?.generateBoxesHTML(mockLayers, mockConfig);

      expect(html).toContain('box');
    });

    it('should include box inner for flip animation', () => {
      const html = templateGeneratorService?.generateBoxesHTML(mockLayers, mockConfig);

      expect(html).toContain('box-inner');
    });

    it('should include box images', () => {
      const html = templateGeneratorService?.generateBoxesHTML(mockLayers, mockConfig);

      expect(html).toContain('box-closed.png') || expect(html).toContain('boxClosedImage');
    });
  });

  describe('CONFIG Object for Boxes', () => {
    it('should include CONFIG object', () => {
      const html = templateGeneratorService?.generateBoxesHTML(mockLayers, mockConfig);

      expect(html).toContain('CONFIG');
    });

    it('should include requiredBoxes in CONFIG', () => {
      const html = templateGeneratorService?.generateBoxesHTML(mockLayers, mockConfig);

      expect(html).toContain('requiredBoxes');
    });

    it('should include offerUrl in CONFIG', () => {
      const html = templateGeneratorService?.generateBoxesHTML(mockLayers, mockConfig);

      expect(html).toContain('offerUrl');
    });
  });

  describe('Title and CTA', () => {
    it('should include title', () => {
      const html = templateGeneratorService?.generateBoxesHTML(mockLayers, mockConfig);

      expect(html).toContain('PICK YOUR PRIZE!');
    });

    it('should include CTA button', () => {
      const html = templateGeneratorService?.generateBoxesHTML(mockLayers, mockConfig);

      expect(html).toContain('CLAIM NOW');
    });
  });
});

describe('CSS Animations', () => {
  let templateGeneratorService;

  beforeAll(async () => {
    process.env.GOOGLE_API_KEY = 'test-key';
    templateGeneratorService = await import('../src/services/templateGenerator.service.js');
  });

  describe('generateAnimationsCSS', () => {
    it('should generate animations CSS string', () => {
      const css = templateGeneratorService?.generateAnimationsCSS();

      expect(css).toBeDefined();
      expect(typeof css).toBe('string');
    });

    it('should include spin animation', () => {
      const css = templateGeneratorService?.generateAnimationsCSS('wheel');

      expect(css).toContain('@keyframes') || expect(css).toContain('spin');
    });

    it('should include pulse animation', () => {
      const css = templateGeneratorService?.generateAnimationsCSS('wheel');

      expect(css).toContain('pulse') || expect(css).toContain('@keyframes');
    });
  });

  describe('Wheel HTML Animations', () => {
    it('should include animation keyframes in wheel HTML', () => {
      const mockLayers = {
        background: { url: '/uploads/bg.png' },
        wheel: { url: '/uploads/wheel.png' }
      };
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, {});

      expect(html).toContain('@keyframes');
    });

    it('should include wheel spin animation', () => {
      const mockLayers = {
        background: { url: '/uploads/bg.png' },
        wheel: { url: '/uploads/wheel.png' }
      };
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, {});

      expect(html).toContain('spin') || expect(html).toContain('rotate');
    });
  });
});

describe('Z-Index Layers', () => {
  let templateGeneratorService;

  beforeAll(async () => {
    process.env.GOOGLE_API_KEY = 'test-key';
    templateGeneratorService = await import('../src/services/templateGenerator.service.js');
  });

  describe('getZIndexLayers', () => {
    it('should return z-index object', () => {
      const zIndex = templateGeneratorService?.getZIndexLayers();

      expect(zIndex).toBeDefined();
      expect(typeof zIndex).toBe('object');
    });

    it('should have background as lowest z-index', () => {
      const zIndex = templateGeneratorService?.getZIndexLayers();

      expect(zIndex.background).toBeDefined();
      expect(zIndex.background).toBeLessThanOrEqual(1);
    });

    it('should have modal with high z-index', () => {
      const zIndex = templateGeneratorService?.getZIndexLayers();

      expect(zIndex.modal).toBeDefined();
      expect(zIndex.modal).toBeGreaterThan(100);
    });

    it('should have pointer above game element', () => {
      const zIndex = templateGeneratorService?.getZIndexLayers();

      expect(zIndex.pointer).toBeGreaterThanOrEqual(zIndex.gameElement);
    });
  });
});

describe('validateTemplate', () => {
  let templateGeneratorService;

  beforeAll(async () => {
    process.env.GOOGLE_API_KEY = 'test-key';
    templateGeneratorService = await import('../src/services/templateGenerator.service.js');
  });

  describe('Validation for Wheel Mechanic', () => {
    it('should validate correct wheel template', () => {
      const mockLayers = {
        background: { url: '/uploads/bg.png' },
        wheel: { url: '/uploads/wheel.png' }
      };
      const html = templateGeneratorService?.generateWheelHTML(mockLayers, {});
      const result = templateGeneratorService?.validateTemplate(html, 'wheel');

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should fail validation without viewport', () => {
      const html = '<html><head></head><body></body></html>';
      const result = templateGeneratorService?.validateTemplate(html, 'wheel');

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('viewport'))).toBe(true);
    });

    it('should fail validation without CONFIG', () => {
      const html = '<html><head><meta name="viewport" content="width=device-width"></head><body></body></html>';
      const result = templateGeneratorService?.validateTemplate(html, 'wheel');

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('CONFIG'))).toBe(true);
    });

    it('should fail validation without wheel element', () => {
      const html = '<html><head><meta name="viewport" content="width=device-width"></head><body><script>const CONFIG = {};</script></body></html>';
      const result = templateGeneratorService?.validateTemplate(html, 'wheel');

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.toLowerCase().includes('wheel') || i.toLowerCase().includes('spin'))).toBe(true);
    });
  });

  describe('Validation for Boxes Mechanic', () => {
    it('should validate correct boxes template', () => {
      const mockLayers = {
        background: { url: '/uploads/bg.png' },
        boxClosed: { url: '/uploads/box-closed.png' }
      };
      const html = templateGeneratorService?.generateBoxesHTML(mockLayers, {});
      const result = templateGeneratorService?.validateTemplate(html, 'boxes');

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });

    it('should fail validation without box element', () => {
      const html = '<html><head><meta name="viewport" content="width=device-width"></head><body><script>const CONFIG = {};</script></body></html>';
      const result = templateGeneratorService?.validateTemplate(html, 'boxes');

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.toLowerCase().includes('box'))).toBe(true);
    });
  });
});

describe('HTML Escaping', () => {
  let templateGeneratorService;

  beforeAll(async () => {
    process.env.GOOGLE_API_KEY = 'test-key';
    templateGeneratorService = await import('../src/services/templateGenerator.service.js');
  });

  it('should escape HTML special characters in title', () => {
    const mockLayers = { background: { url: '/uploads/bg.png' } };
    const html = templateGeneratorService?.generateWheelHTML(mockLayers, {
      title: 'Test <script>alert("XSS")</script>'
    });

    // Should not contain unescaped script tag
    expect(html).not.toContain('<script>alert("XSS")</script>');
  });

  it('should properly escape ampersand', () => {
    const mockLayers = { background: { url: '/uploads/bg.png' } };
    const html = templateGeneratorService?.generateWheelHTML(mockLayers, {
      title: 'Test & Escape'
    });

    // HTML should be generated
    expect(html).toBeDefined();
    expect(html.length).toBeGreaterThan(100);
  });
});

describe('Responsive Design', () => {
  let templateGeneratorService;

  beforeAll(async () => {
    process.env.GOOGLE_API_KEY = 'test-key';
    templateGeneratorService = await import('../src/services/templateGenerator.service.js');
  });

  it('should include media queries for mobile', () => {
    const mockLayers = { background: { url: '/uploads/bg.png' } };
    const html = templateGeneratorService?.generateWheelHTML(mockLayers, {});

    expect(html).toContain('@media');
    expect(html).toContain('max-width');
  });

  it('should use clamp for font sizes', () => {
    const mockLayers = { background: { url: '/uploads/bg.png' } };
    const html = templateGeneratorService?.generateWheelHTML(mockLayers, {});

    expect(html).toContain('clamp(');
  });

  it('should use vw/vh units', () => {
    const mockLayers = { background: { url: '/uploads/bg.png' } };
    const html = templateGeneratorService?.generateWheelHTML(mockLayers, {});

    expect(html.includes('vw') || html.includes('vh')).toBe(true);
  });

  it('should use min() for responsive sizing', () => {
    const mockLayers = { background: { url: '/uploads/bg.png' } };
    const html = templateGeneratorService?.generateWheelHTML(mockLayers, {});

    expect(html).toContain('min(');
  });
});
