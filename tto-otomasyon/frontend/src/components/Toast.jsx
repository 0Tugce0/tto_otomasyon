/**
 * Toast.jsx — Lightweight bildirim sistemi
 * Kullanım:
 *   import { useToast, ToastContainer } from './Toast';
 *   const { toasts, showToast } = useToast();
 *   showToast('Kaydedildi', 'success');
 *   <ToastContainer toasts={toasts} onDismiss={dismissToast} />
 */

import { useState, useCallback } from 'react';

let _idCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_idCounter;
    setToasts(t => [...t, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
    }
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  return { toasts, showToast, dismissToast };
}

const TYPE_STYLES = {
  success: 'bg-green-900/90 border-green-700 text-green-200',
  error:   'bg-red-900/90 border-red-700 text-red-200',
  warning: 'bg-yellow-900/90 border-yellow-700 text-yellow-200',
  info:    'bg-indigo-900/90 border-indigo-700 text-indigo-200',
};

const TYPE_ICONS = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl
            backdrop-blur-md pointer-events-auto animate-fadeIn
            ${TYPE_STYLES[t.type] ?? TYPE_STYLES.info}`}
        >
          <span className="text-base leading-none mt-0.5 shrink-0">{TYPE_ICONS[t.type]}</span>
          <p className="text-sm flex-1 whitespace-pre-wrap">{t.message}</p>
          <button
            onClick={() => onDismiss(t.id)}
            className="text-current opacity-60 hover:opacity-100 transition-opacity shrink-0 text-xs"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
