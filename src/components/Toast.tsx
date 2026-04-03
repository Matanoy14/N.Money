import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastId = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const typeStyles: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
    success: { bg: '#E8F8F2', border: '#00A86B', text: '#00A86B', icon: '✓' },
    error: { bg: '#FEF2F2', border: '#E53E3E', text: '#E53E3E', icon: '✕' },
    warning: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E', icon: '⚠' },
    info: { bg: '#E8F0FB', border: '#1E56A0', text: '#1E56A0', icon: 'ℹ' },
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container - fixed bottom center */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
        {toasts.map(toast => {
          const s = typeStyles[toast.type];
          return (
            <div
              key={toast.id}
              className="flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg min-w-[280px] animate-[slideUp_200ms_ease-out]"
              style={{ backgroundColor: s.bg, borderRight: `4px solid ${s.border}` }}
            >
              <span className="text-lg font-bold" style={{ color: s.text }}>{s.icon}</span>
              <span className="text-sm font-medium" style={{ color: s.text }}>{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
