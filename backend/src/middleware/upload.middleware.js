import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

// Создаём директорию для загрузок если её нет
const uploadsDir = config.storagePath;
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  log.info(`Created uploads directory: ${uploadsDir}`);
}

// Настройка хранилища
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя: uuid + оригинальное расширение
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

// Фильтр файлов - только изображения
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Неподдерживаемый тип файла: ${file.mimetype}. Разрешены: JPEG, PNG, WebP, GIF`), false);
  }
};

// Основной middleware для загрузки
export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSize, // 10MB по умолчанию
    files: 1 // Максимум 1 файл за раз
  }
});

// Обработка ошибок multer
export function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Файл слишком большой',
        message: `Максимальный размер: ${config.maxFileSize / 1024 / 1024}MB`
      });
    }
    return res.status(400).json({ error: err.message });
  }

  if (err) {
    return res.status(400).json({ error: err.message });
  }

  next();
}

/**
 * Получить публичный URL для загруженного файла
 */
export function getFileUrl(filename, req) {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/uploads/${filename}`;
}

/**
 * Удалить файл
 */
export function deleteFile(filename) {
  const filepath = path.join(uploadsDir, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    log.debug(`Deleted file: ${filename}`);
    return true;
  }
  return false;
}
