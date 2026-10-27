import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  Library,
  MessageSquare,
  BarChart3,
  LineChart,
  Building2,
  User,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/api';
import { Avatar, Spinner } from '@/components/ui';
import { NotificationsProvider, NotificationBell } from '@/features/notifications';
import { PresenceProvider, FriendsPresence } from '@/features/presence';
import { LegalFooter } from './LegalFooter';
import styles from './AppLayout.module.css';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

interface NavItem {
  to: string;
  icon: ReactNode;
  label: string;
  staffOnly?: boolean;
  student?: boolean;
  teacher?: boolean;
  adminOnly?: boolean;
  hideFromAdmin?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Inicio' },
  { to: '/courses', icon: <BookOpen size={20} />, label: 'Cursos' },
  { to: '/friends', icon: <Users size={20} />, label: 'Amigos' },
  { to: '/activities', icon: <ClipboardCheck size={20} />, label: 'Tareas', student: true, teacher: true },
  { to: '/forums', icon: <MessageSquare size={20} />, label: 'Foros', student: true, teacher: true },
  { to: '/grades', icon: <BarChart3 size={20} />, label: 'Datos', hideFromAdmin: true },
  { to: '/analytics', icon: <LineChart size={20} />, label: 'Analíticas', staffOnly: true, hideFromAdmin: true },
  { to: '/resources', icon: <Library size={20} />, label: 'Biblioteca', staffOnly: true },
  { to: '/org', icon: <Building2 size={20} />, label: 'Organización' },
  { to: '/admin/users', icon: <Users size={20} />, label: 'Usuarios', adminOnly: true },
];

interface AppLayoutProps {
  /** Content to render instead of the matched child route (used by the 404 page). */
  children?: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps = {}) {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, []);

  // Escape closes the mobile drawer and gives focus back to the button that opened it.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setIsMobileMenuOpen(false);
      mobileToggleRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobileMenuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => setIsCollapsed((c) => !c);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" label="Cargando…" />
      </div>
    );
  }

  return (
    <NotificationsProvider>
    <PresenceProvider>
    <div className={styles.layout}>
      <a
        href="#main-content"
        className={styles.skipLink}
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
          mainRef.current?.scrollIntoView();
        }}
      >
        Saltar al contenido
      </a>

      {/* ===== Navbar ===== */}
      <header className={styles.navbar}>
        <div className={styles.navbarLeft}>
          <button
            ref={mobileToggleRef}
            className={styles.mobileMenuToggle}
            onClick={() => setIsMobileMenuOpen((o) => !o)}
            aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isMobileMenuOpen}
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
          <NavLink to="/profile" className={styles.avatar} aria-label="Perfil">
            <Avatar src={user?.avatarUrl} size="sm" />
          </NavLink>
          <button className={styles.logoutBtn} onClick={handleLogout} aria-label="Cerrar sesión">
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
          {NAV_ITEMS.filter((item) => {
            const role = user?.role;
            // Admin-only tools (e.g. Usuarios) — hide from non-admins.
            if (item.adminOnly && role !== 'ADMIN') {
              return false;
            }
            if (item.hideFromAdmin && role === 'ADMIN') {
              return false;
            }
            // Analytics dashboard is a staff tool — hide from students.
            if ('staffOnly' in item && item.staffOnly && role === 'STUDENT') {
              return false;
            }
            // Role-flagged items (e.g. Tareas/Foros = student+teacher) are shown
            // only to the roles whose flag is set. Items with no flags are shown
            // to everyone.
            const restricted = 'student' in item || 'teacher' in item;
            if (restricted && role) {
              if (role === 'STUDENT') return 'student' in item && !!item.student;
              if (role === 'TEACHER') return 'teacher' in item && !!item.teacher;
              return false; // ADMIN: Tareas/Foros aren't admin tools
            }
            return true;
          }).map((item) => {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.active : ''}`
                }
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label={item.label}
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
            aria-label="Perfil"
          >
            <span className={styles.navIcon}><User size={20} /></span>
            {!isCollapsed && <span className={styles.navLabel}>Perfil</span>}
          </NavLink>
          <button
            className={styles.collapseToggle}
            onClick={toggleSidebar}
            aria-label={isCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>

      {/* ===== Main Content ===== */}
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className={`${styles.main} ${isCollapsed ? styles.mainExpanded : ''}`}
      >
        {children ?? <Outlet />}
      </main>

      <div className={styles.footerArea}>
        <LegalFooter />
      </div>
    </div>
    </PresenceProvider>
    </NotificationsProvider>
  );
}
