# LANDING GENERATOR — MASTER PLAN

> **Статус:** ПЛАН НА УТВЕРЖДЕНИЕ
> **Дата:** 24.01.2026
> **Гарантия:** 120% качество как в референсах или лучше

---

## КРИТИЧЕСКИЕ ОТКРЫТИЯ (ИССЛЕДОВАНИЕ)

### Gemini НЕ МОЖЕТ генерировать прозрачные PNG!

**Факт:** [Gemini Apps Community](https://support.google.com/gemini/thread/388691969) и [Google AI Forum](https://discuss.ai.google.dev/t/unable-to-create-transparent-pngs/92868) подтверждают — Gemini рисует "шашечки" как пиксели, а не настоящую прозрачность.

**Решение:**
```
Gemini генерирует на СПЛОШНОМ БЕЛОМ/ЗЕЛЁНОМ фоне
                    ↓
Rembg / Runware Background Removal API удаляет фон
                    ↓
Получаем чистый PNG с альфа-каналом
```

### Runware МОЖЕТ:
1. **LayerDiffuse** — генерация с встроенной прозрачностью (только FLUX Dev)
2. **Background Removal API** — удаление фона из любого изображения
3. [Runware Docs](https://runware.ai/docs/tools/remove-background)

### Rembg (бесплатно, self-hosted):
- Модель `u2net` — универсальная
- Модель `u2net_human_seg` — для людей
- Alpha matting — для сглаживания краёв
- [GitHub](https://github.com/danielgatis/rembg)

---

## АРХИТЕКТУРА ГЕНЕРАЦИИ АССЕТОВ

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PIPELINE ГЕНЕРАЦИИ АССЕТОВ                               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ЭЛЕМЕНТЫ БЕЗ ФОНА (персонажи, объекты, UI)                         │   │
│  │                                                                      │   │
│  │  Gemini: "cartoon fish character, SOLID WHITE BACKGROUND,            │   │
│  │           no shadows, clean edges, centered, full body"              │   │
│  │                          ↓                                           │   │
│  │  Rembg/Runware: удаляем белый фон → PNG с альфа-каналом             │   │
│  │                          ↓                                           │   │
│  │  Sharp: обрезаем до контента (trim), оптимизируем размер            │   │
│  │                                                                      │   │
│  │  ТЕСТ: Каждый ассет проверяется на:                                 │   │
│  │  ✓ Наличие альфа-канала (hasAlpha)                                  │   │
│  │  ✓ Отсутствие белых краёв (edge detection)                          │   │
│  │  ✓ Правильный размер (min 256px, max 2048px)                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ФОНЫ (backgrounds) — НЕ НУЖНА ПРОЗРАЧНОСТЬ                         │   │
│  │                                                                      │   │
│  │  Gemini: "casino warehouse scene, dramatic lighting, 16:9,           │   │
│  │           full background, no empty space"                           │   │
│  │                          ↓                                           │   │
│  │  Sharp: resize до нужного разрешения (1920x1080, 1080x1920)         │   │
│  │                          ↓                                           │   │
│  │  WebP compression для оптимизации веса                               │   │
│  │                                                                      │   │
│  │  ТЕСТ: Каждый фон проверяется на:                                   │   │
│  │  ✓ Заполненность (нет чёрных/белых углов)                           │   │
│  │  ✓ Aspect ratio соответствует запросу                               │   │
│  │  ✓ Размер файла < 500KB (WebP)                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ТЕКСТ НА КАРТИНКАХ (логотипы, призы)                               │   │
│  │                                                                      │   │
│  │  ПРОБЛЕМА: AI плохо рисует текст, буквы кривые                      │   │
│  │                                                                      │   │
│  │  РЕШЕНИЕ: Генерируем БЕЗ текста + накладываем программно:           │   │
│  │                                                                      │   │
│  │  1. Gemini: "slot game logo SHAPE, golden frame, NO TEXT,            │   │
│  │             empty space in center for text overlay"                  │   │
│  │                          ↓                                           │   │
│  │  2. Sharp/Canvas: накладываем текст шрифтом                         │   │
│  │     - Шрифты: Roboto, Oswald, Bangers (игровые)                     │   │
│  │     - Эффекты: stroke, shadow, gradient                             │   │
│  │                          ↓                                           │   │
│  │  3. Результат: чёткий читаемый текст                                │   │
│  │                                                                      │   │
│  │  ТЕСТ: Текст проверяется на:                                        │   │
│  │  ✓ Читаемость (размер шрифта ≥ 24px)                                │   │
│  │  ✓ Контрастность с фоном                                            │   │
│  │  ✓ Нет обрезки символов                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## СЕРВИСЫ И ЗАВИСИМОСТИ

### Обязательные API:
| Сервис | Переменная | Назначение | Статус |
|--------|------------|------------|--------|
| Gemini | `GEMINI_API_KEY` | Генерация изображений | ✅ Есть |
| Runware | `RUNWARE_API_KEY` | Fallback + Background Removal | ✅ Есть |
| Serper | `SERPER_API_KEY` | Поиск референсов слотов | ✅ Есть |
| Pixabay | `PIXABAY_API_KEY` | Поиск звуков | ✅ Есть |

### NPM пакеты:
```json
{
  "sharp": "^0.33.x",           // Обработка изображений
  "archiver": "^7.x",          // Создание ZIP
  "node-vibrant": "^4.x",      // Извлечение палитры
  "puppeteer": "^23.x",        // Скриншоты для preview
  "@anthropic-ai/sdk": "^0.x", // Claude API (для сложных игр)
  "canvas": "^2.x"             // Наложение текста на картинки
}
```

### Self-hosted (опционально для экономии):
```bash
# Rembg как HTTP сервер
docker run -p 7000:7000 danielgatis/rembg s --host 0.0.0.0 --port 7000
```

---

## СТРУКТУРА ПРОЕКТА

```
backend/src/
├── services/
│   ├── landing/
│   │   ├── index.js                 # Главный оркестратор
│   │   ├── analyzer.service.js      # Анализ слота/бренда
│   │   ├── assets.service.js        # Генерация ассетов
│   │   ├── background-removal.js    # Удаление фона (rembg/runware)
│   │   ├── text-overlay.service.js  # Наложение текста
│   │   ├── code-generator.service.js # Генерация HTML/CSS/JS
│   │   ├── sound.service.js         # Подбор звуков (Pixabay)
│   │   ├── builder.service.js       # Сборка ZIP
│   │   └── tests/                   # АВТОТЕСТЫ
│   │       ├── assets.test.js
│   │       ├── transparency.test.js
│   │       ├── landing-output.test.js
│   │       └── visual-regression.test.js
│   │
│   ├── serper.service.js            # Поиск изображений
│   └── pixabay.service.js           # Поиск звуков
│
├── templates/
│   └── README.md                    # Шаблоны как ускорители
│
├── assets/
│   ├── fonts/                       # Игровые шрифты
│   │   ├── Bangers.ttf
│   │   ├── Oswald.ttf
│   │   └── Roboto.ttf
│   └── sounds/                      # Базовые звуки (fallback)
│       ├── spin.mp3
│       ├── win.mp3
│       └── click.mp3
│
└── routes/
    └── landing.routes.js            # API endpoints
```

---

## API ENDPOINTS

```
POST /api/landing/generate
  Body: {
    description: "Wheel для Sweet Bonanza",  // или скриншот
    screenshot?: File,                        // референс
    prizes: ["500€", "200€", "100 FS"],
    offerUrl: "https://...",
    language: "es"
  }
  Response: {
    id: "landing_123",
    status: "processing",
    websocket: "ws://..."                     // для progress updates
  }

GET /api/landing/preview/:id
  Response: HTML preview в iframe

GET /api/landing/download/:id
  Response: ZIP file

GET /api/landing/history
  Response: список сгенерированных лендингов

WebSocket /ws/landing/:id
  Messages:
    { step: "analyzing", progress: 10 }
    { step: "generating_background", progress: 30 }
    { step: "generating_character", progress: 50 }
    { step: "removing_backgrounds", progress: 70 }
    { step: "building_html", progress: 85 }
    { step: "packaging", progress: 95 }
    { step: "complete", progress: 100, downloadUrl: "..." }
```

---

## АВТОТЕСТЫ (ОБЯЗАТЕЛЬНО!)

### 1. Тесты ассетов (assets.test.js)
```javascript
describe('Asset Generation', () => {
  test('character PNG has alpha channel', async () => {
    const asset = await generateCharacter('cartoon fish');
    const metadata = await sharp(asset).metadata();
    expect(metadata.hasAlpha).toBe(true);
  });

  test('character has no white edges', async () => {
    const asset = await generateCharacter('cartoon fish');
    const edges = await detectWhiteEdges(asset);
    expect(edges.percentage).toBeLessThan(1); // < 1% белых краёв
  });

  test('background fills entire canvas', async () => {
    const bg = await generateBackground('casino scene', 1920, 1080);
    const corners = await checkCorners(bg);
    expect(corners.allFilled).toBe(true);
  });

  test('text overlay is readable', async () => {
    const logo = await generateLogoWithText('Sweet Bonanza', '#FFD700');
    const contrast = await checkContrast(logo);
    expect(contrast.ratio).toBeGreaterThan(4.5); // WCAG AA
  });
});
```

### 2. Тесты прозрачности (transparency.test.js)
```javascript
describe('Background Removal', () => {
  test('rembg removes white background completely', async () => {
    const original = await generateOnWhite('character');
    const transparent = await removeBackground(original);
    const whitePixels = await countColor(transparent, '#FFFFFF');
    expect(whitePixels).toBe(0);
  });

  test('edges are smooth after removal', async () => {
    const transparent = await removeBackground(testImage);
    const edgeQuality = await analyzeEdges(transparent);
    expect(edgeQuality.smoothness).toBeGreaterThan(0.9);
  });

  test('alpha matting preserves details', async () => {
    const character = await removeBackground(hairyCharacter);
    const hairDetail = await analyzeHairDetail(character);
    expect(hairDetail.preserved).toBeGreaterThan(0.85);
  });
});
```

### 3. Тесты лендинга (landing-output.test.js)
```javascript
describe('Landing Output', () => {
  test('ZIP contains all required files', async () => {
    const zip = await generateLanding(wheelConfig);
    const files = await listZipContents(zip);

    expect(files).toContain('index.html');
    expect(files).toContain('assets/bg.png');
    expect(files).toContain('assets/logo.png');
    expect(files).toContain('assets/wheel.png');
    expect(files).toContain('sounds/spin.mp3');
  });

  test('HTML is valid and mobile-responsive', async () => {
    const { html } = await generateLanding(config);
    const validation = await validateHTML(html);
    expect(validation.errors).toHaveLength(0);

    const hasViewport = html.includes('viewport');
    expect(hasViewport).toBe(true);
  });

  test('landing works in browser', async () => {
    const zip = await generateLanding(config);
    const page = await puppeteer.launch();
    await page.goto(extractedLanding);

    // Проверяем что колесо крутится
    await page.click('#spin-button');
    await page.waitForSelector('.spinning');

    // Проверяем что есть редирект
    const redirectUrl = await page.evaluate(() => window.OFFER_URL);
    expect(redirectUrl).toBeDefined();
  });

  test('player ALWAYS wins', async () => {
    // Запускаем 100 раз
    for (let i = 0; i < 100; i++) {
      const result = await simulateGame(landing);
      expect(result.won).toBe(true);
    }
  });
});
```

### 4. Visual Regression (visual-regression.test.js)
```javascript
describe('Visual Quality', () => {
  test('wheel looks like reference', async () => {
    const generated = await generateWheel('Sweet Bonanza');
    const reference = await loadReference('wheel_reference.png');

    const diff = await compareImages(generated, reference);
    expect(diff.similarity).toBeGreaterThan(0.8); // 80% похожести
  });

  test('no visual artifacts', async () => {
    const landing = await renderLanding(config);
    const screenshot = await takeScreenshot(landing);

    const artifacts = await detectArtifacts(screenshot);
    expect(artifacts).toHaveLength(0);
  });
});
```

---

## FLOW ГЕНЕРАЦИИ (ДЕТАЛЬНЫЙ)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ПОЛНЫЙ FLOW ГЕНЕРАЦИИ                               │
└─────────────────────────────────────────────────────────────────────────────┘

ВХОД: "Wheel для Sweet Bonanza, призы 500€, 200€, 100 FS, язык ES"

STEP 1: АНАЛИЗ (5 сек)
├── Serper API: поиск "Sweet Bonanza slot Pragmatic Play"
├── Скачиваем лучший результат
├── node-vibrant: извлекаем палитру
│   └── { vibrant: "#FF69B4", dark: "#4B0082", light: "#FFB6C1" }
├── Gemini Vision: определяем стиль
│   └── { theme: "candy_fantasy", style: "cartoon_bright" }
└── OUTPUT: SlotAnalysis { colors, theme, style, referenceImage }

STEP 2: ПЛАНИРОВАНИЕ АССЕТОВ (1 сек)
├── На основе типа (wheel) определяем нужные ассеты:
│   ├── bg.png — фон (не нужна прозрачность)
│   ├── logo.png — логотип с текстом (прозрачность)
│   ├── wheel-sectors.png — колесо (прозрачность)
│   ├── wheel-frame.png — рамка колеса (прозрачность)
│   ├── pointer.png — указатель (прозрачность)
│   └── button.png — кнопка SPIN (прозрачность)
└── OUTPUT: AssetPlan[]

STEP 3: ГЕНЕРАЦИЯ АССЕТОВ (30-60 сек)
│
├── [PARALLEL] Генерация на белом фоне:
│   │
│   ├── Gemini Multi-turn Chat (консистентность стиля):
│   │   │
│   │   ├── Turn 1: "Candy fantasy casino background, pink and purple,
│   │   │            lollipops, candy canes, magical sparkles,
│   │   │            16:9 aspect ratio, full scene"
│   │   │   └── → bg.png (сохраняем как есть)
│   │   │
│   │   ├── Turn 2: "Golden ornate frame for wheel, candy decorations,
│   │   │            same style, SOLID WHITE BACKGROUND, centered"
│   │   │   └── → wheel-frame-raw.png
│   │   │
│   │   ├── Turn 3: "Wheel with 6 colored sectors, candy colors,
│   │   │            pink purple yellow, same style, WHITE BACKGROUND"
│   │   │   └── → wheel-sectors-raw.png
│   │   │
│   │   ├── Turn 4: "Golden arrow pointer, candy style, WHITE BACKGROUND"
│   │   │   └── → pointer-raw.png
│   │   │
│   │   └── Turn 5: "Round button, golden with SPIN text placeholder,
│   │                candy style, WHITE BACKGROUND"
│   │       └── → button-raw.png
│   │
│   └── Logo генерируем отдельно (текст программно):
│       ├── Gemini: "Logo frame shape, golden banner, candy style,
│       │            EMPTY CENTER for text, WHITE BACKGROUND"
│       │   └── → logo-frame-raw.png
│       └── Canvas: накладываем "Sweet Bonanza" шрифтом Bangers
│           └── → logo.png
│
└── OUTPUT: raw assets на белом фоне

STEP 4: УДАЛЕНИЕ ФОНА (10-20 сек)
│
├── [PARALLEL] Для каждого ассета (кроме bg.png):
│   │
│   ├── Runware Background Removal API (или self-hosted rembg):
│   │   POST /remove-background
│   │   { image: base64, outputFormat: "png" }
│   │
│   ├── Sharp: trim() — обрезаем пустое пространство
│   │
│   └── ТЕСТ: проверяем hasAlpha === true
│
└── OUTPUT: transparent PNGs

STEP 5: НАЛОЖЕНИЕ ТЕКСТА ПРИЗОВ (5 сек)
│
├── wheel-sectors.png + prizes ["500€", "200€", "100 FS"...]
│   │
│   └── Canvas:
│       ├── Рисуем текст в каждом секторе
│       ├── Шрифт: Oswald Bold
│       ├── Цвет: контрастный к сектору
│       └── Обводка для читаемости
│
└── OUTPUT: wheel-sectors-final.png с текстом

STEP 6: ГЕНЕРАЦИЯ КОДА (10-20 сек)
│
├── Claude/Gemini генерирует HTML/CSS/JS:
│   │
│   ├── Prompt: "Generate a wheel of fortune landing page:
│   │            - 6 sectors with prizes: [...]
│   │            - Colors: primary #FF69B4, dark #4B0082
│   │            - Language: Spanish
│   │            - Offer URL: https://...
│   │            - Player ALWAYS wins (rigged to land on best prize)
│   │            - Mobile responsive
│   │            - Asset paths: assets/bg.png, assets/wheel.png, etc."
│   │
│   └── OUTPUT: index.html (с инлайн CSS/JS)
│
├── ИЛИ используем шаблон-ускоритель:
│   └── templates/wheel/index.html + подстановка переменных
│
└── ТЕСТ: валидация HTML, проверка мобильности

STEP 7: ПОДБОР ЗВУКОВ (5 сек)
│
├── Pixabay API: поиск по ключевым словам
│   ├── "wheel spin casino" → spin.mp3
│   ├── "win celebration" → win.mp3
│   └── "button click" → click.mp3
│
├── Fallback: используем локальные из assets/sounds/
│
└── OUTPUT: sounds/spin.mp3, sounds/win.mp3

STEP 8: СБОРКА ZIP (3 сек)
│
├── Структура:
│   sweet_bonanza_wheel_1706123456.zip
│   ├── index.html
│   ├── assets/
│   │   ├── bg.png
│   │   ├── logo.png
│   │   ├── wheel-sectors.png
│   │   ├── wheel-frame.png
│   │   ├── pointer.png
│   │   └── button.png
│   └── sounds/
│       ├── spin.mp3
│       └── win.mp3
│
├── Puppeteer: делаем скриншот preview
│   └── _preview.png
│
└── OUTPUT: ZIP file ready for download

ИТОГО: ~60-90 секунд для Wheel
       ~2-5 минут для сложных типов (Crash, Board)
```

---

## ГАРАНТИИ КАЧЕСТВА

### Чеклист перед релизом каждого лендинга:

```
□ Все PNG ассеты имеют прозрачность (hasAlpha === true)
□ Нет белых краёв вокруг вырезанных элементов
□ Фон заполняет весь экран без пустот
□ Текст читаемый и контрастный
□ HTML валидный (W3C validator)
□ Работает на мобильных (viewport, touch events)
□ Игрок ВСЕГДА выигрывает (100 симуляций)
□ Редирект на offer URL работает
□ Звуки воспроизводятся
□ ZIP содержит все файлы
□ Размер ZIP < 5MB
```

### Автоматические проверки в CI/CD:

```yaml
# .github/workflows/landing-tests.yml
name: Landing Generator Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:landing

      - name: Run visual regression
        run: npm run test:visual

      - name: Generate test landing
        run: npm run test:e2e:landing

      - name: Validate output
        run: npm run validate:landing
```

---

## СРАВНЕНИЕ С РЕФЕРЕНСАМИ

| Аспект | Референсы (585, 642, 659, 684, 688) | Наш генератор |
|--------|-------------------------------------|---------------|
| Фоны | Полные сцены PNG/WebP | ✅ Gemini генерирует полные сцены |
| Персонажи | PNG с прозрачностью | ✅ Gemini + rembg = прозрачность |
| Колёса | Готовые секторы с призами | ✅ Gemini + Canvas для текста |
| Анимации | CSS + JS | ✅ Claude/Gemini генерирует код |
| Звуки | MP3 файлы | ✅ Pixabay API |
| Текст | Чёткий, читаемый | ✅ Программное наложение шрифтами |
| Mobile | Адаптивные | ✅ Viewport + responsive CSS |
| Выигрыш | Всегда выигрыш | ✅ Rigged logic в JS |

---

## РИСКИ И MITIGATION

| Риск | Вероятность | Решение |
|------|-------------|---------|
| Gemini генерирует плохие картинки | Средняя | Fallback на Runware, retry с другим промптом |
| Rembg плохо вырезает фон | Низкая | Alpha matting, Runware API как fallback |
| Claude/Gemini плохой код | Средняя | Шаблоны как fallback, валидация |
| Pixabay нет нужных звуков | Низкая | Локальная библиотека fallback |
| Медленная генерация | Средняя | Параллельная генерация, WebSocket progress |

---

## СЛЕДУЮЩИЕ ШАГИ

### Phase 1: Инфраструктура (День 1)
- [ ] Создать структуру папок
- [ ] Установить npm пакеты
- [ ] Настроить тесты (Jest)
- [ ] Создать базовые сервисы

### Phase 2: Генерация ассетов (День 2-3)
- [ ] Реализовать генерацию на белом фоне
- [ ] Интегрировать rembg/Runware для удаления фона
- [ ] Реализовать text overlay с Canvas
- [ ] Написать тесты на прозрачность

### Phase 3: Генерация кода (День 4-5)
- [ ] Интегрировать Claude для генерации HTML/CSS/JS
- [ ] Создать базовые шаблоны-ускорители
- [ ] Тесты на валидность HTML

### Phase 4: Сборка и API (День 6)
- [ ] Реализовать ZIP builder
- [ ] API endpoints
- [ ] WebSocket для progress
- [ ] Тесты E2E

### Phase 5: UI (День 7-8)
- [ ] Новая вкладка в frontend
- [ ] Чат-интерфейс
- [ ] Preview в iframe
- [ ] История лендингов

### Phase 6: Тестирование (День 9-10)
- [ ] Visual regression tests
- [ ] Сравнение с референсами
- [ ] Нагрузочное тестирование
- [ ] Фикс багов

---

## УТВЕРЖДЕНИЕ

**Этот план гарантирует:**
1. ✅ Прозрачные PNG через Gemini + rembg pipeline
2. ✅ Качество как в референсах или лучше
3. ✅ Автотесты на каждом этапе
4. ✅ Infinite types — не ограничены шаблонами
5. ✅ Fallback стратегии на случай проблем

**Готов к реализации после твоего OK.**
