'use client';

import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

export default function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    const duration = toast.duration || 5000;
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '';
    }
  };

  const getToastClasses = () => {
    const base = 'flex items-center gap-3 p-3.5 rounded-lg shadow-lg min-w-[300px] max-w-[500px] animate-[slideIn_0.3s_ease-out] relative z-[1000]';
    switch (toast.type) {
      case 'success':
        return `${base} bg-green-50 text-green-800 border border-green-200`;
      case 'error':
        return `${base} bg-red-50 text-red-800 border border-red-200`;
      case 'warning':
        return `${base} bg-yellow-50 text-yellow-800 border border-yellow-200`;
      case 'info':
        return `${base} bg-blue-50 text-blue-800 border border-blue-200`;
      default:
        return base;
    }
  };

  return (
    <div className={getToastClasses()}>
      <span className="text-xl flex-shrink-0">{getIcon()}</span>
      <span className="flex-1 text-sm leading-relaxed">{toast.message}</span>
      <button
        onClick={() => onClose(toast.id)}
        className="bg-transparent border-none cursor-pointer text-xl text-inherit opacity-70 p-0 w-6 h-6 flex items-center justify-center flex-shrink-0 hover:opacity-100"
        aria-label="Schließen"
      >
        ×
      </button>
    </div>
  );
}

