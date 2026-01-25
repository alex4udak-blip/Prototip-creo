# Landing Generator — Слоёная Архитектура Ассетов

> Детальная документация по структуре слоёв для каждой игровой механики.
> Критично для правильной генерации и работы анимаций.

## Ключевые принципы

1. **Лендинги = НАБОР PNG/WebP слоёв**, не монолитные изображения
2. **Каждый слой генерируется отдельно** через multi-turn Gemini chat
3. **Текст на вращающихся элементах** должен быть частью того же слоя
4. **Z-index определяет порядок** наложения и видимости
5. **Gemini не умеет прозрачный фон** — генерируем на белом + Runware rembg

---

## 🎡 Механика: WHEEL (Fortune Wheel)

### Структура слоёв

```
z-index: 7  │ wheel-center.webp     │ STATIC  │ Центральная кнопка "SPIN"
z-index: 6  │ wheel-pointer.webp    │ STATIC  │ Стрелка указатель (сверху)
z-index: 6  │ wheel-frame.webp      │ STATIC  │ Внешняя рамка колеса
z-index: 5  │ wheel-sectors.webp    │ ROTATES │ Сектора с призами + ТЕКСТ
z-index: 4  │ effect-rings.webp     │ ANIMATED│ Свечение, кольца эффектов
z-index: 1  │ bg.webp               │ STATIC  │ Фон сцены
```

### Критические детали

**wheel-sectors.webp (ВРАЩАЕТСЯ)**
- Содержит ВСЕ сектора с цветами
- **ТЕКСТ ПРИЗОВ** ("1500€", "100€") — ЧАСТЬ ЭТОГО СЛОЯ
- При вращении текст крутится вместе с секторами
- 8 секторов по 45° каждый
- CSS transform: rotate() применяется к этому слою

**wheel-frame.webp (СТАТИКА)**
- Декоративная рамка
- pointer-events: none — не блокирует клики
- Остаётся неподвижной при вращении

**wheel-pointer.webp (СТАТИКА)**
- Стрелка указатель сверху
- Указывает на выигрышный сектор
- Может иметь bounce анимацию при остановке

### CSS анимации (из реальных лендингов)

```css
/* Ожидание — лёгкое покачивание */
@keyframes spinWheel {
  0%, 100% { transform: rotate(-40deg); }
  50% { transform: rotate(-52deg); }
}

/* Вращение к сектору 1 (главный приз) */
@keyframes spinTo1 {
  0% { transform: rotate(-44deg); }
  100% { transform: rotate(1080deg); }  /* 3 полных оборота */
}

/* После остановки — лёгкая качка */
@keyframes spinner-win {
  0%, 100% { transform: rotate(1080deg); }
  50% { transform: rotate(1085deg); }
}
```

### Промпты для генерации слоёв

```
Turn 1 (sectors):
"Generate a fortune wheel with 8 colored sectors on WHITE BACKGROUND.
Each sector has prize text: 1500€, 100€, 50€, 25€, 10€, etc.
Text must be clearly readable, gold/white colors.
Candy/casino style, vibrant colors, NO outer frame, NO center button.
Resolution: 1024x1024, wheel fills 90% of frame."

Turn 2 (frame):
"Generate a circular decorative golden frame on WHITE BACKGROUND.
Same candy/casino style as previous image.
The center is COMPLETELY EMPTY (transparent hole).
Ornate golden border with gems and sparkles.
Resolution: 1024x1024, frame is a ring shape."

Turn 3 (pointer):
"Generate a golden arrow pointer on WHITE BACKGROUND.
Same style. Points downward. Has gem/crystal at tip.
Used to indicate winning sector.
Resolution: 512x512."

Turn 4 (center button):
"Generate a circular SPIN button on WHITE BACKGROUND.
Golden with text 'SPIN' in center.
Same candy/casino style. 3D appearance with glow.
Resolution: 512x512."
```

---

## 📦 Механика: BOXES (Gift Boxes / Chests)

### Структура слоёв

```
z-index: 50 │ reward-popup.webp     │ MODAL   │ Всплывающий приз
z-index: 40 │ speech-bubble.webp    │ ANIMATED│ Облачко с текстом персонажа
z-index: 30 │ character.webp        │ ANIMATED│ Персонаж/маскот
z-index: 20 │ box-open.webp         │ STATE   │ Открытый бокс
z-index: 20 │ box-closed.webp       │ STATE   │ Закрытый бокс
z-index: 10 │ progress-bar.webp     │ UI      │ Прогресс бар
z-index: 1  │ bg.webp               │ STATIC  │ Фон
```

### Состояния боксов

```
CLOSED → SHAKING → OPENING → OPEN → GLOW
```

**box-closed.webp**
- Закрытый подарочный бокс
- Анимации: shake, teaseJump, teaseWiggle

**box-open.webp**
- Открытый бокс с видимым призом
- Эффекты: glow, sparkles, shine

