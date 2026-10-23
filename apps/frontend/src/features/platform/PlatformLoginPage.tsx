import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button, Card, Input } from '@/components/ui';
import { useAuth } from '@/lib/api';

/** Public authentication page; access remains protected by platform RBAC. */
export function PlatformLoginPage() {
  const { loginPlatform, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  if (isAuthenticated && user?.platformRole === 'SUPERADMIN') return <Navigate to="/platform/organizations" replace />;
  async function submit(event: FormEvent) { event.preventDefault(); setError(null); setLoading(true); try { await loginPlatform(email, password); navigate('/platform/organizations'); } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.'); } finally { setLoading(false); } }
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}><Card style={{ width: 'min(100%, 420px)', padding: 28 }}><h1>Administración de plataforma</h1><p>Acceso exclusivo para superadministradores.</p><form onSubmit={submit}>{error && <p role="alert">{error}</p>}<Input label="Email" type="email" value={email} maxLength={254} onChange={e => setEmail(e.target.value)} required autoComplete="email" /><Input label="Contraseña" type="password" value={password} maxLength={128} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /><Button type="submit" loading={loading} fullWidth>Entrar</Button></form></Card></main>;
}
