import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

/* ---------------------------------------------------------------
   Toast feedback system — lightweight success/error confirmations.
   Errors are announced assertively; successes politely.
   The persistent error banner in App remains the source of truth
   for load/action failures; toasts add visible confirmation.
   --------------------------------------------------------------- */

export type ToastTone = 'success' | 'error' | 'info' | 'blocked';

export interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  pushToast: (tone: ToastTone, title: string, description?: string) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToasts = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToasts must be used within ToastProvider');
  return ctx;
};

const toneStyles: Record<ToastTone, { border: string; accent: string; icon: React.ReactNode }> = {
  success: {
    border: 'border-[rgba(114,199,154,0.4)]',
    accent: 'bg-safe',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  error: {
    border: 'border-[rgba(240,100,100,0.45)]',
    accent: 'bg-danger',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 4v5M8 11.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  blocked: {
    border: 'border-[rgba(243,182,74,0.45)]',
    accent: 'bg-amber',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M4.2 4.2l7.6 7.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  info: {
    border: 'border-line-strong',
    accent: 'bg-muted',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 7.2v4M8 4.8v.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-3), { id, tone, title, description }]);
      // Success/info fade sooner; blocked/error stay long enough to read.
      const ttl = tone === 'success' || tone === 'info' ? 4200 : 7000;
      window.setTimeout(() => dismissToast(id), ttl);
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, pushToast, dismissToast }}>
      {children}
      {/* Toast viewport — fixed, non-blocking, bottom right */}
      <div
        className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[min(22rem,calc(100vw-2rem))]"
        aria-label="Notifications"
      >
        {toasts.map((toast) => {
          const style = toneStyles[toast.tone];
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
              className={`toast-in panel ${style.border} border px-3.5 py-3 flex items-start gap-3 shadow-raised`}
            >
              <span className={`mt-0.5 shrink-0 w-5 h-5 rounded-full ${style.accent} text-[#111318] flex items-center justify-center`}>
                {style.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-ink leading-snug">{toast.title}</p>
                {toast.description && (
                  <p className="text-[11px] text-muted mt-0.5 leading-snug">{toast.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
                className="p-1 rounded text-faint hover:text-ink transition-colors cursor-pointer shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
