import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../services/api';

/**
 * Auth Store (Zustand)
 */
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      // Вход по invite-ссылке
      loginWithInvite: async (inviteToken) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authAPI.loginWithInvite(inviteToken);
          set({
            user: data.user,
            token: data.token,
            isLoading: false
          });
          return data;
        } catch (error) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      // Проверка авторизации
      checkAuth: async () => {
        const token = localStorage.getItem('bannergen_token');
        if (!token) {
          set({ user: null, token: null });
          return false;
        }

        try {
          const user = await authAPI.getMe();
          set({ user, token });
          return true;
        } catch (error) {
          set({ user: null, token: null });
          localStorage.removeItem('bannergen_token');
          return false;
        }
      },

      // Выход
      logout: () => {
        authAPI.logout();
        set({ user: null, token: null });
      },

      // Проверка авторизован ли
      isAuthenticated: () => {
        return !!get().token || !!localStorage.getItem('bannergen_token');
      },

      // Очистка ошибки
      clearError: () => set({ error: null })
    }),
    {
      name: 'bannergen-auth',
      partialize: (state) => ({ token: state.token, user: state.user })
    }
  )
);

export default useAuthStore;
