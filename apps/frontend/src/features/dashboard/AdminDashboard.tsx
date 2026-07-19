/**
 * AdminDashboard — OWNER: Jorge (Plan 2, A4-admin).
 * TODO(Jorge): de-mock — los KPIs (1.284 usuarios, 96 cursos, …) y la lista de
 * "Usuarios recientes" están hardcodeados. Sustituir por GET /users y
 * GET /organizations/me.
 */
import { users } from '@/lib/mock-data';
import { DashboardHeader } from './DashboardHeader';

const KPIS = [
  { label: 'Usuarios', value: '1.284' },
  { label: 'Cursos', value: '96' },
  { label: 'Activos ahora', value: '417' },
  { label: 'Uptime', value: '99,9%', color: '#0f766e' },
];

export function AdminDashboard() {
  return (
    <>
      <DashboardHeader title="Panel de administración" roleLabel="Admin" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 26 }}>
        {KPIS.map((s) => (
          <div key={s.label} style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: s.color || 'var(--color-text-primary)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Usuarios recientes</div>
      <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)', borderRadius: 13, overflow: 'hidden', maxWidth: 720 }}>
        {users.map((u, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--color-border-primary)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flex: 'none' }}>
              {u.initials}
            </div>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{u.name}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>{u.role}</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', width: 56, textAlign: 'right' }}>{u.joined}</span>
          </div>
        ))}
      </div>
    </>
  );
}
