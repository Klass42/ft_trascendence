/**
 * Application Routes
 * 
 * Central routing configuration using React Router v7.
 * Uses lazy loading for code splitting.
 */

import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
} from 'react-router-dom';
import { Spinner } from '@/components/ui';
import { AppLayout } from './AppLayout';
import { ProtectedRoute } from './ProtectedRoute';

// =============================================================================
// Lazy-loaded Pages
// =============================================================================

const LoginPage = lazy(() =>
  import('@/features/auth').then((m) => ({ default: m.LoginPage }))
);

const DashboardPage = lazy(() =>
  import('@/features/dashboard').then((m) => ({ default: m.DashboardPage }))
);

// Placeholder pages for routes not yet implemented
const PlaceholderPage = ({ title }: { title: string }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '50vh',
      color: 'var(--color-text-secondary)',
    }}
  >
    <h1 style={{ marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
      {title}
    </h1>
    <p>This page is coming soon.</p>
  </div>
);

const CoursesPage = () => <PlaceholderPage title="Courses" />;
const ProfilePage = () => <PlaceholderPage title="Profile" />;

// =============================================================================
// Loading Fallback
// =============================================================================

function PageLoader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
      }}
    >
      <Spinner size="lg" label="Loading page..." />
    </div>
  );
}

// =============================================================================
// Route Definitions
// =============================================================================

const routes: RouteObject[] = [
  // Public routes
  {
    path: '/login',
    element: (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    ),
  },

  // Protected routes with AppLayout
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '/dashboard',
        element: (
          <Suspense fallback={<PageLoader />}>
            <DashboardPage />
          </Suspense>
        ),
      },
      {
        path: '/courses',
        element: (
          <Suspense fallback={<PageLoader />}>
            <CoursesPage />
          </Suspense>
        ),
      },
      {
        path: '/profile',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProfilePage />
          </Suspense>
        ),
      },
    ],
  },

  // Redirects
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },

  // 404 - Catch all
  {
    path: '*',
    element: (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          color: 'var(--color-text-secondary)',
          backgroundColor: 'var(--color-bg-primary)',
        }}
      >
        <h1
          style={{
            fontSize: '4rem',
            marginBottom: '1rem',
            color: 'var(--color-text-primary)',
          }}
        >
          404
        </h1>
        <p>Page not found.</p>
        <a
          href="/dashboard"
          style={{
            marginTop: '1rem',
            color: 'var(--color-accent-primary)',
          }}
        >
          Go to Dashboard
        </a>
      </div>
    ),
  },
];

// =============================================================================
// Router Instance
// =============================================================================

export const router = createBrowserRouter(routes);
