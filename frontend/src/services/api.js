/**
 * API Client для MST CREO AI
 */

const API_BASE = '/api';
export const API_BASE_URL = '/api';

// Получаем токен из localStorage
function getToken() {
  return localStorage.getItem('mstcreo_token');
}

// Базовый fetch с авторизацией
async function fetchAPI(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // Если 401 — очищаем токен
  if (response.status === 401) {
    localStorage.removeItem('mstcreo_token');
    localStorage.removeItem('mstcreo_user');
    window.location.href = '/';
    throw new Error('Unauthorized');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Ошибка запроса');
  }

  return data;
}

// ==========================================
// Auth API
// ==========================================

export const authAPI = {
  // Вход по invite-ссылке
  async loginWithInvite(token) {
    const data = await fetchAPI(`/auth/invite/${token}`);
    localStorage.setItem('mstcreo_token', data.token);
    localStorage.setItem('mstcreo_user', JSON.stringify(data.user));
    return data;
  },

  // Получить текущего пользователя
  async getMe() {
    return fetchAPI('/auth/me');
  },

  // Обновить токен
  async refreshToken() {
    const data = await fetchAPI('/auth/refresh', { method: 'POST' });
    localStorage.setItem('mstcreo_token', data.token);
    return data;
  },

  // Выход
  logout() {
    localStorage.removeItem('mstcreo_token');
    localStorage.removeItem('mstcreo_user');
  },

  // Проверить авторизован ли
  isAuthenticated() {
    return !!getToken();
  },

  // Получить сохранённого пользователя
  getUser() {
    const user = localStorage.getItem('mstcreo_user');
    return user ? JSON.parse(user) : null;
  }
};

// ==========================================
// Chats API
// ==========================================

export const chatsAPI = {
  // Получить список чатов
  async getAll() {
    return fetchAPI('/chats');
  },

  // Создать новый чат
  async create(title) {
    return fetchAPI('/chats', {
      method: 'POST',
      body: JSON.stringify({ title })
    });
  },

  // Получить чат с сообщениями
  async getById(id) {
    return fetchAPI(`/chats/${id}`);
  },

  // Переименовать чат
  async rename(id, title) {
    return fetchAPI(`/chats/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title })
    });
  },

  // Удалить чат
  async delete(id) {
    return fetchAPI(`/chats/${id}`, { method: 'DELETE' });
  }
};

// ==========================================
// Generate API
// ==========================================

export const generateAPI = {
  // Генерация баннера
  async generate(params) {
    return fetchAPI('/generate', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  // Генерация с FormData (для файлов)
  async sendWithFormData(formData) {
    const token = getToken();

    const response = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Ошибка генерации');
    }

    return data;
  },

  // Загрузка референса
  async uploadReference(file) {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/generate/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Ошибка загрузки');
    }

    return data;
  },

  // Получить пресеты размеров
  async getPresets() {
    return fetchAPI('/generate/presets');
  }
};

// ==========================================
// WebSocket Manager
// ==========================================

export class WebSocketManager {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.currentChatId = null;
  }

  connect(chatId = null) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (chatId) {
        this.subscribe(chatId);
      }
      return;
    }

    const token = getToken();
    if (!token) {
      console.warn('[WS] No token, cannot connect');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    let url = `${protocol}//${host}/ws?token=${token}`;

    if (chatId) {
      url += `&chatId=${chatId}`;
      this.currentChatId = chatId;
    }

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type, data);
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    this.ws.onclose = (event) => {
      this.emit('disconnected');
      this.attemptReconnect(this.currentChatId);
    };

    this.ws.onerror = (error) => {
      console.error('[WS] Error:', error);
      this.emit('error', error);
    };
  }

  subscribe(chatId) {
    this.currentChatId = chatId;

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', chatId }));
    } else {
      this.connect(chatId);
    }
  }

  unsubscribe() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe' }));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  attemptReconnect(chatId) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WS] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    setTimeout(() => {
      this.connect(chatId);
    }, delay);
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Возвращаем функцию отписки
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error('WebSocket listener error', e);
      }
    });
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();

// ==========================================
// API Client (axios-like wrapper)
// ==========================================

export const apiClient = {
  async get(endpoint, options = {}) {
    const data = await fetchAPI(endpoint, { method: 'GET', ...options });
    return { data };
  },

  async post(endpoint, body, options = {}) {
    const data = await fetchAPI(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options
    });
    return { data };
  },

  async delete(endpoint, options = {}) {
    const data = await fetchAPI(endpoint, { method: 'DELETE', ...options });
    return { data };
  }
};

export default { authAPI, chatsAPI, generateAPI, wsManager, apiClient };
