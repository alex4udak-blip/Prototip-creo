# CLAUDE.md — Инструкции для Claude Code

## Проект

**MST CREO AI (Prototip-creo)** — AI-генератор рекламных баннеров для арбитража трафика.

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
- Google Gemini — gemini-3-pro-image-preview (Nano Banana Pro) для генерации текста + изображений

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

- `backend/src/services/gemini.service.js` — Gemini API (генерация текста + изображений)
- `backend/src/websocket/handler.js` — WebSocket для real-time streaming
- `backend/src/routes/generate.routes.js` — эндпоинт генерации
- `frontend/src/hooks/useChat.js` — Zustand store для чата
- `frontend/src/services/api.js` — API клиент + WebSocket Manager

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
- Drag & drop референсов (до 14 штук)

## ⚠️ КРИТИЧЕСКИЕ ПРАВИЛА (НЕ НАРУШАТЬ!)

1. **МОДЕЛЬ НЕ МЕНЯТЬ** — используем ТОЛЬКО `gemini-3-pro-image-preview` (Nano Banana Pro)
2. **Изображения ВСЕГДА в истории** — картинки должны сохраняться в чат-сессии и отображаться
3. **ai.chats.create()** — используем чат-сессии Gemini для сохранения контекста диалога
4. **Не переписывать gemini.service.js** без явного запроса пользователя
