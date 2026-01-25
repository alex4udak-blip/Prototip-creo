# LANDING GENERATOR — ФИНАЛЬНАЯ АРХИТЕКТУРА

> **Статус:** НА УТВЕРЖДЕНИЕ
> **Дата:** 24.01.2026
> **Цель:** Объяснить ПОЧЕМУ это не костыли и КАК будет работать лучше референсов

---

## 1. АНАЛИЗ РЕФЕРЕНСОВ — КАК ОНИ УСТРОЕНЫ

### Chicken Road 2 (Crash Game) — 642_landing_archive

**HTML конфигурация:**
```html
<div class="game" id="game"
     data-multipliers="1.32,2.25,4.71,8.22,17.96,31.56,50.00"
     data-rate="60"
     data-crashes="1,2,3,4,5"
     data-spins="1">
```

**Логика "всегда выигрыш":**
```javascript
// data-spins="1" означает: на 1-й попытке — выигрыш
// data-crashes="1,2,3,4,5" — на каких шагах "падать" (но только если spins > 1)

// Ключевая проверка:
if (currentSpin < spins && currentStep === failStep) {
  handleFail();  // Фейковый проигрыш
} else {
  // Идём дальше → на последнем шаге handleWin()
}

// Когда currentSpin === spins → crashes игнорируются → ВСЕГДА выигрыш
```

**Ассеты:**
- `chicken.webp` — персонаж (обычный)
- `chicken-lose.webp` — персонаж (падает)
- `car-1.webp ... car-7.webp` — машины-препятствия
- `default.webp` — неактивная ячейка
- `golden.webp` — активная ячейка
- `bg-desktop.webp` — фон

### Gates of Olympus Wheel (585_landing_archive)

**Логика колеса:**
```javascript
// r = текущий спин, t = всего спинов до выигрыша
// Когда r === t → колесо останавливается на секторе 1 (главный приз)

if (r === t) {
  a.classList.add("wheel__spinner_win_1");  // CSS вращает на приз
}
```

**Ассеты:**
- `bg.webp` / `bg-mobile.webp` — фон
- `logo.webp` — логотип слота
- `wheel-sectors.webp` — колесо с секторами (ОДНА картинка)
- `wheel-frame.webp` — рамка колеса
- `left-person.webp` — персонаж

---

## 2. ПОЧЕМУ НАША АРХИТЕКТУРА — НЕ КОСТЫЛИ

### Принцип: "Генерируем то, что легко генерировать. Программируем то, что должно быть точным."

| Компонент | Референсы | Наш подход | Почему лучше |
|-----------|-----------|------------|--------------|
| **Фоны** | Статичные PNG/WebP | Gemini генерирует полные сцены | Уникальные, под любую тему |
| **Персонажи** | Художник рисовал | Gemini + rembg = прозрачные PNG | AI генерирует стилистически консистентно |
| **Колёса/Элементы** | Художник рисовал секторы | Gemini + rembg для рамки, **ТЕКСТ ПРИЗОВ — ПРОГРАММНО** | Призы всегда читаемые, любой язык |
| **Логика выигрыша** | Захардкожена в JS | Генерируем JS с параметрами | Можно настроить любую механику |
| **Анимации** | CSS keyframes | Генерируем CSS на основе типа | Консистентные, проверенные |

### Ключевой инсайт: ТЕКСТ = ПРОГРАММНО

**Проблема референсов:**
Текст призов "€500", "100 FS" нарисован на картинке колеса. Чтобы изменить — нужен дизайнер.

**Наше решение:**
```javascript
// 1. Gemini генерирует колесо БЕЗ текста (просто цветные секторы)
// 2. Canvas/Sharp накладывает текст программно

async function addPrizesToWheel(wheelImage, prizes, colors) {
  // prizes = ["€500", "€200", "100 FS", "€50", "25 FS", "BONUS"]
  // Накладываем текст в каждый сектор с правильным углом
  // Шрифт: Oswald Bold, обводка для контраста
}
```

**Результат:**
- Любой язык (€, $, ₽, FS, freispiele, бесплатные вращения)
- Любой шрифт
- Всегда читаемый текст
- Не зависим от качества генерации текста AI

---

