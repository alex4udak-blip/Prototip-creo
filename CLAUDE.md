# CLAUDE.md — Инструкции для Claude Code

## Проект

**BannerGen (Prototip-creo)** — AI-генератор рекламных баннеров для арбитража трафика.

## Структура

```
prototip-creo/
├── frontend/          # React 18 + Vite + Tailwind
├── backend/           # Node.js + Express + PostgreSQL
├── Dockerfile         # Multi-stage build
├── docker-compose.yml # Локальная разработка
└── railway.toml       # Railway deployment
```

## Технологии

**Backend:**
- Node.js 20 + Express
- PostgreSQL + raw SQL (без ORM)
- WebSocket (ws library)
- JWT авторизация

**Frontend:**
- React 18 + Vite
- Tailwind CSS (тёмная тема)
- Zustand для state
- React Router DOM

**AI APIs:**
- Claude API — улучшение промптов
- Runware API — FLUX Dev/Schnell/Kontext
- Google AI — Nano Banana Pro (текст)

## Команды

```bash
# Backend
cd backend
npm run dev        # Разработка
npm run migrate    # Миграции
npm run seed       # Создать invite-ссылки

# Frontend
cd frontend
npm run dev        # Разработка
npm run build      # Production build

# Docker
docker-compose up -d
```

## Ключевые файлы

- `backend/src/services/router.service.js` — логика выбора модели
- `backend/src/services/prompt.service.js` — Claude API
- `backend/src/services/runware.service.js` — Runware API
- `backend/src/services/google.service.js` — Google Nano Banana
- `backend/src/websocket/handler.js` — WebSocket для real-time
- `frontend/src/hooks/useChat.js` — Zustand store для чата

## API Routes

```
POST /api/auth/invite/:token  # Вход
POST /api/generate            # Генерация
GET  /api/chats               # История
```

## Railway Deployment

1. Push to GitHub → автодеплой
2. Variables: DATABASE_URL, JWT_SECRET, API keys
3. Volume: /app/uploads для картинок

## Особенности

- Invite-only доступ (5 пользователей)
- WebSocket для отслеживания генерации
- Автовыбор модели по задаче
- Drag & drop референсов
