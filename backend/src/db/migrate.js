/**
 * Скрипт миграций базы данных
 * Использование:
 *   npm run migrate      - применить миграции
 *   npm run migrate:down - откатить (если нужно)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './client.js';
import { log } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

async function runMigrations() {
  const client = await pool.connect();

  try {
    // Создаём таблицу миграций если её нет
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Получаем список применённых миграций
    const appliedResult = await client.query('SELECT name FROM _migrations ORDER BY id');
    const appliedMigrations = new Set(appliedResult.rows.map(r => r.name));

    // Читаем файлы миграций
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    log.info(`Found ${files.length} migration files`);

    // Применяем новые миграции
    for (const file of files) {
      if (appliedMigrations.has(file)) {
        log.debug(`Skipping ${file} (already applied)`);
        continue;
      }

      log.info(`Applying migration: ${file}`);

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        log.info(`✅ Applied: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        log.error(`❌ Failed: ${file}`, { error: error.message });
        throw error;
      }
    }

    log.info('✅ All migrations completed');
  } finally {
    client.release();
    await pool.end();
  }
}

// Запуск
runMigrations()
  .then(() => process.exit(0))
  .catch((error) => {
    log.error('Migration failed', { error: error.message });
    process.exit(1);
  });
