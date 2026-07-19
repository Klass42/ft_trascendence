import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  MessageSquare,
  BarChart3,
  LineChart,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/api';
import { Spinner } from '@/components/ui';
import { NotificationsProvider, NotificationBell } from '@/features/notifications';
import { PresenceProvider, FriendsPresence } from '@/features/presence';
import styles from './AppLayout.module.css';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

const NAV_ITEMS = [
  { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Inicio' },
  { to: '/courses', icon: <BookOpen size={20} />, label: 'Cursos' },
  { to: '/assignments', icon: <ClipboardCheck size={20} />, label: 'Tareas', student: true, teacher: true },
  { to: '/forums', icon: <MessageSquare size={20} />, label: 'Foros', student: true, teacher: true },
  { to: '/grades', icon: <BarChart3 size={20} />, label: 'Datos' },
  { to: '/analytics', icon: <LineChart size={20} />, label: 'Analíticas', staffOnly: true },
] as const;

export function AppLayout() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => setIsCollapsed((c) => !c);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" label="Loading..." />
      </div>
    );
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <NotificationsProvider>
    <PresenceProvider>
    <div className={styles.layout}>
      {/* ===== Navbar ===== */}
      <header className={styles.navbar}>
        <div className={styles.navbarLeft}>
          <button
            className={styles.mobileMenuToggle}
            onClick={() => setIsMobileMenuOpen((o) => !o)}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <NavLink to="/dashboard" className={styles.logo}>
            <span className={styles.logoIcon}>K</span>
            <span className={styles.logoText}>Klass</span>
          </NavLink>
        </div>

        <div className={styles.navbarRight}>
          <FriendsPresence />
          <NotificationBell />
          <NavLink to="/profile" className={styles.avatar}>
            {initials}
          </NavLink>
          <button className={styles.logoutBtn} onClick={handleLogout} aria-label="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* ===== Mobile Overlay ===== */}
      {isMobileMenuOpen && (
        <div className={styles.mobileOverlay} onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* ===== Sidebar ===== */}
      <aside
        className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''} ${
          isMobileMenuOpen ? styles.mobileOpen : ''
        }`}
      >
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            // Analytics dashboard is a staff tool — hide from students.
            if ('staffOnly' in item && item.staffOnly && user?.role === 'STUDENT') {
              return null;
            }
            if ('student' in item && item.student !== undefined && user) {
              if (item.student && user.role === 'ADMIN') return null;
              if (item.teacher && user.role === 'STUDENT') return null;
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.active : ''}`
                }
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {!isCollapsed && <span className={styles.navLabel}>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className={styles.navBottom}>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span className={styles.navIcon}><User size={20} /></span>
            {!isCollapsed && <span className={styles.navLabel}>Perfil</span>}
          </NavLink>
          <button
            className={styles.collapseToggle}
            onClick={toggleSidebar}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>

      {/* ===== Main Content ===== */}
      <main className={`${styles.main} ${isCollapsed ? styles.mainExpanded : ''}`}>
        <Outlet />
      </main>
    </div>
    </PresenceProvider>
    </NotificationsProvider>
  );
}