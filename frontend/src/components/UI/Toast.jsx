import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { create } from 'zustand';

// Toast store
export const useToastStore = create((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = Date.now();
    const newToast = {
      id,
      type: 'info',
      duration: 4000,
      ...toast
    };

    set((state) => ({
      toasts: [...state.toasts, newToast]
    }));

    // Auto remove
    if (newToast.duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, newToast.duration);
    }

    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  },

  clearAll: () => set({ toasts: [] })
}));

// Helper functions
export const toast = {
  success: (message, options = {}) =>
    useToastStore.getState().addToast({ type: 'success', message, ...options }),
  error: (message, options = {}) =>
    useToastStore.getState().addToast({ type: 'error', message, ...options }),
  warning: (message, options = {}) =>
    useToastStore.getState().addToast({ type: 'warning', message, ...options }),
  info: (message, options = {}) =>
    useToastStore.getState().addToast({ type: 'info', message, ...options })
};

// Single Toast component
function ToastItem({ toast, onClose }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onClose(toast.id), 200);
  }, [toast.id, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success" />,
    error: <AlertCircle className="w-5 h-5 text-error" />,
    warning: <AlertTriangle className="w-5 h-5 text-warning" />,
    info: <Info className="w-5 h-5 text-accent" />
  };

  const bgColors = {
    success: 'bg-success/10 border-success/20',
    error: 'bg-error/10 border-error/20',
    warning: 'bg-warning/10 border-warning/20',
    info: 'bg-accent/10 border-accent/20'
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl
        glass border
        ${bgColors[toast.type]}
        ${isExiting ? 'animate-toast-out' : 'animate-toast-in'}
        shadow-lg
      `}
    >
      {icons[toast.type]}
      <p className="text-sm text-text-primary flex-1">{toast.message}</p>
      <button
        onClick={handleClose}
        className="p-1 hover:bg-white/10 rounded-lg transition"
      >
        <X className="w-4 h-4 text-text-muted" />
      </button>
    </div>
  );
}

// Toast Container
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-md px-4">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={removeToast} />
      ))}
    </div>
  );
}

export default ToastContainer;
