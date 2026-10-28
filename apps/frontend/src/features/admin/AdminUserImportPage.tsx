import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileUp } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api';
import { Badge, Button, Card, Table, Textarea } from '@/components/ui';
import { CopyLink, inviteUrl } from './CopyLink';
import styles from './AdminTools.module.css';

interface RowResult { line: number; email: string; name?: string; ok: boolean; error?: string; role?: string; invitationToken?: string; replacedPending?: boolean }
interface ImportReport { total: number; created: number; failed: number; results: RowResult[] }

const MAX_BYTES = 90_000;
const EXAMPLE = 'email,name,role\nana@colegio.es,Ana Pérez,STUDENT\nluis@colegio.es,Luis Gil,TEACHER';

export function AdminUserImportPage() {
  const [csv, setCsv] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) { setError('El archivo no puede superar los 90 KB.'); return; }
    setError(null);
    setCsv(await file.text());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!csv.trim()) { setError('Pega el CSV o selecciona un archivo.'); return; }
    if (new Blob([csv]).size > MAX_BYTES) { setError('El CSV no puede superar los 90 KB.'); return; }
    if (!/email/i.test(csv.split(/\r?\n/)[0] ?? '') || !/role/i.test(csv.split(/\r?\n/)[0] ?? '')) {
      setError('La primera línea debe ser la cabecera con las columnas email, name y role.'); return;
    }
    setError(null); setIsSubmitting(true);
    try { setReport(await apiClient.post<ImportReport>('/organizations/me/invitations/import', { csv })); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : 'No se pudo importar el CSV.'); }
    finally { setIsSubmitting(false); }
  }

  const columns = [
    { key: 'line', header: 'Línea', render: (row: RowResult) => row.line },
    { key: 'email', header: 'Email', render: (row: RowResult) => row.email || '—' },
    { key: 'result', header: 'Resultado', render: (row: RowResult) => row.ok
      ? <Badge variant="success" dot>{row.replacedPending ? 'Invitación renovada' : 'Invitación creada'}</Badge>
      : <Badge variant="error" dot>{row.error}</Badge> },
    { key: 'link', header: 'Enlace', render: (row: RowResult) => row.invitationToken ? <CopyLink label={`Enlace de invitación de ${row.email}`} url={inviteUrl(row.invitationToken)} /> : null },
  ];

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} to="/admin/users"><ArrowLeft size={16} /> Volver a usuarios</Link>
      <header>
        <h1 className={styles.title}>Importar usuarios desde CSV</h1>
        <p className={styles.subtitle}>Cada fila válida crea una invitación (7 días). Columnas: <code>email</code>, <code>name</code> (opcional) y <code>role</code> (STUDENT, TEACHER o ADMIN). Máximo 500 filas.</p>
      </header>
      {report ? (
        <>
          <div className={styles.summary} role="status">
            <Badge variant="neutral">{report.total} filas</Badge>
            <Badge variant="success">{report.created} invitaciones</Badge>
            <Badge variant={report.failed ? 'error' : 'neutral'}>{report.failed} con errores</Badge>
          </div>
          {report.results.some((row) => row.replacedPending) && <div className={styles.notice}>Algunos emails ya tenían una invitación pendiente: su enlace anterior ha dejado de funcionar.</div>}
          <p className={styles.muted}>No se envían correos: comparte cada enlace con su destinatario. También puedes reenviarlos desde «Invitaciones pendientes».</p>
          <Table columns={columns} data={report.results} rowKey={(row) => String(row.line)} />
          <div className={styles.actions}>
            <Button as={Link} to="/admin/users/invitations" variant="outline">Ver invitaciones pendientes</Button>
            <Button type="button" onClick={() => { setReport(null); setCsv(''); }}>Importar otro CSV</Button>
          </div>
        </>
      ) : (
        <Card padding="lg">
          <form onSubmit={submit} noValidate className={styles.page}>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <label className={styles.muted}>
              Archivo CSV{' '}
              <input type="file" accept=".csv,text/csv" onChange={onFile} />
            </label>
            <Textarea label="Contenido del CSV" rows={10} value={csv} placeholder={EXAMPLE} onChange={(event) => { setCsv(event.target.value); setError(null); }} />
            <div className={styles.actions}>
              <Button as={Link} to="/admin/users" variant="ghost">Cancelar</Button>
              <Button type="submit" loading={isSubmitting} leftIcon={<FileUp size={18} />}>Importar</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
