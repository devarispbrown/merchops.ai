/**
 * Toast Hook
 * Simple toast notification system
 */

'use client';

import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

let toastCounter = 0;

// Global toast state
let globalToasts: Toast[] = [];
let listeners: Array<(toasts: Toast[]) => void> = [];

function emitChange() {
  listeners.forEach((listener) => listener(globalToasts));
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(globalToasts);

  // Subscribe to global toast changes
  useState(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  });

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration = 5000) => {
      const id = `toast-${++toastCounter}`;
      const newToast: Toast = { id, message, type, duration };

      globalToasts = [...globalToasts, newToast];
      emitChange();

      // Auto-remove after duration
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const removeToast = useCallback((id: string) => {
    globalToasts = globalToasts.filter((t) => t.id !== id);
    emitChange();
  }, []);

  return {
    toasts,
    showToast,
    removeToast,
    success: (message: string, duration?: number) =>
      showToast(message, 'success', duration),
    error: (message: string, duration?: number) =>
      showToast(message, 'error', duration),
    info: (message: string, duration?: number) =>
      showToast(message, 'info', duration),
    warning: (message: string, duration?: number) =>
      showToast(message, 'warning', duration),
  };
}
