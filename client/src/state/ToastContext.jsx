import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const toast = useCallback((message, type = '') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((item) => item.id !== id)), type === 'error' ? 7000 : 4000);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-space-lg right-space-lg z-[100] flex flex-col gap-space-xs max-w-sm" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`px-space-md py-space-sm font-code-sm text-code-sm shadow-lg border-l-2 ${
              t.type === 'error' ? 'bg-error-container text-error border-error' : t.type === 'warning' ? 'bg-secondary-container/40 text-secondary border-secondary' : 'bg-surface-container-high text-on-surface border-tertiary'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider.');
  return ctx;
}
