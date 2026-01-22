# =====================================================
# BannerGen Dockerfile - Multi-stage build
# =====================================================

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Копируем package files
COPY frontend/package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходники
COPY frontend/ ./

# Собираем production build
RUN npm run build

# =====================================================
# Stage 2: Production Image
# =====================================================
FROM node:20-alpine

WORKDIR /app

# Устанавливаем зависимости для sharp (обработка изображений) и bash
RUN apk add --no-cache \
    bash \
    python3 \
    make \
    g++ \
    vips-dev

# Копируем package files backend
COPY backend/package*.json ./backend/

# Устанавливаем зависимости backend
WORKDIR /app/backend
RUN npm ci --only=production

# Копируем backend
COPY backend/ ./

# Копируем собранный frontend
COPY --from=frontend-builder /app/frontend/dist ../frontend/dist

# Копируем start.sh
WORKDIR /app
COPY start.sh ./
RUN chmod +x start.sh

# Создаём директорию для uploads
RUN mkdir -p /app/uploads && chmod 777 /app/uploads

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_PATH=/app/uploads

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start using start.sh (Railway will override with startCommand)
CMD ["/app/start.sh"]