### CSS анимации

```css
@keyframes epicShake {
  0%, 100% { transform: translateX(0) rotate(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-2px) rotate(-1deg); }
  20%, 40%, 60%, 80% { transform: translateX(2px) rotate(1deg); }
}

@keyframes teaseJump {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes teaseWiggle {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(-3deg); }
  75% { transform: rotate(3deg); }
}
```

### Промпты для генерации

```
Turn 1 (closed box):
"Generate a gift box/treasure chest CLOSED on WHITE BACKGROUND.
Candy/Christmas style, golden ribbons, red/gold colors.
Slight glow around edges, 3D perspective.
Resolution: 512x512."

Turn 2 (open box):
"Generate the SAME gift box but OPEN, lid lifted.
Golden light rays coming from inside.
Same style as previous. Sparkles and glow effects.
Resolution: 512x512."

Turn 3 (character):
"Generate a cute mascot character on WHITE BACKGROUND.
Same style. Excited expression, waving.
Full body, slightly angled pose.
Resolution: 512x512."
```

---

## 🐔 Механика: CHICKEN ROAD / CRASH

### Структура слоёв

```
z-index: 30 │ character-lose.webp   │ STATE   │ Персонаж при проигрыше
z-index: 30 │ character-normal.webp │ STATE   │ Персонаж в норме
z-index: 25 │ feathers.webp         │ EFFECT  │ Перья при столкновении
z-index: 20 │ multiplier-badge.webp │ UI      │ Бейдж с множителем (1.32x)
z-index: 15 │ sector-active.webp    │ STATE   │ Золотой активный сектор
z-index: 15 │ sector-default.webp   │ STATE   │ Серый неактивный сектор
z-index: 10 │ barrier.webp          │ STATIC  │ Барьер/препятствие
z-index: 10 │ car-{1-7}.webp        │ ANIMATED│ Машины (едут)
z-index: 1  │ bg-desktop.webp       │ STATIC  │ Фон дороги
```

### Логика механики

1. Персонаж перемещается через "дорогу"
2. На каждом уровне множитель увеличивается
3. При попадании машины — "crash" и lose state
4. "Always win" — игрок всегда доходит до конца

### Анимации

```css
/* Движение машин */
@keyframes carMove {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100vw); }
}

/* Прыжок персонажа */
@keyframes jump {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-30px); }
}
```

---

## 🏗️ Механика: TOWER RUSH / STACKER

### Структура слоёв

```
z-index: 40 │ hook.webp             │ ANIMATED│ Крюк крана (качается)
z-index: 35 │ rope.webp             │ ANIMATED│ Трос крана
z-index: 30 │ build-{1-4}.webp      │ STACKING│ Блоки зданий
z-index: 25 │ explode.webp          │ EFFECT  │ Взрыв при падении
z-index: 20 │ ground-left.webp      │ STATIC  │ Земля слева
z-index: 20 │ ground-right.webp     │ STATIC  │ Земля справа
z-index: 15 │ street.webp           │ STATIC  │ Улица
z-index: 10 │ sun.webp              │ ANIMATED│ Солнце (пульсирует)
z-index: 5  │ cloud.webp            │ ANIMATED│ Облака (движутся)
z-index: 1  │ sky.webp              │ STATIC  │ Небо фон
```

### Логика стекинга

- Блоки падают сверху
- Игрок кликает чтобы "приземлить"
- Успешное приземление = +1 уровень
- Промах = конец игры (но always win)

### CSS анимации

```css
@keyframes drop {
  0% { transform: translateY(-100vh); }
  100% { transform: translateY(0); }
}

@keyframes hookSwing {
  0%, 100% { transform: rotate(-10deg); }
  50% { transform: rotate(10deg); }
}
```

---

## 🎣 Механика: ICE FISHING

### Структура слоёв

```
z-index: 50 │ fish-caught.webp      │ MODAL   │ Пойманная рыба (приз)
z-index: 40 │ crane.webp            │ ANIMATED│ Удочка/кран
z-index: 35 │ helicopter.webp       │ ANIMATED│ Вертолёт декор
z-index: 30 │ fish-preview-{type}.webp│ UI    │ Превью рыб
z-index: 25 │ ice.webp              │ STATIC  │ Поверхность льда
z-index: 20 │ wheel-sectors.webp    │ ROTATES │ Колесо (как в wheel)
z-index: 20 │ wheel-frame.webp      │ STATIC  │ Рамка колеса
z-index: 15 │ wheel-ring.webp       │ STATIC  │ Кольцо колеса
z-index: 10 │ fishes-video.webm     │ VIDEO   │ Плавающие рыбы (видео!)
z-index: 1  │ aqua-bg.webp          │ STATIC  │ Подводный фон
```

### Особенности

- Использует VIDEO (webm) для плавающих рыб
- Комбинирует wheel механику с fishing темой
- Сложная многоэтапная анимация

---

## 🎲 Механика: BOARD GAME (Monopoly-style)

