import React, { useCallback, useEffect, useState } from 'react';
import { CheckIcon, CloseIcon, InfoIcon, UpdateIcon } from './Icons';

export interface ToastItemData {
  id: string;
  title: string;
  message: string;
  durationMs?: number;
  type?: 'info' | 'success' | 'update';
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
}

interface ToastContainerProps {
  toasts: ToastItemData[];
  onClose: (id: string) => void;
}

const ToastItem: React.FC<{ toast: ToastItemData; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const triggerClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setIsVisible(false);
    setTimeout(() => onClose(toast.id), 220);
  }, [isClosing, onClose, toast.id]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => triggerClose(), toast.durationMs ?? 5000);
    return () => clearTimeout(timeout);
  }, [toast.durationMs, triggerClose]);

  const iconClass = "text-2xl opacity-80";
  const icon = toast.type === 'success'
    ? <CheckIcon className={iconClass} />
    : toast.type === 'update'
      ? <UpdateIcon className={iconClass} />
      : <InfoIcon className={iconClass} />;

  return (
    <div
      className="pointer-events-auto w-[460px] max-w-[calc(100vw-2rem)] rounded-lg border shadow-2xl p-4"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'color-mix(in srgb, var(--border-color) 85%, #000 15%)',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
        transition: 'opacity 220ms ease, transform 220ms ease'
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ color: 'var(--text-main)' }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-black tracking-wide leading-tight" style={{ color: 'var(--text-main)' }}>
            {toast.title}
          </h4>
          <p className="text-xs font-medium mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {toast.message}
          </p>
          {toast.actionLabel && toast.onAction && (
            <div className="mt-3 flex justify-start">
              <button
                onClick={async () => {
                  try {
                    await toast.onAction?.();
                  } finally {
                    triggerClose();
                  }
                }}
                className="h-8 px-3 rounded-md border text-[10px] font-black uppercase tracking-wider transition-all hover:opacity-90"
                style={{
                  borderColor: 'var(--border-color)',
                  backgroundColor: 'var(--hover-bg)',
                  color: 'var(--text-main)',
                }}
              >
                {toast.actionLabel}
              </button>
            </div>
          )}
        </div>
        <button
          onClick={triggerClose}
          className="w-7 h-7 rounded-sm flex items-center justify-center transition-all hover:bg-[var(--hover-bg)] self-center"
          aria-label="Close notification"
          title="Close"
        >
          <CloseIcon className="text-base opacity-60" />
        </button>
      </div>
    </div>
  );
};

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
};

export default ToastContainer;
