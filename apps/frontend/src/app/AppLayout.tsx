/**
 * AppLayout Component
 * 
 * The main shell of the application with:
 * - Navbar (top): logo, user menu, logout
 * - Sidebar (left): navigation links, collapsible
 * - Main content area: renders child routes via <Outlet />
 * 
 * Usage:
 *   <Route element={<AppLayout />}>
 *     <Route path="dashboard" element={<DashboardPage />} />
 *   </Route>
 */

import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/api';
import { Button, Spinner } from '@/components/ui';
import styles from './AppLayout.module.css';

// =============================================================================
// Constants
// =============================================================================

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
  { to: '/courses', icon: <BookOpen size={20} />, label: 'Courses' },
  { to: '/profile', icon: <User size={20} />, label: 'Profile' },
];

// =============================================================================
// Component
// =============================================================================

export function AppLayout() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  
  // Sidebar state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  });
  
  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
  }, [isCollapsed]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" label="Loading..." />
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      {/* ===== Navbar ===== */}
      <header className={styles.navbar}>
        <div className={styles.navbarLeft}>
          {/* Mobile menu toggle */}
          <button
            className={styles.mobileMenuToggle}
            onClick={toggleMobileMenu}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          
          {/* Logo */}
          <NavLink to="/dashboard" className={styles.logo}>
            <span className={styles.logoIcon}>📚</span>
            <span className={styles.logoText}>ft_trascendence</span>
          </NavLink>
        </div>

        <div className={styles.navbarRight}>
          {user && (
            <>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user.name}</span>
                <span className={styles.userRole}>{user.role}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                leftIcon={<LogOut size={16} />}
              >
                <span className={styles.logoutText}>Logout</span>
              </Button>
            </>
          )}
        </div>
      </header>

      {/* ===== Mobile Menu Overlay ===== */}
      {isMobileMenuOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ===== Sidebar ===== */}
      <aside
        className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''} ${
          isMobileMenuOpen ? styles.mobileOpen : ''
        }`}
      >
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
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
          ))}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <button
          className={styles.collapseToggle}
          onClick={toggleSidebar}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      {/* ===== Main Content ===== */}
      <main className={`${styles.main} ${isCollapsed ? styles.mainExpanded : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
