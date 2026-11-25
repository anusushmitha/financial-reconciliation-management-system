import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'info' | 'error';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: ToastType;
  durationMs?: number;
}

export interface NotificationHistoryItem extends ToastItem {
  timestamp: number;
  read: boolean;
}

interface ToastContextType {
  showToast: (title: string, message: string, type?: ToastType, durationMs?: number) => void;
  addToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;
  history: NotificationHistoryItem[];
  unreadCount: number;
  markAllRead: () => void;
  clearHistory: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const markAllRead = useCallback(() => {
    setHistory((prev) => prev.map((h) => ({ ...h, read: true })));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const showToast = useCallback(
    (title: string, message: string, type: ToastType = 'info', durationMs: number = 4500) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const item: ToastItem = { id, title, message, type, durationMs };
      setToasts((prev) => [item, ...prev.slice(0, 4)]);
      setHistory((prev) => [{ ...item, timestamp: Date.now(), read: false }, ...prev.slice(0, 24)]);

      if (durationMs > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, durationMs);
      }
    },
    [dismissToast]
  );

  const unreadCount = history.filter((h) => !h.read).length;

  const addToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const title = type === 'success' ? 'Success' : type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Notification';
      showToast(title, message, type);
    },
    [showToast]
  );

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} style={{ color: '#16A34A', flexShrink: 0 }} />;
      case 'warning':
        return <AlertTriangle size={18} style={{ color: '#D97706', flexShrink: 0 }} />;
      case 'error':
        return <XCircle size={18} style={{ color: '#DC2626', flexShrink: 0 }} />;
      case 'info':
      default:
        return <Info size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />;
    }
  };

  const getBorderColor = (type: ToastType) => {
    switch (type) {
      case 'success':
        return '#86EFAC';
      case 'warning':
        return '#FCD34D';
      case 'error':
        return '#FCA5A5';
      case 'info':
      default:
        return '#93C5FD';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, addToast, dismissToast, history, unreadCount, markAllRead, clearHistory }}>
      {children}
      {/* Toast Container Stack */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '380px',
          width: '100%',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              backgroundColor: '#FFFFFF',
              border: `1px solid ${getBorderColor(t.type)}`,
              borderRadius: '10px',
              padding: '12px 14px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              pointerEvents: 'auto',
              animation: 'slideInRight 0.25s ease-out',
            }}
          >
            {getIcon(t.type)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', marginBottom: '2px' }}>
                {t.title}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.35, wordBreak: 'break-word' }}>
                {t.message}
              </div>
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