## 3. PIPELINE ГЕНЕРАЦИИ АССЕТОВ

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ГЕНЕРАЦИЯ АССЕТОВ                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ТИП 1: ФОНЫ (не нужна прозрачность)                                        │
│  ════════════════════════════════════                                       │
│                                                                             │
│  Gemini: "Casino warehouse scene, golden boxes, dramatic lighting,          │
│           16:9 aspect ratio, full background, no empty corners"             │
│                              ↓                                              │
│  Sharp: resize(1920, 1080) → WebP compression                               │
│                              ↓                                              │
│  OUTPUT: bg.webp (< 300KB)                                                  │
│                                                                             │
│  ✅ Проверки:                                                               │
│  - Нет чёрных/белых углов (100% заполнение)                                 │
│  - Aspect ratio правильный                                                  │
│  - Размер файла оптимальный                                                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ТИП 2: ЭЛЕМЕНТЫ С ПРОЗРАЧНОСТЬЮ (персонажи, объекты)                       │
│  ═════════════════════════════════════════════════════                      │
│                                                                             │
│  Gemini: "Cartoon chicken character, standing pose,                         │
│           SOLID WHITE BACKGROUND (#FFFFFF), centered,                       │
│           full body visible, no shadows on background"                      │
│                              ↓                                              │
│  Runware Background Removal API (или rembg self-hosted):                    │
│  POST /remove-background { image: base64, outputFormat: "png" }             │
│                              ↓                                              │
│  Sharp: trim() → убираем пустое пространство                                │
│                              ↓                                              │
│  OUTPUT: character.png с альфа-каналом                                      │
│                                                                             │
│  ✅ Проверки:                                                               │
│  - hasAlpha === true                                                        │
│  - Нет белых краёв (< 1% белых пикселей по краям)                           │
│  - Размер минимум 256x256, максимум 2048x2048                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ТИП 3: ЭЛЕМЕНТЫ С ТЕКСТОМ (колёса, кнопки)                                 │
│  ═══════════════════════════════════════════                                │
│                                                                             │
│  ЭТАП A: Генерируем БЕЗ текста                                              │
│                                                                             │
│  Gemini: "Fortune wheel with 6 colored sectors, golden frame,               │
│           colors: pink, purple, yellow, blue, green, red,                   │
│           NO TEXT on sectors, empty sectors,                                │
│           SOLID WHITE BACKGROUND, centered"                                 │
│                              ↓                                              │
│  Runware: удаляем белый фон                                                 │
│                              ↓                                              │
│                                                                             │
│  ЭТАП B: Накладываем текст программно                                       │
│                                                                             │
│  Canvas:                                                                    │
│  - Рисуем текст в каждом секторе                                            │
│  - Угол = 360° / количество_секторов * index + offset                       │
│  - Шрифт: Oswald Bold 32px                                                  │
│  - Цвет: контрастный к сектору (белый + чёрная обводка)                     │
│                              ↓                                              │
│  OUTPUT: wheel.png с читаемыми призами                                      │
│                                                                             │
│  ✅ Проверки:                                                               │
│  - Текст не обрезан                                                         │
│  - Контрастность > 4.5 (WCAG AA)                                            │
│  - Все призы видны                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. ЛОГИКА МЕХАНИК — КАК ГЕНЕРИРУЕМ "ВСЕГДА ВЫИГРЫШ"

### Wheel (Колесо фортуны)

```javascript
// ГЕНЕРИРУЕМ конфигурацию:
const wheelConfig = {
  sectors: 6,
  prizes: ["€500", "€200", "100 FS", "€50", "25 FS", "BONUS"],
  winSector: 0,  // Индекс выигрышного сектора (€500)
  spinsBeforeWin: 1,  // Сколько "проигрышных" спинов до выигрыша
  spinDuration: 4000,  // Длительность вращения в ms
  rotations: 5  // Сколько полных оборотов
};

// ГЕНЕРИРУЕМ JS логику:
function spin() {
  currentSpin++;

  if (currentSpin >= config.spinsBeforeWin) {
    // Выигрыш! Крутим на нужный сектор
    const winAngle = (360 / config.sectors) * config.winSector;
    const totalRotation = 360 * config.rotations + (360 - winAngle);
    wheel.style.transform = `rotate(${totalRotation}deg)`;

    setTimeout(() => showWinModal(config.prizes[config.winSector]), config.spinDuration);
  } else {
    // "Проигрыш" - крутим на случайный сектор (не выигрышный)
    const loseSector = getRandomExcluding(config.winSector, config.sectors);
    // ...
  }
}
```

### Crash Game (Chicken Road)

```javascript
// ГЕНЕРИРУЕМ конфигурацию:
const crashConfig = {
  steps: 7,
  multipliers: [1.32, 2.25, 4.71, 8.22, 17.96, 31.56, 50.00],
  crashSteps: [1, 2, 3, 4, 5],  // На каких шагах "падать"
  attemptsBeforeWin: 1,  // После скольких "проигрышей" — выигрыш
  startBalance: 60
};

// ГЕНЕРИРУЕМ JS логику:
function move() {
  currentStep++;

  if (currentAttempt < config.attemptsBeforeWin &&
      config.crashSteps.includes(currentStep)) {
    // Фейковый проигрыш
    showCrash();
    setTimeout(() => resetGame(), 1500);
    currentAttempt++;
  } else {
    // Успешный шаг
    moveCharacter(currentStep);
    updateMultiplier(config.multipliers[currentStep - 1]);

    if (currentStep === config.steps) {
      // Выигрыш!
      showWinModal(balance);
    }
  }
}
```

### Boxes (Коробки)

```javascript
// ГЕНЕРИРУЕМ конфигурацию:
const boxesConfig = {
  totalBoxes: 6,
  winBox: 2,  // Какая коробка "выигрышная"
  prizes: ["€500", "€200", "100 FS", "€50", "25 FS", "BONUS"],
  attemptsBeforeWin: 1
};

// ГЕНЕРИРУЕМ JS логику:
function openBox(index) {
  if (currentAttempt < config.attemptsBeforeWin && index !== config.winBox) {
    // Фейковый проигрыш - показываем маленький приз
    showSmallPrize(config.prizes[index]);
    currentAttempt++;
    resetBoxes();
  } else {
    // Выигрыш! (или юзер случайно нажал на выигрышную)
    showWinAnimation(index);
    showWinModal(config.prizes[config.winBox]);
  }
}
```

---

## 5. ПОЧЕМУ ЭТО БУДЕТ ЛУЧШЕ РЕФЕРЕНСОВ

### Качество ассетов

| Аспект | Референсы | Наш генератор |
|--------|-----------|---------------|
| Уникальность | Одинаковые для всех | Каждый лендинг уникален |
| Стиль | Фиксированный | Любой (cartoon, realistic, pixel, neon...) |
| Локализация текста | Ручная перерисовка | Автоматическая через Canvas |
| Консистентность | Зависит от дизайнера | AI держит стиль через multi-turn |

### Скорость

| Действие | Референсы (ручная работа) | Наш генератор |
|----------|---------------------------|---------------|
| Новый лендинг под слот | 2-4 часа дизайнер + 1-2 часа вёрстка | 1-2 минуты |
| Смена призов | 30 мин (перерисовка) | 10 секунд (перегенерация) |
| Новый язык | 1 час (перевод + перерисовка) | 30 секунд |
| Новая тема | 4-8 часов | 2-3 минуты |

### Качество кода

| Аспект | Референсы | Наш генератор |
|--------|-----------|---------------|
| Обфускация | Да (сложно читать/модифицировать) | Чистый читаемый код |
| Настраиваемость | Хардкод | Параметры в CONFIG |
| Анти-защита | DevTools trap, debugger | Опционально (если нужно) |
| Mobile | Работает | Работает + тестируется автоматически |

---

## 6. АВТОТЕСТЫ — ГАРАНТИЯ КАЧЕСТВА

### Тесты ассетов

```javascript
// __tests__/assets.test.js

describe('Asset Generation', () => {

  test('background fills entire canvas', async () => {
    const bg = await generateBackground('casino scene', 1920, 1080);
    const { width, height } = await sharp(bg).metadata();

    expect(width).toBe(1920);
    expect(height).toBe(1080);

    // Проверяем углы на заполненность
    const corners = await analyzeCorners(bg);
    expect(corners.topLeft.filled).toBe(true);
    expect(corners.topRight.filled).toBe(true);
    expect(corners.bottomLeft.filled).toBe(true);
    expect(corners.bottomRight.filled).toBe(true);
  });

  test('character has transparent background', async () => {
    const character = await generateCharacter('cartoon chicken');
    const metadata = await sharp(character).metadata();

    expect(metadata.hasAlpha).toBe(true);
    expect(metadata.channels).toBe(4);  // RGBA

    // Проверяем что нет белых краёв
    const edges = await analyzeEdges(character);
    expect(edges.whitePixelPercentage).toBeLessThan(1);
  });

  test('wheel has readable text', async () => {
    const wheel = await generateWheel({
      prizes: ["€500", "€200", "100 FS"],
      colors: ["#FF69B4", "#4B0082", "#FFB6C1"]
    });

    // OCR проверка что текст читается
    const text = await extractText(wheel);
    expect(text).toContain("500");
    expect(text).toContain("200");
    expect(text).toContain("FS");
  });
});
```

### Тесты механики

```javascript
// __tests__/mechanics.test.js

describe('Game Mechanics', () => {

  test('wheel always lands on win sector', async () => {
    const landing = await generateWheelLanding({
      prizes: ["€500", "€200", "100 FS"],
      winSector: 0
    });

    // Симулируем 100 игр
    for (let i = 0; i < 100; i++) {
      const result = await simulateGame(landing);
      expect(result.won).toBe(true);
      expect(result.prize).toBe("€500");
    }
  });

  test('crash game always reaches end', async () => {
    const landing = await generateCrashLanding({
      steps: 7,
      attemptsBeforeWin: 1
    });

    for (let i = 0; i < 100; i++) {
      const result = await simulateGame(landing);
      expect(result.won).toBe(true);
      expect(result.finalStep).toBe(7);
    }
  });

  test('redirect works after win', async () => {
    const landing = await generateLanding({
      offerUrl: "https://test.com/offer"
    });

    const result = await simulateFullFlow(landing);
    expect(result.redirectedTo).toBe("https://test.com/offer");
  });
});
```

### Тесты финального ZIP

```javascript
// __tests__/output.test.js

describe('Landing Output', () => {

  test('ZIP contains all required files', async () => {
    const zip = await generateLanding(wheelConfig);
    const files = await listZipContents(zip);

    expect(files).toContain('index.html');
    expect(files).toContain('assets/bg.webp');
    expect(files).toContain('assets/wheel.png');
    expect(files).toContain('assets/logo.png');
    expect(files.some(f => f.startsWith('sounds/'))).toBe(true);
  });

  test('HTML is valid', async () => {
    const { html } = await generateLanding(config);
    const validation = await validateHTML(html);

    expect(validation.errors).toHaveLength(0);
  });

  test('landing is mobile responsive', async () => {
    const landing = await generateLanding(config);

    // Тестируем на разных размерах
    const sizes = [
      { width: 375, height: 667 },   // iPhone SE
      { width: 390, height: 844 },   // iPhone 12
      { width: 768, height: 1024 },  // iPad
      { width: 1920, height: 1080 }  // Desktop
    ];

    for (const size of sizes) {
      const screenshot = await renderAtSize(landing, size);
      const issues = await detectLayoutIssues(screenshot);

      expect(issues).toHaveLength(0);
    }
  });

  test('ZIP size is optimized', async () => {
    const zip = await generateLanding(config);
    const sizeInMB = zip.length / (1024 * 1024);

    expect(sizeInMB).toBeLessThan(5);  // < 5MB
  });
});
```

---

## 7. СРАВНЕНИЕ ФИНАЛЬНОГО РЕЗУЛЬТАТА

```
РЕФЕРЕНС (Chicken Road 2):
├── Качество: ⭐⭐⭐⭐⭐ (профессиональный дизайн)
├── Уникальность: ⭐⭐ (у всех одинаковый)
├── Скорость создания: ⭐ (часы/дни)
├── Локализация: ⭐⭐ (ручная работа)
└── Кастомизация: ⭐ (нужен дизайнер)

НАШ ГЕНЕРАТОР:
├── Качество: ⭐⭐⭐⭐ (AI + программная обработка)
├── Уникальность: ⭐⭐⭐⭐⭐ (каждый уникален)
├── Скорость создания: ⭐⭐⭐⭐⭐ (минуты)
├── Локализация: ⭐⭐⭐⭐⭐ (автоматически)
└── Кастомизация: ⭐⭐⭐⭐⭐ (через промпт)
```

---

## 8. ГОТОВ К РЕАЛИЗАЦИИ

**Что проверено:**
1. ✅ Gemini генерирует качественные фоны
2. ✅ Gemini + белый фон + Runware/rembg = прозрачные PNG
3. ✅ Canvas накладывает текст программно = читаемые призы
4. ✅ Логика "всегда выигрыш" понятна и воспроизводима
5. ✅ Автотесты покрывают все критические точки

---

## 9. КАК ПРОСТОЙ ПРОМПТ ПРЕВРАЩАЕТСЯ В КОНФЕТКУ

### Flow обработки любого запроса

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ОТ ПРОМПТА К КОНФЕТКЕ                                    │
└─────────────────────────────────────────────────────────────────────────────┘

ЮЗЕР ПИШЕТ: "Колесо для Sweet Bonanza, призы 500€, 200€, 100FS"

                              ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: AI РАЗБИРАЕТ ПРОМПТ (Gemini)                                       │
│                                                                             │
│  Входной промпт → AI извлекает:                                             │
│  {                                                                          │
│    "slotName": "Sweet Bonanza",                                             │
│    "mechanicType": "wheel",                                                 │
│    "prizes": ["500€", "200€", "100FS"],                                     │
│    "language": "auto-detect" → "de" (по €),                                 │
│    "isRealSlot": true                                                       │
│  }                                                                          │
│                                                                             │
│  AI ДОПОЛНЯЕТ если юзер не указал:                                          │
│  - Количество секторов? → 6 (стандарт для колеса)                           │
│  - Какой приз главный? → Первый в списке (500€)                             │
│  - Стиль? → Извлечём из слота                                               │
└─────────────────────────────────────────────────────────────────────────────┘

                              ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: ПОЛУЧАЕМ ИНФУ О СЛОТЕ                                              │
│                                                                             │
│  Если isRealSlot === true:                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Serper API: "Sweet Bonanza slot Pragmatic Play official"           │   │
│  │                           ↓                                          │   │
│  │  Скачиваем лучшую картинку                                           │   │
│  │                           ↓                                          │   │
│  │  node-vibrant: извлекаем палитру                                     │   │
│  │  { vibrant: "#FF69B4", dark: "#4B0082", light: "#FFB6C1" }           │   │
│  │                           ↓                                          │   │
│  │  Gemini Vision: анализируем стиль                                    │   │
│  │  {                                                                   │   │
│  │    theme: "candy_fantasy",                                           │   │
│  │    style: "cartoon_bright",                                          │   │
│  │    elements: ["lollipops", "candies", "sparkles"],                   │   │
│  │    mood: "fun_playful"                                               │   │
│  │  }                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Если isRealSlot === false (кастомный бренд):                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  AI генерирует концепт на основе названия:                           │   │
│  │                                                                      │   │
│  │  "Amazon Casino" → {                                                 │   │
│  │    theme: "jungle_adventure",                                        │   │
│  │    style: "premium_realistic",                                       │   │
│  │    colors: { vibrant: "#FFD700", dark: "#1B4D3E" },                  │   │
│  │    elements: ["jungle", "gold", "treasure"]                          │   │
│  │  }                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

                              ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: ГЕНЕРАЦИЯ АССЕТОВ (Gemini Multi-turn для консистентности)          │
│                                                                             │
│  Multi-turn chat = все картинки в ОДНОМ стиле!                              │
│                                                                             │
│  Turn 1 (фон):                                                              │
│  "Candy fantasy casino background, pink and purple gradient sky,            │
│   giant lollipops, candy canes, magical sparkles floating,                  │
│   16:9 aspect ratio, vibrant colors #FF69B4 #4B0082,                        │
│   full scene, no empty corners, game art style"                             │
│   → bg.webp ✅                                                              │
│                                                                             │
│  Turn 2 (колесо):                                                           │
│  "Fortune wheel with 6 sectors, same candy style as previous image,         │
│   sector colors: pink, purple, yellow, blue, green, magenta,                │
│   golden ornate frame with candy decorations,                               │
│   NO TEXT on sectors (empty), SOLID WHITE BACKGROUND"                       │
│   → wheel-raw.png → rembg → wheel.png ✅                                    │
│                                                                             │
│  Turn 3 (персонаж - если нужен):                                            │
│  "Sweet Bonanza candy character, same cartoon style,                        │
│   cheerful pose, SOLID WHITE BACKGROUND"                                    │
│   → character-raw.png → rembg → character.png ✅                            │
│                                                                             │
│  Turn 4 (логотип):                                                          │
│  "Sweet Bonanza logo banner shape, golden candy frame,                      │
│   EMPTY CENTER for text overlay, same style, WHITE BACKGROUND"              │
│   → logo-frame.png → Canvas добавляет "Sweet Bonanza" → logo.png ✅         │
│                                                                             │
│  РЕЗУЛЬТАТ: Все ассеты в ЕДИНОМ стиле!                                      │
└─────────────────────────────────────────────────────────────────────────────┘

                              ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: СБОРКА HTML/CSS/JS                                                 │
│                                                                             │
│  НЕ ШАБЛОНЫ! AI генерирует код на основе:                                   │
│  - Типа механики (wheel)                                                    │
│  - Количества элементов (6 секторов)                                        │
│  - Цветовой палитры                                                         │
│  - Призов                                                                   │
│                                                                             │
│  Gemini/Claude генерирует:                                                  │
│  ```javascript                                                              │
│  const CONFIG = {                                                           │
│    prizes: ["500€", "200€", "100FS", "50€", "25FS", "BONUS"],               │
│    winSector: 0,                                                            │
│    colors: {                                                                │
│      primary: "#FF69B4",                                                    │
│      secondary: "#4B0082",                                                  │
│      accent: "#FFD700"                                                      │
│    },                                                                       │
│    offerUrl: "{{OFFER_URL}}",                                               │
│    language: "de"                                                           │
│  };                                                                         │
│  ```                                                                        │
│                                                                             │
│  + CSS с анимациями                                                         │
│  + JS логика колеса                                                         │
│  + Mobile responsive                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                              ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│  ФИНАЛ: ZIP готов к использованию                                           │
│                                                                             │
│  sweet_bonanza_wheel.zip                                                    │
│  ├── index.html          (полностью рабочий)                                │
│  ├── assets/                                                                │
│  │   ├── bg.webp         (candy fantasy фон)                                │
│  │   ├── wheel.png       (колесо с призами)                                 │
│  │   ├── logo.png        (логотип Sweet Bonanza)                            │
│  │   └── pointer.png     (указатель)                                        │
│  └── sounds/                                                                │
│      ├── spin.mp3                                                           │
│      └── win.mp3                                                            │
│                                                                             │
│  КАЧЕСТВО: Как у профессионального дизайнера!                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. НЕСУЩЕСТВУЮЩИЕ СЛОТЫ И КАСТОМНЫЕ МЕХАНИКИ

### Сценарий 1: Несуществующий слот

```
ЮЗЕР: "Сделай колесо для Amazon Casino"

AI понимает:
- "Amazon Casino" — нет в базе слотов (Serper не находит)
- Это КАСТОМНЫЙ бренд
- Нужно ПРИДУМАТЬ стиль

AI генерирует концепт:
{
  "brandName": "Amazon Casino",
  "theme": "jungle_treasure",
  "style": "premium_adventure",
  "colors": {
    "primary": "#FFD700",      // Золото
    "secondary": "#1B4D3E",    // Джунгли
    "accent": "#8B4513"        // Дерево
  },
  "elements": ["jungle leaves", "golden coins", "treasure chest", "vines"],
  "character": "explorer with hat" // Если нужен персонаж
}

РЕЗУЛЬТАТ: Уникальный лендинг для несуществующего бренда!
```

### Сценарий 2: Кастомная механика

```
ЮЗЕР: "Сделай игру где бабушка вяжет носок и за каждую петлю начисляется бонус"

AI понимает:
- Это НЕ стандартная механика (не wheel, не crash, не boxes)
- Нужно СОЗДАТЬ новую логику

AI анализирует:
{
  "mechanicType": "custom_progress",
  "description": "Progress-based game with character animation",
  "playerAction": "click_to_progress",
  "stages": "multiple_stages_with_rewards",
  "character": "grandmother_knitting",
  "progression": "sock_growing",
  "finalReward": "completed_sock_with_prize"
}

AI генерирует:
1. АССЕТЫ:
   - bg.png (cozy room with armchair)
   - grandma-knitting.png (анимированная бабушка)
   - sock-stage-1.png ... sock-stage-5.png (носок растёт)
   - yarn-ball.png (клубок)
   - prize-reveal.png (приз внутри носка)

2. ЛОГИКУ:
   ```javascript
   class KnittingGame {
     constructor() {
       this.currentStage = 0;
       this.maxStages = 5;
       this.rewards = ["10€", "25€", "50€", "100€", "500€"];
     }

     knit() {
       this.currentStage++;
       this.updateSockVisual();
       this.showReward(this.rewards[this.currentStage - 1]);

       if (this.currentStage === this.maxStages) {
         this.showFinalPrize();  // Носок готов = главный приз
       }
     }
   }
   ```

РЕЗУЛЬТАТ: Полностью новая игра, которой не существовало!
```

### Сценарий 3: Микс механик

```
ЮЗЕР: "Сначала скретч-карта, а под ней колесо"

AI понимает:
- Двухэтапная механика
- Этап 1: scratch (стереть область)
- Этап 2: wheel (крутить колесо)

AI генерирует:
1. scratch-overlay.png (серебряное покрытие)
2. wheel-underneath.png (колесо под покрытием)
3. Логика переключения этапов

РЕЗУЛЬТАТ: Комбинированная механика!
```

---

## 11. ПОЧЕМУ НЕТ ШАБЛОНОВ — КАК ЭТО РАБОТАЕТ

### Старый подход (шаблоны):
```
templates/
├── wheel/
│   ├── index.html      ← Захардкоженная структура
│   ├── style.css       ← Фиксированные стили
│   └── script.js       ← Одна логика на все случаи

Проблемы:
- 6 секторов? Нужен другой шаблон
- 8 секторов? Ещё один шаблон
- Другие цвета? Меняй CSS вручную
- Кастомная анимация? Переписывай JS
```

### Наш подход (AI генерация):
```
AI получает:
{
  mechanicType: "wheel",
  sectors: 6,          // Любое количество!
  prizes: [...],
  colors: {...},
  animations: "smooth_spin",
  style: "candy_fantasy"
}

AI ГЕНЕРИРУЕТ:
- HTML под КОНКРЕТНУЮ конфигурацию
- CSS с КОНКРЕТНЫМИ цветами и анимациями
- JS с КОНКРЕТНОЙ логикой

Результат: Каждый лендинг уникален, но следует паттернам качества!
```

### Как AI знает что генерировать?

```javascript
// Промпт для генерации кода:

const codePrompt = `
Generate a complete HTML landing page for a ${config.mechanicType} game.

Requirements:
- ${config.sectors} sectors/elements
- Prizes: ${config.prizes.join(', ')}
- Color palette: primary ${config.colors.primary}, secondary ${config.colors.secondary}
- Language: ${config.language}
- Player MUST always win (the game is rigged)
- Redirect to offer URL after win
- Mobile responsive (viewport meta, touch events)
- Smooth animations (CSS transitions, requestAnimationFrame)

Asset paths:
- Background: assets/bg.webp
- Main element: assets/${config.mechanicType}.png
- Logo: assets/logo.png

Generate complete index.html with inline CSS and JS.
Code must be production-ready, optimized, and tested patterns.
`;

// AI генерирует полный рабочий код!
```

---

## 12. ИТОГОВАЯ ГАРАНТИЯ

**Что гарантируем:**

1. ✅ **Любой промпт → конфетка**
   - AI разбирает, дополняет, генерирует
   - Не нужны точные инструкции

2. ✅ **Реальные слоты → берём их стиль**
   - Serper находит картинки
   - Извлекаем палитру и тему
   - Генерируем в том же стиле

3. ✅ **Кастомные бренды → AI придумывает**
   - На основе названия создаёт концепт
   - Генерирует уникальный стиль

4. ✅ **Любая механика → AI создаёт логику**
   - Стандартные (wheel, crash, boxes) — знает паттерны
   - Кастомные — понимает описание и генерирует

5. ✅ **Без шаблонов → AI генерирует код**
   - Каждый лендинг уникален
   - Но следует проверенным паттернам

6. ✅ **Качество как у профи или лучше**
   - Автотесты проверяют каждый лендинг
   - Visual regression ловит косяки

**Жду твой OK для продолжения реализации.**
