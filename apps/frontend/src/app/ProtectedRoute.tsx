/**
 * ProtectedRoute Component
 * 
 * A wrapper that checks authentication and redirects to login if needed.
 * Also handles loading state while auth is being checked.
 * 
 * Usage:
 *   <Route element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
 * 
 *   // Or with role restriction:
 *   <Route element={<ProtectedRoute roles={['ADMIN']}><AdminPage /></ProtectedRoute>} />
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/api';
import { Spinner } from '@/components/ui';
import type { ReactNode } from 'react';
import type { GlobalRole } from '@/lib/api';
import styles from './ProtectedRoute.module.css';

// =============================================================================
// Types
// =============================================================================

interface ProtectedRouteProps {
  children: ReactNode;
  /** Optional: restrict to specific roles */
  roles?: GlobalRole[];
  /** Path to redirect to if not authenticated (default: /login) */
  redirectTo?: string;
}

// =============================================================================
// Component
// =============================================================================

export function ProtectedRoute({
  children,
  roles,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" label="Checking authentication..." />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    // Save the attempted URL for redirecting after login
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check role restriction if specified
  if (roles && roles.length > 0 && user) {
    const hasRequiredRole = roles.includes(user.role);
    
    if (!hasRequiredRole) {
      // User is authenticated but doesn't have required role
      // Redirect to dashboard instead of login
      return <Navigate to="/dashboard" replace />;
    }
  }

  // User is authenticated (and has required role if specified)
  return <>{children}</>;
}
