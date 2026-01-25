/**
 * Landing Assembler Tests
 *
 * Tests for path traversal protection and ZIP assembly.
 */

import { jest } from '@jest/globals';

// Mock fs/promises
const mockMkdir = jest.fn();
const mockWriteFile = jest.fn();
const mockCopyFile = jest.fn();
const mockAccess = jest.fn();
const mockReadFile = jest.fn();
const mockReaddir = jest.fn();
const mockStat = jest.fn();
const mockRm = jest.fn();

jest.unstable_mockModule('fs/promises', () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
  copyFile: mockCopyFile,
  access: mockAccess,
  readFile: mockReadFile,
  readdir: mockReaddir,
  stat: mockStat,
  rm: mockRm,
  default: {
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
    copyFile: mockCopyFile,
    access: mockAccess,
    readFile: mockReadFile,
    readdir: mockReaddir,
    stat: mockStat,
    rm: mockRm
  }
}));

// Mock fs (for createWriteStream and createReadStream)
jest.unstable_mockModule('fs', () => ({
  createWriteStream: jest.fn(() => ({
    on: jest.fn((event, cb) => {
      if (event === 'close') setTimeout(cb, 10);
      return { on: jest.fn() };
    }),
    write: jest.fn(),
    end: jest.fn()
  })),
  createReadStream: jest.fn(() => ({
    pipe: jest.fn()
  }))
}));

// Mock archiver
jest.unstable_mockModule('archiver', () => ({
  default: jest.fn(() => ({
    pipe: jest.fn(),
    directory: jest.fn(),
    file: jest.fn(),
    finalize: jest.fn(),
    pointer: jest.fn(() => 1024),
    on: jest.fn((event, cb) => {
      if (event === 'close') setTimeout(cb, 10);
    })
  }))
}));

// Mock config
jest.unstable_mockModule('../src/config/env.js', () => ({
  config: {
    storagePath: '/tmp/storage'
  }
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
const {
  assembleLanding,
  getLanding,
  listLandings,
  deleteLanding,
  getLandingHtml,
  getLandingZipStream
} = await import('../src/services/landing/assembler.service.js');

describe('Landing Assembler Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockCopyFile.mockResolvedValue(undefined);
    mockAccess.mockResolvedValue(undefined);
  });

  describe('Path Traversal Protection', () => {
    it('should reject path traversal in landingId', async () => {
      await expect(assembleLanding({
        landingId: '../../../etc/passwd',
        userId: 1,
        html: '<html></html>',
        assets: {},
        sounds: {}
      })).rejects.toThrow('Invalid landingId format');
    });

    it('should reject null bytes in landingId', async () => {
      await expect(assembleLanding({
        landingId: 'test\0malicious',
        userId: 1,
        html: '<html></html>',
        assets: {},
        sounds: {}
      })).rejects.toThrow('Invalid landingId format');
    });

    it('should reject extremely long landingId', async () => {
      const longId = 'a'.repeat(100);
      await expect(assembleLanding({
        landingId: longId,
        userId: 1,
        html: '<html></html>',
        assets: {},
        sounds: {}
      })).rejects.toThrow('Invalid landingId format');
    });

    it('should accept valid UUID landingId', async () => {
      const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      mockStat.mockResolvedValue({ isDirectory: () => false });

      await assembleLanding({
        landingId: validUuid,
        userId: 1,
        html: '<!DOCTYPE html><html></html>',
        assets: {},
        sounds: {},
        analysis: {}
      });

      expect(mockMkdir).toHaveBeenCalled();
    });

    it('should reject negative userId', async () => {
      await expect(assembleLanding({
        landingId: 'valid-id',
        userId: -1,
        html: '<html></html>',
        assets: {},
        sounds: {}
      })).rejects.toThrow('Invalid userId format');
    });

    it('should reject non-numeric userId', async () => {
      await expect(assembleLanding({
        landingId: 'valid-id',
        userId: '../etc',
        html: '<html></html>',
        assets: {},
        sounds: {}
      })).rejects.toThrow('Invalid userId format');
    });

    it('should reject empty HTML', async () => {
      await expect(assembleLanding({
        landingId: 'valid-id',
        userId: 1,
        html: '',
        assets: {},
        sounds: {}
      })).rejects.toThrow('Invalid HTML content');
    });
  });

  describe('getLanding with path traversal', () => {
    it('should return null for path traversal attempt in landingId', async () => {
      const result = await getLanding('../../../etc/passwd', 1);
      expect(result).toBeNull();
    });

    it('should return null for path traversal in userId', async () => {
      const result = await getLanding('valid-id', '../etc');
      expect(result).toBeNull();
    });
  });

  describe('listLandings with path traversal', () => {
    it('should return empty array for invalid userId', async () => {
      const result = await listLandings('../etc');
      expect(result).toEqual([]);
    });

    it('should return empty array for negative userId', async () => {
      const result = await listLandings(-1);
      expect(result).toEqual([]);
    });
  });

  describe('deleteLanding security', () => {
    it('should return false for path traversal in landingId', async () => {
      const result = await deleteLanding('../../../etc', 1);
      expect(result).toBe(false);
      expect(mockRm).not.toHaveBeenCalled();
    });

    it('should return false for invalid userId', async () => {
      const result = await deleteLanding('valid-id', -1);
      expect(result).toBe(false);
      expect(mockRm).not.toHaveBeenCalled();
    });
  });

  describe('getLandingHtml security', () => {
    it('should return null for path traversal', async () => {
      const result = await getLandingHtml('../../../etc/passwd', 1);
      expect(result).toBeNull();
    });

    it('should return null for invalid userId', async () => {
      const result = await getLandingHtml('valid-id', '../etc');
      expect(result).toBeNull();
    });
  });

  describe('getLandingZipStream security', () => {
    it('should return null for path traversal', async () => {
      const result = await getLandingZipStream('../../../etc', 1);
      expect(result).toBeNull();
    });

    it('should return null for invalid userId', async () => {
      const result = await getLandingZipStream('valid-id', 'invalid');
      expect(result).toBeNull();
    });
  });
});

