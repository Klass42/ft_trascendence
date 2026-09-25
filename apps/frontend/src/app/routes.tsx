import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  type RouteObject,
} from 'react-router-dom';
import { Spinner } from '@/components/ui';
import { AppLayout } from './AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { PlatformRoute } from './PlatformRoute';
import { PlatformLayout } from './PlatformLayout';

const LoginPage = lazy(() =>
  import('@/features/auth').then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import('@/features/auth').then((m) => ({ default: m.RegisterPage }))
);
const AcceptInvitationPage = lazy(() =>
  import('@/features/auth').then((m) => ({ default: m.AcceptInvitationPage }))
);
const VerifyEmailPage = lazy(() =>
  import('@/features/auth').then((m) => ({ default: m.VerifyEmailPage }))
);
const OAuthCallbackPage = lazy(() =>
  import('@/features/auth').then((m) => ({ default: m.OAuthCallbackPage }))
);
const LegalPage = lazy(() =>
  import('@/features/legal').then((m) => ({ default: m.LegalPage }))
);
const DashboardPage = lazy(() =>
  import('@/features/dashboard').then((m) => ({ default: m.DashboardPage }))
);
const CoursesPage = lazy(() =>
  import('@/features/courses').then((m) => ({ default: m.CoursesPage }))
);
const CourseCohortPage = lazy(() =>
  import('@/features/courses').then((m) => ({ default: m.CourseCohortPage }))
);
const CourseDetailPage = lazy(() =>
  import('@/features/courses').then((m) => ({ default: m.CourseDetailPage }))
);
const LessonPage = lazy(() =>
  import('@/features/courses').then((m) => ({ default: m.LessonPage }))
);
const ActivitiesPage = lazy(() =>
  import('@/features/activities').then((m) => ({ default: m.ActivitiesPage }))
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
const ResourcesPage = lazy(() =>
  import('@/features/resources').then((m) => ({ default: m.ResourcesPage }))
);
const ProfilePage = lazy(() =>
  import('@/features/profile').then((m) => ({ default: m.ProfilePage }))
);
const AdminUsersPage = lazy(() =>
  import('@/features/admin').then((m) => ({ default: m.AdminUsersPage }))
);
const AdminUserCreatePage = lazy(() =>
  import('@/features/admin').then((m) => ({ default: m.AdminUserCreatePage }))
);
const AdminUserInvitePage = lazy(() =>
  import('@/features/admin').then((m) => ({ default: m.AdminUserInvitePage }))
);
const AdminUserEditPage = lazy(() =>
  import('@/features/admin').then((m) => ({ default: m.AdminUserEditPage }))
);
const OrgSettingsPage = lazy(() =>
  import('@/features/org').then((m) => ({ default: m.OrgSettingsPage }))
);
const OrgMembersPage = lazy(() =>
  import('@/features/org').then((m) => ({ default: m.OrgMembersPage }))
);
const PlatformOrganizationsPage = lazy(() => import('@/features/platform').then(m => ({ default: m.PlatformOrganizationsPage })));
const PlatformOrganizationFormPage = lazy(() => import('@/features/platform').then(m => ({ default: m.PlatformOrganizationFormPage })));
const PlatformLoginPage = lazy(() => import('@/features/platform').then(m => ({ default: m.PlatformLoginPage })));

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
    path: '/platform/login',
    element: <Suspense fallback={<PageLoader />}><PlatformLoginPage /></Suspense>,
  },
  {
    path: '/platform',
    element: <PlatformRoute />,
    children: [{ element: <PlatformLayout />, children: [
      { index: true, element: <Navigate to="organizations" replace /> },
      { path: 'organizations', element: <Suspense fallback={<PageLoader />}><PlatformOrganizationsPage /></Suspense> },
      { path: 'organizations/new', element: <Suspense fallback={<PageLoader />}><PlatformOrganizationFormPage /></Suspense> },
      { path: 'organizations/:id', element: <Suspense fallback={<PageLoader />}><PlatformOrganizationsPage /></Suspense> },
    ] }],
  },
  {
    path: '/login',
    element: (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/register',
    element: (
      <Suspense fallback={<PageLoader />}>
        <RegisterPage />
      </Suspense>
    ),
  },
  {
    path: '/invite/:token',
    element: (
      <Suspense fallback={<PageLoader />}>
        <AcceptInvitationPage />
      </Suspense>
    ),
  },
  {
    path: '/verify-email',
    element: (
      <Suspense fallback={<PageLoader />}>
        <VerifyEmailPage />
      </Suspense>
    ),
  },
  {
    path: '/auth/callback',
    element: (
      <Suspense fallback={<PageLoader />}>
        <OAuthCallbackPage />
      </Suspense>
    ),
  },
  {
    path: '/privacy',
    element: (
      <Suspense fallback={<PageLoader />}>
        <LegalPage document="privacy" />
      </Suspense>
    ),
  },
  {
    path: '/terms',
    element: (
      <Suspense fallback={<PageLoader />}>
        <LegalPage document="terms" />
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
            <CourseCohortPage />
          </Suspense>
        ),
      },
      {
        path: '/courses/:courseId/subjects/:subjectId',
        element: (
          <Suspense fallback={<PageLoader />}>
            <CourseDetailPage />
          </Suspense>
        ),
      },
      {
        path: '/courses/:courseId/subjects/:subjectId/lessons/:lessonId',
        element: (
          <Suspense fallback={<PageLoader />}>
            <LessonPage />
          </Suspense>
        ),
      },
      {
        path: '/assignments',
        element: <Navigate to="/activities" replace />,
      },
      {
        path: '/activities',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ActivitiesPage />
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
        path: '/resources',
        element: (
          <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
            <Suspense fallback={<PageLoader />}>
              <ResourcesPage />
            </Suspense>
          </ProtectedRoute>
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
      {
        path: 'admin',
        element: (
          <ProtectedRoute roles={['ADMIN']}>
            <Outlet />
          </ProtectedRoute>
        ),
        children: [
          {
            path: 'users/invite',
            element: (
              <Suspense fallback={<PageLoader />}>
                <AdminUserInvitePage />
              </Suspense>
            ),
          },
          {
            path: 'users/new',
            element: (
              <Suspense fallback={<PageLoader />}>
                <AdminUserCreatePage />
              </Suspense>
            ),
          },
          {
            path: 'users/:id',
            element: (
              <Suspense fallback={<PageLoader />}>
                <AdminUserEditPage />
              </Suspense>
            ),
          },
          {
            path: 'users',
            element: (
              <Suspense fallback={<PageLoader />}>
                <AdminUsersPage />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: 'org',
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<PageLoader />}>
                <OrgSettingsPage />
              </Suspense>
            ),
          },
          {
            path: 'members',
            element: (
              <ProtectedRoute roles={['ADMIN']}>
                <Suspense fallback={<PageLoader />}>
                  <OrgMembersPage />
                </Suspense>
              </ProtectedRoute>
            ),
          },
        ],
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
