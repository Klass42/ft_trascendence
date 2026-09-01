import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/api';
export function PlatformLayout() { const { logout } = useAuth(); return <><header style={{ padding: '16px 32px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}><Link to="/platform/organizations" style={{ fontWeight: 800 }}>Klass Platform</Link><button onClick={logout}>Salir</button></header><main><Outlet /></main></>; }
