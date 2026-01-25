import { create } from 'zustand';
import { apiClient, API_BASE_URL } from '../services/api';

/**
 * Landing Generator Store
 * Manages state for landing page generation
 */
export const useLandingStore = create((set, get) => ({
  // Current generation session
  currentLandingId: null,
  generationState: 'idle', // idle, generating, complete, error
  progress: 0,
  progressMessage: '',
  error: null,

  // Current prompt (what user sent)
  currentPrompt: null,

  // Claude's thinking log
  thinkingLog: [],

  // Analysis results
  analysis: null,
  palette: null,

  // Generated content
  previewHtml: null,
  zipUrl: null,

  // History
  landings: [],
  isLoadingHistory: false,

  // Mechanics list
  mechanics: [],

  // WebSocket connection
  ws: null,

  /**
   * Start landing generation
   */
  generateLanding: async (request) => {
    const { prompt, screenshot, prizes, offerUrl, language } = request;

    set({
      generationState: 'generating',
      progress: 0,
      progressMessage: 'Запускаю генерацию...',
      error: null,
      previewHtml: null,
      zipUrl: null,
      currentPrompt: prompt,
      thinkingLog: [{ time: new Date(), message: `Отправляю запрос: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}"` }]
    });

    try {
      const response = await apiClient.post('/landing/v2/generate', {
        prompt,
        screenshot,
        prizes,
        offerUrl,
        language
      });

      const { landingId } = response.data;

      set({ currentLandingId: landingId });

      // Subscribe to WebSocket updates
      get().subscribeToLanding(landingId);

      return landingId;
    } catch (error) {
      set({
        generationState: 'error',
        error: error.response?.data?.error || error.message
      });
      throw error;
    }
  },

  /**
   * Subscribe to landing updates via WebSocket
   */
  subscribeToLanding: (landingId) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Use existing WebSocket or create new one
    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/ws?token=${token}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe_landing',
        landingId
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'landing_update' && data.landingId === landingId) {
          const currentLog = get().thinkingLog;
          const newLogEntry = data.message ? { time: new Date(), message: data.message } : null;

          set({
            progress: data.progress || get().progress,
            progressMessage: data.message || get().progressMessage,
            generationState: data.state === 'complete' ? 'complete' :
                            data.state === 'error' ? 'error' : 'generating',
            thinkingLog: newLogEntry ? [...currentLog, newLogEntry] : currentLog,
            // Save analysis if provided
            analysis: data.analysis || get().analysis
          });

          if (data.state === 'complete') {
            // Load the completed landing
            get().loadLanding(landingId);
          }

          if (data.state === 'error') {
            set({
              error: data.error || 'Generation failed',
              thinkingLog: [...get().thinkingLog, { time: new Date(), message: `❌ Ошибка: ${data.error}` }]
            });
          }
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onerror = () => {
      // Fallback to polling if WebSocket fails
      get().pollLandingStatus(landingId);
    };

    set({ ws });
  },

  /**
   * Poll landing status (fallback)
   */
  pollLandingStatus: async (landingId) => {
    const poll = async () => {
      try {
        const response = await apiClient.get(`/landing/v2/status/${landingId}`);
        const { state, progress, message, error } = response.data;

        set({
          progress,
          progressMessage: message,
          generationState: state === 'complete' ? 'complete' :
                          state === 'error' ? 'error' : 'generating'
        });

        if (state === 'complete') {
          get().loadLanding(landingId);
          return;
        }

        if (state === 'error') {
          set({ error: error || 'Generation failed' });
          return;
        }

        // Continue polling
        setTimeout(poll, 2000);
      } catch {
        // Ignore poll errors
        setTimeout(poll, 5000);
      }
    };

    poll();
  },

  /**
   * Load landing details
   */
  loadLanding: async (landingId) => {
    try {
      const [landingRes, previewRes] = await Promise.all([
        apiClient.get(`/landing/v2/${landingId}`),
        apiClient.get(`/landing/v2/${landingId}/preview`, { responseType: 'text' })
          .catch(() => ({ data: null }))
      ]);

      set({
        analysis: landingRes.data.analysis,
        palette: landingRes.data.palette,
        previewHtml: previewRes.data,
        zipUrl: `${API_BASE_URL}/landing/v2/${landingId}/download`,
        generationState: 'complete'
      });
    } catch (error) {
      console.error('Failed to load landing:', error);
    }
  },

  /**
   * Load landing history
   */
  loadLandings: async () => {
    set({ isLoadingHistory: true });

    try {
      const response = await apiClient.get('/landing/v2/list');
      set({
        landings: response.data.landings || [],
        isLoadingHistory: false
      });
    } catch (error) {
      console.error('Failed to load landings:', error);
      set({ isLoadingHistory: false });
    }
  },

  /**
   * Load available mechanics
   */
  loadMechanics: async () => {
    try {
      const response = await apiClient.get('/landing/v2/mechanics');
      set({ mechanics: response.data.mechanics || [] });
    } catch {
      // Use defaults
      set({
        mechanics: [
          { id: 'wheel', name: 'Fortune Wheel', complexity: 'simple' },
          { id: 'boxes', name: 'Gift Boxes', complexity: 'simple' },
          { id: 'crash', name: 'Crash Road', complexity: 'complex' },
          { id: 'loader', name: 'Progress Loader', complexity: 'simple' }
        ]
      });
    }
  },

  /**
   * Delete landing
   */
  deleteLanding: async (landingId) => {
    try {
      await apiClient.delete(`/landing/v2/${landingId}`);
      set(state => ({
        landings: state.landings.filter(l => l.landing_id !== landingId)
      }));
    } catch (error) {
      console.error('Failed to delete landing:', error);
      throw error;
    }
  },

  /**
   * Analyze request without generating
   */
  analyzeRequest: async (prompt, screenshot) => {
    try {
      const response = await apiClient.post('/landing/v2/analyze', {
        prompt,
        screenshot
      });
      set({ analysis: response.data });
      return response.data;
    } catch (error) {
      console.error('Analysis failed:', error);
      throw error;
    }
  },

  /**
   * Reset state
   */
  reset: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
    }

    set({
      currentLandingId: null,
      generationState: 'idle',
      progress: 0,
      progressMessage: '',
      error: null,
      currentPrompt: null,
      thinkingLog: [],
      analysis: null,
      palette: null,
      previewHtml: null,
      zipUrl: null,
      ws: null
    });
  },

  /**
   * Cleanup on unmount
   */
  cleanup: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
    }
  }
}));

export default useLandingStore;
