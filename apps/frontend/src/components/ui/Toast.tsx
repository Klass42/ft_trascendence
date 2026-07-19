/**
 * Toast system — ToastProvider + useToast()
 *
 * Mount <ToastProvider> once near the app root, then call useToast() anywhere:
 *   const { toast } = useToast();
 *   toast({ message: 'Curso creado', variant: 'success' });
 *
 * Auto-dismisses; supports success / error / info / warning.
 */
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import styles from './Toast.module.css';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  message: ReactNode;
  title?: ReactNode;
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms (default 4000; 0 = sticky) */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, 'title'>> {
  id: number;
  title?: ReactNode;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ message, title, variant = 'info', duration = 4000 }: ToastOptions) => {
      const id = ++seq.current;
      setItems((list) => [...list, { id, message, title, variant, duration }]);
      if (duration > 0) {
        setTimeout(() => remove(id), duration);
      }
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div className={styles.container} role="region" aria-label="Notificaciones">
          {items.map((t) => {
            const Icon = ICONS[t.variant];
            return (
              <div key={t.id} className={[styles.toast, styles[t.variant]].join(' ')} role="status">
                <Icon className={styles.icon} size={18} aria-hidden="true" />
                <div className={styles.content}>
                  {t.title && <p className={styles.title}>{t.title}</p>}
                  <p className={styles.message}>{t.message}</p>
                </div>
                <button
                  type="button"
                  className={styles.close}
                  onClick={() => remove(t.id)}
                  aria-label="Cerrar"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}
