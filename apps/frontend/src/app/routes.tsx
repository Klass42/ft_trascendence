import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
} from 'react-router-dom';
import { Spinner } from '@/components/ui';
import { AppLayout } from './AppLayout';
import { ProtectedRoute } from './ProtectedRoute';

const LoginPage = lazy(() =>
  import('@/features/auth').then((m) => ({ default: m.LoginPage }))
);
const DashboardPage = lazy(() =>
  import('@/features/dashboard').then((m) => ({ default: m.DashboardPage }))
);
const CoursesPage = lazy(() =>
  import('@/features/courses').then((m) => ({ default: m.CoursesPage }))
);
const CourseDetailPage = lazy(() =>
  import('@/features/courses').then((m) => ({ default: m.CourseDetailPage }))
);
const LessonPage = lazy(() =>
  import('@/features/courses').then((m) => ({ default: m.LessonPage }))
);
const AssignmentsPage = lazy(() =>
  import('@/features/assignments').then((m) => ({ default: m.AssignmentsPage }))
);
const ForumsPage = lazy(() =>
  import('@/features/forums').then((m) => ({ default: m.ForumsPage }))
);
const ThreadPage = lazy(() =>
  import('@/features/forums').then((m) => ({ default: m.ThreadPage }))
);
const GradesPage = lazy(() =>
  import('@/features/grades').then((m) => ({ default: m.GradesPage }))
);
const NotificationsPage = lazy(() =>
  import('@/features/notifications').then((m) => ({ default: m.NotificationsPage }))
);
const AnalyticsPage = lazy(() =>
  import('@/features/analytics').then((m) => ({ default: m.AnalyticsPage }))
);
const ProfilePage = lazy(() =>
  import('@/features/profile').then((m) => ({ default: m.ProfilePage }))
);

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
      <Spinner size="lg" label="Cargando..." />
    </div>
  );
}

const routes: RouteObject[] = [
  {
    path: '/login',
    element: (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    ),
  },
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
        path: '/courses/:courseId',
        element: (
          <Suspense fallback={<PageLoader />}>
            <CourseDetailPage />
          </Suspense>
        ),
      },
      {
        path: '/courses/:courseId/lessons/:lessonId',
        element: (
          <Suspense fallback={<PageLoader />}>
            <LessonPage />
          </Suspense>
        ),
      },
      {
        path: '/assignments',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AssignmentsPage />
          </Suspense>
        ),
      },
      {
        path: '/forums',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ForumsPage />
          </Suspense>
        ),
      },
      {
        path: '/forums/:threadId',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ThreadPage />
          </Suspense>
        ),
      },
      {
        path: '/grades',
        element: (
          <Suspense fallback={<PageLoader />}>
            <GradesPage />
          </Suspense>
        ),
      },
      {
        path: '/analytics',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AnalyticsPage />
          </Suspense>
        ),
      },
      {
        path: '/notifications',
        element: (
          <Suspense fallback={<PageLoader />}>
            <NotificationsPage />
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
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
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
          background: 'var(--color-bg-primary)',
        }}
      >
        <h1 style={{ fontSize: '4rem', marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
          404
        </h1>
        <p>Page not found.</p>
        <a href="/dashboard" style={{ marginTop: '1rem', color: 'var(--color-accent-primary)' }}>
          Go to Dashboard
        </a>
      </div>
    ),
  },
];

export const router = createBrowserRouter(routes);