import pg from 'pg';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

const { Pool } = pg;

// Создаём пул соединений
export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Обработка ошибок пула
pool.on('error', (err) => {
  log.error('Unexpected database pool error', { error: err.message });
});

// Тест подключения
export async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    log.info('✅ Database connected', { time: result.rows[0].now });
    return true;
  } catch (error) {
    log.error('❌ Database connection failed', { error: error.message });
    return false;
  }
}

// Хелперы для запросов
export const db = {
  // Один запрос
  async query(text, params) {
    const start = Date.now();
    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      log.debug('Query executed', { text: text.substring(0, 100), duration, rows: result.rowCount });
      return result;
    } catch (error) {
      log.error('Query error', { text: text.substring(0, 100), error: error.message });
      throw error;
    }
  },

  // Получить одну строку
  async getOne(text, params) {
    const result = await this.query(text, params);
    return result.rows[0] || null;
  },

  // Получить все строки
  async getMany(text, params) {
    const result = await this.query(text, params);
    return result.rows;
  },

  // INSERT и вернуть вставленную строку
  async insert(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');

    const text = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.query(text, values);
    return result.rows[0];
  },

  // UPDATE и вернуть обновлённую строку
  async update(table, id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');

    const text = `UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
    const result = await this.query(text, [...values, id]);
    return result.rows[0];
  },

  // Транзакция
  async transaction(callback) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};
