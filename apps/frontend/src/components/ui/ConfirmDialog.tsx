/**
 * ConfirmDialog Component
 *
 * A Modal preset for confirmations (delete, publish…). Built on <Modal> +
 * <Button>. Use `variant="danger"` for destructive actions.
 *
 * Usage:
 *   <ConfirmDialog open={o} onCancel={close} onConfirm={del}
 *     title="Borrar tarea" message="Esta acción no se puede deshacer."
 *     confirmLabel="Borrar" variant="danger" />
 */
import { type ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
        {message}
      </p>
    </Modal>
  );
}

ConfirmDialog.displayName = 'ConfirmDialog';
