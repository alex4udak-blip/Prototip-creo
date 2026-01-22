# 🎨 BannerGen (Prototip-creo)

AI-генератор рекламных баннеров для арбитража трафика. Интерфейс как у Claude.ai.

## ✨ Возможности

- **Умные промпты** — пишите на русском, Claude AI улучшит запрос
- **Три AI модели** — FLUX Dev (качество), Schnell (скорость), Nano Banana (текст)
- **Референсы** — drag & drop картинки для стилизации
- **Real-time** — WebSocket для отслеживания генерации
- **История чатов** — как в Claude.ai

## 🚀 Быстрый старт

### Локально (Docker)

```bash
# Клонируем
git clone https://github.com/alex4udak-blip/Prototip-creo.git
cd Prototip-creo

# Копируем env
cp .env.example .env
# Заполняем API ключи в .env

# Запускаем
docker-compose up -d

# Миграции
docker-compose exec app npm run migrate -C /app/backend

# Создаём invite-ссылки
docker-compose exec app npm run seed -C /app/backend
```

Открываем http://localhost:3000

### Локально (без Docker)

```bash
# Backend
cd backend
npm install
cp ../.env.example .env
# Заполняем .env
npm run migrate
npm run dev

# Frontend (в другом терминале)
cd frontend
npm install
npm run dev
```

Backend: http://localhost:3000
Frontend: http://localhost:5173

## 🔑 API Ключи

| Сервис | Где получить | Переменная |
|--------|--------------|------------|
| Claude | [console.anthropic.com](https://console.anthropic.com) | `ANTHROPIC_API_KEY` |
| Runware | [my.runware.ai](https://my.runware.ai) → API Keys | `RUNWARE_API_KEY` |
| Google AI | [aistudio.google.com](https://aistudio.google.com/apikey) | `GOOGLE_API_KEY` |

## 🚂 Деплой на Railway

1. Создай проект на [railway.app](https://railway.app)
2. Добавь PostgreSQL: `+ New` → `Database` → `PostgreSQL`
3. Добавь сервис из GitHub
4. Настрой переменные (Variables):

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<сгенерируй>
ANTHROPIC_API_KEY=<твой ключ>
RUNWARE_API_KEY=<твой ключ>
GOOGLE_API_KEY=<твой ключ>
NODE_ENV=production
```

5. Добавь Volume для картинок:
   - Settings → Volumes → Mount: `/app/uploads`

6. Деплой запустится автоматически

### После деплоя

```bash
# Создаём invite-ссылки
railway run npm run seed -C backend
```

## 📁 Структура

```
prototip-creo/
├── frontend/          # React + Vite + Tailwind
│   └── src/
│       ├── components/  # UI компоненты
│       ├── hooks/       # Zustand stores
│       ├── pages/       # Страницы
│       └── services/    # API клиент
├── backend/           # Node.js + Express
│   └── src/
│       ├── routes/      # API endpoints
│       ├── services/    # Claude, Runware, Google
│       ├── db/          # PostgreSQL + миграции
│       └── websocket/   # Real-time updates
├── Dockerfile
├── docker-compose.yml
└── railway.toml
```

## 🎯 API Endpoints

```
POST /api/auth/invite/:token  # Вход по ссылке
GET  /api/auth/me             # Текущий пользователь

GET  /api/chats               # Список чатов
POST /api/chats               # Новый чат
GET  /api/chats/:id           # Чат с сообщениями

POST /api/generate            # Генерация баннера
POST /api/generate/upload     # Загрузка референса
GET  /api/generate/models     # Доступные модели
GET  /api/generate/presets    # Пресеты размеров
```

## 🤖 Логика выбора модели

```
Запрос пользователя
        ↓
Claude улучшает промпт
        ↓
Анализ задачи:
├─ Нужен текст? → Google Nano Banana
├─ Есть референс? → FLUX Kontext
├─ Быстро/черновик? → FLUX Schnell
└─ Качество? → FLUX Dev
        ↓
Генерация → Результат
```

## 👥 Команда

Доступ по invite-ссылкам. После деплоя запусти `npm run seed` для создания ссылок.

---

Made with ❤️ and AI
