/**
 * Database Connection Module
 * Re-exports pool and helpers from client.js for cleaner imports
 */

export { pool, db, testConnection } from './client.js';
