import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Building2, LogOut, Plus } from 'lucide-react';
import { useAuth } from '@/lib/api';
import { Button } from '@/components/ui';
import styles from './PlatformLayout.module.css';

export function PlatformLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  function handleLogout() { logout(); navigate('/platform/login'); }
  return <div className={styles.shell}><header className={styles.header}><Link to="/platform/organizations" className={styles.brand}><span>K</span><div><strong>Klass</strong><small>Platform</small></div></Link><nav className={styles.nav} aria-label="Navegación de plataforma"><Link to="/platform/organizations"><Building2 size={17} /> Organizaciones</Link></nav><div className={styles.actions}><Button as={Link} to="/platform/organizations/new" size="sm" leftIcon={<Plus size={16} />}>Nueva organización</Button><button className={styles.logout} onClick={handleLogout} aria-label="Cerrar sesión"><LogOut size={18} /></button></div></header><main><Outlet /></main></div>;
}
