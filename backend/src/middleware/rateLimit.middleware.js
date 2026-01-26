/**
 * Rate Limiting Middleware
 * Protects API from brute force and DoS attacks
 */

import rateLimit from 'express-rate-limit';
import { log } from '../utils/logger.js';

/**
 * Standard key generator - uses IP address
 */
const standardKeyGenerator = (req) => {
  // Use X-Forwarded-For header if behind a proxy (Railway, Cloudflare, etc.)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // Take the first IP in the chain (client IP)
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

/**
 * User-based key generator - uses user ID when authenticated, IP otherwise
 */
const userKeyGenerator = (req) => {
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  return `ip:${standardKeyGenerator(req)}`;
};

/**
 * Rate limit exceeded handler
 */
const onLimitReached = (req, res, options) => {
  log.warn('Rate limit exceeded', {
    ip: standardKeyGenerator(req),
    userId: req.user?.id,
    path: req.path,
    method: req.method,
    limit: options.limit,
    windowMs: options.windowMs
  });
};

/**
 * Global rate limiter - applies to all routes
 * 100 requests per minute per IP
 */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: standardKeyGenerator,
  handler: (req, res, next, options) => {
    onLimitReached(req, res, options);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please wait before making more requests',
      retryAfter: Math.ceil(options.windowMs / 1000)
    });
  }
});

/**
 * Auth rate limiter - stricter for login/registration endpoints
 * 5 attempts per 15 minutes per IP (brute force protection)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: standardKeyGenerator,
  skipSuccessfulRequests: true, // Only count failed attempts
  handler: (req, res, next, options) => {
    onLimitReached(req, res, options);
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Please wait 15 minutes before trying again',
      retryAfter: Math.ceil(options.windowMs / 1000)
    });
  }
});

/**
 * Generation rate limiter - limits AI generation requests
 * 10 requests per minute per user (prevents API cost abuse)
 */
export const generationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: (req, res, next, options) => {
    onLimitReached(req, res, options);
    res.status(429).json({
      error: 'Generation limit exceeded',
      message: 'You are generating too fast. Please wait a moment.',
      retryAfter: Math.ceil(options.windowMs / 1000)
    });
  }
});

/**
 * API read rate limiter - for GET endpoints
 * 200 requests per minute per IP (more lenient for reads)
 */
export const readLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: standardKeyGenerator,
  handler: (req, res, next, options) => {
    onLimitReached(req, res, options);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please slow down your requests',
      retryAfter: Math.ceil(options.windowMs / 1000)
    });
  }
});

/**
 * Upload rate limiter - for file uploads
 * 20 uploads per minute per user
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: (req, res, next, options) => {
    onLimitReached(req, res, options);
    res.status(429).json({
      error: 'Upload limit exceeded',
      message: 'Too many file uploads. Please wait.',
      retryAfter: Math.ceil(options.windowMs / 1000)
    });
  }
});

/**
 * WebSocket connection rate limiter helper
 * Returns true if connection should be rejected
 */
const wsConnectionCounts = new Map();
const WS_WINDOW_MS = 60 * 1000; // 1 minute
const WS_MAX_CONNECTIONS = 10; // Max connections per IP per minute

export function checkWebSocketRateLimit(ip) {
  const now = Date.now();
  const key = ip || 'unknown';

  // Clean up old entries
  for (const [k, data] of wsConnectionCounts.entries()) {
    if (now - data.timestamp > WS_WINDOW_MS) {
      wsConnectionCounts.delete(k);
    }
  }

  const current = wsConnectionCounts.get(key);

  if (!current) {
    wsConnectionCounts.set(key, { count: 1, timestamp: now });
    return false; // Allow
  }

  if (now - current.timestamp > WS_WINDOW_MS) {
    wsConnectionCounts.set(key, { count: 1, timestamp: now });
    return false; // Allow
  }

  if (current.count >= WS_MAX_CONNECTIONS) {
    log.warn('WebSocket rate limit exceeded', { ip: key, count: current.count });
    return true; // Reject
  }

  current.count++;
  return false; // Allow
}

export default {
  globalLimiter,
  authLimiter,
  generationLimiter,
  readLimiter,
  uploadLimiter,
  checkWebSocketRateLimit
};