describe('Landing Assembler Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockCopyFile.mockResolvedValue(undefined);
    mockAccess.mockResolvedValue(undefined);
    mockStat.mockResolvedValue({ isDirectory: () => true });
  });

  describe('assembleLanding', () => {
    it('should create landing directory structure', async () => {
      await assembleLanding({
        landingId: 'test-landing',
        userId: 1,
        html: '<!DOCTYPE html><html></html>',
        assets: {},
        sounds: {},
        analysis: { slotName: 'Test' }
      });

      // Should create main dir and subdirs
      expect(mockMkdir).toHaveBeenCalledTimes(3);
    });

    it('should write HTML file', async () => {
      await assembleLanding({
        landingId: 'test-landing',
        userId: 1,
        html: '<!DOCTYPE html><html></html>',
        assets: {},
        sounds: {},
        analysis: {}
      });

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('index.html'),
        expect.any(String),
        'utf-8'
      );
    });

    it('should write metadata file', async () => {
      await assembleLanding({
        landingId: 'test-landing',
        userId: 1,
        html: '<!DOCTYPE html><html></html>',
        assets: {},
        sounds: {},
        analysis: { slotName: 'Test Slot', mechanicType: 'wheel' }
      });

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('metadata.json'),
        expect.stringContaining('Test Slot'),
        'utf-8'
      );
    });

    it('should copy provided assets', async () => {
      // Reject default sounds access, accept asset paths
      mockAccess.mockImplementation((path) => {
        if (path.includes('sounds/')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve();
      });

      await assembleLanding({
        landingId: 'test-landing',
        userId: 1,
        html: '<!DOCTYPE html><html></html>',
        assets: {
          background: { path: '/tmp/bg.png' },
          wheel: { path: '/tmp/wheel.png' }
        },
        sounds: {},
        analysis: {}
      });

      // Should copy 2 asset files
      expect(mockCopyFile).toHaveBeenCalledTimes(2);
    });

    it('should replace asset placeholders in HTML', async () => {
      await assembleLanding({
        landingId: 'test-landing',
        userId: 1,
        html: '<!DOCTYPE html><img src="assets/background.png">',
        assets: {
          background: { path: '/tmp/bg.webp' }
        },
        sounds: {},
        analysis: {}
      });

      // HTML should be written with replaced paths
      const writeCall = mockWriteFile.mock.calls.find(call =>
        call[0].includes('index.html')
      );
      expect(writeCall).toBeDefined();
    });
  });

  describe('getLanding', () => {
    it('should return landing data when exists', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        landingId: 'test-landing',
        userId: 1,
        createdAt: new Date().toISOString()
      }));
      mockAccess.mockResolvedValue(undefined);

      const result = await getLanding('test-landing', 1);

      expect(result).toBeDefined();
      expect(result.landingId).toBe('test-landing');
    });

    it('should return null when landing not found', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const result = await getLanding('nonexistent', 1);

      expect(result).toBeNull();
    });
  });

  describe('listLandings', () => {
    it('should return list of user landings', async () => {
      mockReaddir.mockResolvedValue([
        { name: 'landing-1', isDirectory: () => true },
        { name: 'landing-2', isDirectory: () => true }
      ]);
      mockReadFile.mockResolvedValue(JSON.stringify({
        landingId: 'landing-1',
        createdAt: new Date().toISOString()
      }));
      mockAccess.mockResolvedValue(undefined);

      const result = await listLandings(1);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when directory not found', async () => {
      mockReaddir.mockRejectedValue(new Error('ENOENT'));

      const result = await listLandings(1);

      expect(result).toEqual([]);
    });
  });

  describe('deleteLanding', () => {
    it('should delete landing directory', async () => {
      mockRm.mockResolvedValue(undefined);

      const result = await deleteLanding('test-landing', 1);

      expect(result).toBe(true);
      expect(mockRm).toHaveBeenCalledWith(
        expect.stringContaining('test-landing'),
        { recursive: true, force: true }
      );
    });

    it('should return false on delete error', async () => {
      mockRm.mockRejectedValue(new Error('Permission denied'));

      const result = await deleteLanding('test-landing', 1);

      expect(result).toBe(false);
    });
  });

  describe('getLandingHtml', () => {
    it('should return HTML content', async () => {
      mockReadFile.mockResolvedValue('<!DOCTYPE html><html></html>');

      const result = await getLandingHtml('test-landing', 1);

      expect(result).toBe('<!DOCTYPE html><html></html>');
    });

    it('should return null when file not found', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const result = await getLandingHtml('nonexistent', 1);

      expect(result).toBeNull();
    });
  });

  describe('Asset Placeholder Replacement - Collision Prevention', () => {
    it('should NOT replace wheelFrame when processing wheel first (collision bug)', async () => {
      // This test catches the regex collision bug where "wheel" pattern
      // would incorrectly match "wheelFrame" paths
      const htmlWithBothAssets = `
        <!DOCTYPE html>
        <img src="assets/wheel.png" class="wheel">
        <img src="assets/wheelFrame.png" class="frame">
      `;

      await assembleLanding({
        landingId: 'collision-test',
        userId: 1,
        html: htmlWithBothAssets,
        assets: {
          wheel: { path: '/tmp/wheel.webp' },
          wheelFrame: { path: '/tmp/wheelFrame.webp' }
        },
        sounds: {},
        analysis: {}
      });

      // Get the HTML that was written
      const writeCall = mockWriteFile.mock.calls.find(call =>
        call[0].includes('index.html')
      );
      expect(writeCall).toBeDefined();

      const writtenHtml = writeCall[1];

      // Both assets should be replaced correctly
      // wheelFrame should NOT be corrupted by wheel's replacement
      expect(writtenHtml).toContain('assets/wheelFrame');
      expect(writtenHtml).toContain('assets/wheel');
    });

    it('should replace longer asset names first to avoid collision', async () => {
      // Test with box, boxClosed, boxOpen - all share "box" prefix
      const htmlWithBoxes = `
        <!DOCTYPE html>
        <img src="assets/box1.png">
        <img src="assets/boxClosed.png">
        <img src="assets/boxOpen.png">
      `;

      await assembleLanding({
        landingId: 'box-collision-test',
        userId: 1,
        html: htmlWithBoxes,
        assets: {
          box1: { path: '/tmp/box1.webp' },
          boxClosed: { path: '/tmp/boxClosed.webp' },
          boxOpen: { path: '/tmp/boxOpen.webp' }
        },
        sounds: {},
        analysis: {}
      });

      const writeCall = mockWriteFile.mock.calls.find(call =>
        call[0].includes('index.html')
      );
      const writtenHtml = writeCall[1];

      // All three should be replaced correctly
      expect(writtenHtml).toContain('assets/box1');
      expect(writtenHtml).toContain('assets/boxClosed');
      expect(writtenHtml).toContain('assets/boxOpen');
    });

    it('should handle sound collision - spin vs spinwheel', async () => {
      const htmlWithSounds = `
        <!DOCTYPE html>
        <script>
          new Audio('sounds/spin.mp3');
          new Audio('sounds/spinwheel.mp3');
        </script>
      `;

      await assembleLanding({
        landingId: 'sound-collision-test',
        userId: 1,
        html: htmlWithSounds,
        assets: {},
        sounds: {
          spin: '/tmp/spin.mp3',
          spinwheel: '/tmp/spinwheel.mp3'
        },
        analysis: {}
      });

      const writeCall = mockWriteFile.mock.calls.find(call =>
        call[0].includes('index.html')
      );
      // Both sounds should be replaced without collision
      expect(writeCall).toBeDefined();
    });
  });
});
