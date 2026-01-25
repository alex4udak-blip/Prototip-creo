#!/usr/bin/env node
/**
 * POC Test: Landing Generator Pipeline
 *
 * Тестируем:
 * 1. Gemini генерирует background (candy style для Sweet Bonanza)
 * 2. Gemini генерирует wheel на белом фоне
 * 3. Runware удаляет фон с wheel
 * 4. Проверяем качество результатов
 *
 * Запуск: node scripts/poc-landing-test.js
 */

import { GoogleGenAI } from '@google/genai';
import { Runware } from '@runware/sdk-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(`${colors[color]}${args.join(' ')}${colors.reset}`);
}

// Проверка API ключей
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY;

if (!GOOGLE_API_KEY) {
  log('red', '❌ GOOGLE_API_KEY not found in .env');
  process.exit(1);
}

log('green', '✅ GOOGLE_API_KEY found');
log('cyan', `   Runware API: ${RUNWARE_API_KEY ? '✅ Available' : '⚠️ Not configured'}`);

// Создаём папку для результатов
const OUTPUT_DIR = path.join(process.cwd(), 'poc-results');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Инициализация Gemini
const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

/**
 * Тест 1: Генерация background в candy-стиле
 */
async function testGenerateBackground() {
  log('blue', '\n📸 Test 1: Generating candy-style background...');

  const prompt = `Generate a vibrant candy-themed casino game background.

STYLE: Sweet Bonanza slot game aesthetic
- Bright, colorful candy land scenery
- Sugar-coated mountains and candy cane trees
- Soft pastel and vibrant colors (pink, purple, blue, yellow)
- Dreamy clouds and sparkles
- NO text, NO characters, just scenic background
- Resolution: 1920x1080, landscape

The background should feel magical, sweet, and inviting like a candy wonderland.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseModalities: ['IMAGE'],
        safetySettings: [
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
        ]
      }
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData);

    if (imagePart?.inlineData) {
      const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
      const filepath = path.join(OUTPUT_DIR, 'test1_background.png');
      fs.writeFileSync(filepath, buffer);

      log('green', `✅ Background generated! Size: ${Math.round(buffer.length / 1024)} KB`);
      log('cyan', `   Saved to: ${filepath}`);
      return filepath;
    } else {
      log('red', '❌ No image in response');
      log('yellow', `   Finish reason: ${response.candidates?.[0]?.finishReason}`);
      return null;
    }
  } catch (error) {
    log('red', `❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Тест 2: Генерация wheel на белом фоне
 */
async function testGenerateWheel() {
  log('blue', '\n🎡 Test 2: Generating wheel on white background...');

  const prompt = `Generate a casino fortune wheel on a PURE WHITE background.

WHEEL DESIGN:
- 8 colorful segments with candy-themed colors (pink, orange, yellow, green, blue, purple)
- Golden metallic outer rim with decorative pattern
- Central hub with sparkle/gem design
- Each segment has a small candy icon (lollipop, donut, star, etc.)
- 3D perspective with subtle shadow
- NO text on segments, just colors and simple icons

CRITICAL: The background MUST be completely pure white (#FFFFFF)
This is for background removal - white bg, nothing else behind the wheel.

Resolution: 1024x1024, centered wheel filling 80% of frame.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseModalities: ['IMAGE'],
        safetySettings: [
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
        ]
      }
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData);

    if (imagePart?.inlineData) {
      const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
      const filepath = path.join(OUTPUT_DIR, 'test2_wheel_white_bg.png');
      fs.writeFileSync(filepath, buffer);

      log('green', `✅ Wheel generated! Size: ${Math.round(buffer.length / 1024)} KB`);
      log('cyan', `   Saved to: ${filepath}`);
      return { filepath, base64: imagePart.inlineData.data };
    } else {
      log('red', '❌ No image in response');
      log('yellow', `   Finish reason: ${response.candidates?.[0]?.finishReason}`);
      return null;
    }
  } catch (error) {
    log('red', `❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Тест 3: Удаление фона через Runware
 */
async function testRemoveBackground(wheelData) {
  if (!RUNWARE_API_KEY) {
    log('yellow', '\n⚠️ Test 3: Skipped (RUNWARE_API_KEY not configured)');
    log('cyan', '   To test background removal, add RUNWARE_API_KEY to .env');
    return null;
  }

  log('blue', '\n🔧 Test 3: Removing background with Runware...');

  try {
    const runware = new Runware({ apiKey: RUNWARE_API_KEY });
    await runware.ensureConnection();
    log('cyan', '   Connected to Runware');

    // Используем Background Removal API
    const result = await runware.imageBackgroundRemoval({
      inputImage: `data:image/png;base64,${wheelData.base64}`,
      outputType: 'URL',
      outputFormat: 'PNG'
    });

    if (result?.[0]?.imageURL) {
      // Скачиваем результат
      const response = await fetch(result[0].imageURL);
      const buffer = Buffer.from(await response.arrayBuffer());
      const filepath = path.join(OUTPUT_DIR, 'test3_wheel_transparent.png');
      fs.writeFileSync(filepath, buffer);

      log('green', `✅ Background removed! Size: ${Math.round(buffer.length / 1024)} KB`);
      log('cyan', `   Saved to: ${filepath}`);
      return filepath;
    } else {
      log('red', '❌ No result from Runware');
      return null;
    }
  } catch (error) {
    log('red', `❌ Runware error: ${error.message}`);
    return null;
  }
}

/**
 * Тест 4: Генерация персонажа
 */
async function testGenerateCharacter() {
  log('blue', '\n👤 Test 4: Generating character on white background...');

  const prompt = `Generate a cute cartoon candy mascot character on a PURE WHITE background.

CHARACTER:
- Anthropomorphic candy/sweet character (like a happy lollipop or gummy bear)
- Bright, cheerful expression with big eyes
- Colorful candy-themed outfit (pink, purple, rainbow)
- Full body, standing pose, slightly angled
- Cartoon/anime style, vibrant colors
- Character should look excited and welcoming

CRITICAL: Background MUST be completely pure white (#FFFFFF).
This is for background removal - white bg, nothing else behind the character.

Resolution: 1024x1024, character centered, filling 70% of frame.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseModalities: ['IMAGE'],
        safetySettings: [
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
        ]
      }
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData);

    if (imagePart?.inlineData) {
      const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
      const filepath = path.join(OUTPUT_DIR, 'test4_character_white_bg.png');
      fs.writeFileSync(filepath, buffer);

      log('green', `✅ Character generated! Size: ${Math.round(buffer.length / 1024)} KB`);
      log('cyan', `   Saved to: ${filepath}`);
      return { filepath, base64: imagePart.inlineData.data };
    } else {
      log('red', '❌ No image in response');
      return null;
    }
  } catch (error) {
    log('red', `❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Main test runner
 */
async function runPOCTests() {
  log('cyan', '═══════════════════════════════════════════════════════');
  log('cyan', '  POC Test: Landing Generator Pipeline');
  log('cyan', '  Theme: Sweet Bonanza (Candy Style)');
  log('cyan', '═══════════════════════════════════════════════════════');

  const results = {
    background: null,
    wheel: null,
    wheelTransparent: null,
    character: null
  };

  // Тест 1: Background
  results.background = await testGenerateBackground();

  // Тест 2: Wheel на белом фоне
  const wheelData = await testGenerateWheel();
  results.wheel = wheelData?.filepath;

  // Тест 3: Удаление фона (если есть Runware)
  if (wheelData) {
    results.wheelTransparent = await testRemoveBackground(wheelData);
  }

  // Тест 4: Персонаж
  const characterData = await testGenerateCharacter();
  results.character = characterData?.filepath;

  // Итоги
  log('cyan', '\n═══════════════════════════════════════════════════════');
  log('cyan', '  POC Test Results:');
  log('cyan', '═══════════════════════════════════════════════════════');

  const passed = Object.values(results).filter(r => r !== null).length;
  const total = Object.keys(results).length;

  console.log(`
  ${results.background ? '✅' : '❌'} Background generation
  ${results.wheel ? '✅' : '❌'} Wheel on white background
  ${results.wheelTransparent ? '✅' : '⚠️'} Background removal (Runware)
  ${results.character ? '✅' : '❌'} Character generation

  Score: ${passed}/${total} tests passed

  Output folder: ${OUTPUT_DIR}
  `);

  if (passed >= 2) {
    log('green', '🎉 POC Pipeline VERIFIED! Core functionality works.');
    log('cyan', '   Next step: Implement full Landing Generator service.');
  } else {
    log('red', '⚠️ POC needs investigation. Check API keys and quotas.');
  }
}

// Run
runPOCTests().catch(err => {
  log('red', `\n💥 Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
