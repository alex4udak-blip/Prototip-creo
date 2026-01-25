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

  // Allowed tables and columns (whitelist for SQL injection protection)
  _allowedTables: new Set(['chats', 'messages', 'users', 'landings', 'landing_ratings', 'landing_examples', 'generation_feedback', 'generation_stats', 'landing_assets', 'landing_templates', 'slot_library', 'sound_library', 'saved_styles', 'size_presets']),
  _allowedColumnPattern: /^[a-z_][a-z0-9_]*$/i,

  // Validate identifier (table or column name)
  _validateIdentifier(name, type = 'identifier') {
    if (typeof name !== 'string' || !this._allowedColumnPattern.test(name)) {
      throw new Error(`Invalid ${type} name: ${name}`);
    }
    return name;
  },

  // Validate table name against whitelist
  _validateTable(table) {
    if (!this._allowedTables.has(table)) {
      throw new Error(`Table not allowed: ${table}`);
    }
    return table;
  },

  // INSERT и вернуть вставленную строку (SQL injection protected)
  async insert(table, data) {
    // Validate table name
    this._validateTable(table);

    const keys = Object.keys(data);
    const values = Object.values(data);

    // Validate all column names
    keys.forEach(k => this._validateIdentifier(k, 'column'));

    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.map(k => `"${k}"`).join(', '); // Quote identifiers

    const text = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.query(text, values);
    return result.rows[0];
  },

  // UPDATE и вернуть обновлённую строку (SQL injection protected)
  async update(table, id, data) {
    // Validate table name
    this._validateTable(table);

    const keys = Object.keys(data);
    const values = Object.values(data);

    // Validate all column names
    keys.forEach(k => this._validateIdentifier(k, 'column'));

    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');

    const text = `UPDATE "${table}" SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
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
