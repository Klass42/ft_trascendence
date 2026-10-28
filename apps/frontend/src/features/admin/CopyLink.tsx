import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui';
import styles from './AdminTools.module.css';

/** Read-only link + copy button (no SMTP: the admin shares the link by hand). */
export function CopyLink({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setFailed(false); window.setTimeout(() => setCopied(false), 2000); }
    catch { setFailed(true); }
  }
  return (
    <div>
      <div className={styles.linkRow}>
        <input aria-label={label} value={url} readOnly onFocus={(event) => event.currentTarget.select()} />
        <Button type="button" size="sm" variant={copied ? 'secondary' : 'primary'} leftIcon={copied ? <Check size={15} /> : <Copy size={15} />} onClick={copy}>{copied ? 'Copiado' : 'Copiar'}</Button>
      </div>
      {failed && <p className={styles.muted} role="alert">No se pudo copiar. Selecciona el enlace y cópialo manualmente.</p>}
    </div>
  );
}

export const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;
export const resetUrl = (token: string) => `${window.location.origin}/reset-password#token=${encodeURIComponent(token)}`;
