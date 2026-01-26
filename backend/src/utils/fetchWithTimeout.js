/**
 * Fetch with timeout wrapper
 * Prevents hanging requests that can block the entire system
 * Includes SSRF protection to block internal network access
 */

/**
 * Default timeout in milliseconds (30 seconds)
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Allowed protocols for external fetches
 */
const ALLOWED_PROTOCOLS = ['https:', 'http:'];

/**
 * Private/internal IP ranges that should be blocked (SSRF protection)
 */
const PRIVATE_IP_PATTERNS = [
  /^127\./,                          // Loopback
  /^10\./,                           // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // Private Class B
  /^192\.168\./,                     // Private Class C
  /^169\.254\./,                     // Link-local
  /^0\./,                            // Current network
  /^224\./,                          // Multicast
  /^240\./,                          // Reserved
  /^255\./,                          // Broadcast
  /^::1$/,                           // IPv6 loopback
  /^fe80:/i,                         // IPv6 link-local
  /^fc00:/i,                         // IPv6 unique local
  /^fd00:/i,                         // IPv6 unique local
];

/**
 * Blocked hostnames
 */
const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  '169.254.169.254',  // Cloud metadata endpoint
];

/**
 * Validate URL for SSRF protection
 * @param {string} urlString - URL to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUrlForSSRF(urlString) {
  try {
    const url = new URL(urlString);

    // Check protocol
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
      return { valid: false, error: `Protocol ${url.protocol} not allowed` };
    }

    // Check blocked hostnames
    const hostname = url.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      return { valid: false, error: `Hostname ${hostname} is blocked` };
    }

    // Check for private IP patterns
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, error: `Private IP address not allowed: ${hostname}` };
      }
    }

    // Check for IPv6 brackets
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      const ipv6 = hostname.slice(1, -1);
      for (const pattern of PRIVATE_IP_PATTERNS) {
        if (pattern.test(ipv6)) {
          return { valid: false, error: `Private IPv6 address not allowed: ${ipv6}` };
        }
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Fetch with timeout support and SSRF protection
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} [options.timeout] - Timeout in milliseconds (default: 30000)
 * @param {boolean} [options.skipSSRFCheck] - Skip SSRF validation (for trusted internal calls only)
 * @returns {Promise<Response>}
 * @throws {Error} When timeout is reached, fetch fails, or SSRF validation fails
 */
export async function fetchWithTimeout(url, options = {}) {
  const { timeout = DEFAULT_TIMEOUT, skipSSRFCheck = false, ...fetchOptions } = options;

  // SSRF protection - validate URL before fetching
  if (!skipSSRFCheck) {
    const validation = validateUrlForSSRF(url);
    if (!validation.valid) {
      throw new Error(`SSRF protection: ${validation.error}`);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch JSON with timeout
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options with optional timeout
 * @returns {Promise<any>} Parsed JSON response
 */
export async function fetchJsonWithTimeout(url, options = {}) {
  const response = await fetchWithTimeout(url, options);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export default { fetchWithTimeout, fetchJsonWithTimeout, validateUrlForSSRF };
