/**
 * Fetch with timeout wrapper
 * Prevents hanging requests that can block the entire system
 */

/**
 * Default timeout in milliseconds (30 seconds)
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Fetch with timeout support
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} [options.timeout] - Timeout in milliseconds (default: 30000)
 * @returns {Promise<Response>}
 * @throws {Error} When timeout is reached or fetch fails
 */
export async function fetchWithTimeout(url, options = {}) {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

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

export default { fetchWithTimeout, fetchJsonWithTimeout };