### Структура слоёв

```
z-index: 100│ confetti-canvas       │ EFFECT  │ Конфетти (canvas)
z-index: 50 │ win-modal.webp        │ MODAL   │ Модал выигрыша
z-index: 40 │ dice-{1-6}.webp       │ ANIMATED│ Грани кубиков
z-index: 30 │ chip.webp             │ MOVING  │ Фишка игрока
z-index: 20 │ board.png             │ STATIC  │ Игровое поле
z-index: 15 │ corner-decorations    │ STATIC  │ Золотые уголки
z-index: 10 │ spotlight.webp        │ ANIMATED│ Прожекторы
z-index: 5  │ curtain-left.webp     │ ANIMATED│ Левая штора
z-index: 5  │ curtain-right.webp    │ ANIMATED│ Правая штора
z-index: 1  │ bg.webp               │ STATIC  │ Сцена/театр фон
```

### Особенности

- Театральная анимация открытия (шторы)
- Кубики с программной сменой граней
- Фишка перемещается по заранее заданному пути
- Прожекторы с beam эффектами

### CSS для театрального эффекта

```css
/* Открытие штор */
.curtain-left {
  transform-origin: left center;
  transition: transform 2s cubic-bezier(0.4, 0, 0.2, 1);
}

.curtain-overlay.open .curtain-left {
  transform: translateX(-92%) rotateY(-15deg);
}

/* Прожекторы */
@keyframes beam1 {
  0% { transform: rotate(-50deg); opacity: 0.5; }
  100% { transform: rotate(-20deg); opacity: 1; }
}
```

---

## 📐 Размеры и форматы

### Рекомендуемые размеры

| Элемент | Desktop | Mobile | Формат |
|---------|---------|--------|--------|
| Background | 1920x1080 | 1080x1920 | WebP |
| Wheel sectors | 1024x1024 | 800x800 | WebP |
| Wheel frame | 1200x1200 | 900x900 | WebP |
| Character | 512x768 | 400x600 | WebP |
| Box/Chest | 512x512 | 400x400 | WebP |
| Button | 512x160 | 400x120 | WebP |
| Icons | 128x128 | 96x96 | WebP |

### Формат файлов

- **WebP** — основной (качество 85-90%)
- **PNG** — для элементов с прозрачностью
- **WebM** — для видео эффектов
- **GIF** — для простых анимаций (coins rain, sparkles)

---

## 🔄 Pipeline генерации

### Multi-turn Gemini Chat Strategy

```javascript
// Session 1: Wheel Generation
const wheelSession = ai.chats.create({...});

// Turn 1: Generate sectors WITH text
await wheelSession.sendMessage(sectorPrompt);

// Turn 2: Generate frame (same style, reference previous)
await wheelSession.sendMessage(framePrompt);

// Turn 3: Generate pointer
await wheelSession.sendMessage(pointerPrompt);

// Turn 4: Generate center button
await wheelSession.sendMessage(centerPrompt);

// Gemini maintains style consistency across turns!
```

### Post-processing Pipeline

```
1. Gemini generates on WHITE background
2. Runware imageBackgroundRemoval() → transparent PNG
3. Sharp optimization → WebP
4. Store in /uploads with UUID
```

---

## 🎨 Стилизация текста на слоях

### Текст на секторах колеса

**ВАЖНО:** Текст призов ("1500€", "100€") должен быть:
- Частью wheel-sectors.webp
- Генерироваться вместе с секторами
- НЕ накладываться программно (иначе не будет вращаться)

### Промпт для текста на секторах

```
"Generate fortune wheel sectors with 8 segments.
TEXT ON EACH SECTOR (clockwise from top):
- Sector 1: "1500€" (gold text, largest)
- Sector 2: "100€"
- Sector 3: "50€"
- Sector 4: "25€"
- Sector 5: "10€"
- Sector 6: "100€"
- Sector 7: "50€"
- Sector 8: "25€"

Text style: 3D gold with black outline, rotated to fit sector angle.
Font: Bold, casino style, clearly readable.
WHITE BACKGROUND for transparency removal."
```

---

## 📋 Checklist для новой механики

- [ ] Определить все слои и их z-index
- [ ] Определить что ВРАЩАЕТСЯ vs СТАТИКА
- [ ] Определить состояния (closed/open, normal/win)
- [ ] Определить где размещается текст
- [ ] Определить анимации (CSS keyframes)
- [ ] Создать промпты для каждого слоя
- [ ] Протестировать генерацию в multi-turn chat
- [ ] Проверить консистентность стиля
- [ ] Протестировать сборку в HTML

---

## Дальнейшие шаги

1. Реализовать `LandingGeneratorService` с multi-turn chat
2. Добавить механику выбора типа игры (wheel/boxes/crash/etc)
3. Интегрировать Runware background removal
4. Создать HTML template generator для сборки лендинга
5. Добавить preview и редактирование
