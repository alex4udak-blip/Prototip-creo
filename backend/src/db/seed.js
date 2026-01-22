/**
 * Seed скрипт - создаёт тестовых пользователей с invite-ссылками
 * Использование: npm run seed
 */

import crypto from 'crypto';
import { pool, db } from './client.js';
import { log } from '../utils/logger.js';

const TEAM_MEMBERS = ['Alexey', 'Denis', 'Oleg', 'Ilnar', 'Igor'];

async function seed() {
  log.info('🌱 Seeding database...');

  try {
    const inviteLinks = [];

    for (const name of TEAM_MEMBERS) {
      // Генерируем уникальный токен
      const token = crypto.randomBytes(32).toString('hex');

      // Проверяем, есть ли уже такой пользователь
      const existing = await db.getOne('SELECT id FROM users WHERE name = $1', [name]);

      if (existing) {
        // Обновляем токен
        await db.update('users', existing.id, { invite_token: token });
        log.info(`Updated user: ${name}`);
      } else {
        // Создаём нового
        await db.insert('users', { name, invite_token: token });
        log.info(`Created user: ${name}`);
      }

      inviteLinks.push({ name, token });
    }

    // Выводим ссылки
    console.log('\n' + '='.repeat(60));
    console.log('📧 INVITE LINKS (отправь каждому участнику):');
    console.log('='.repeat(60) + '\n');

    for (const { name, token } of inviteLinks) {
      const url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/${token}`;
      console.log(`${name}:`);
      console.log(`  ${url}\n`);
    }

    console.log('='.repeat(60));
    console.log('✅ Seed completed!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    log.error('Seed failed', { error: error.message });
    throw error;
  } finally {
    await pool.end();
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
