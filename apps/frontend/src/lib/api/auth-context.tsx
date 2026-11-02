/**
 * Auth Context
 * 
 * Provides authentication state and methods to the entire app via React Context.
 * 
 * Usage:
 *   // In App.tsx
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 * 
 *   // In any component
 *   const { user, isLoading, login, logout } = useAuth();
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { apiClient } from './client';
import { tokenStorage } from './token-storage';
import type { AuthUser, AuthTokens } from './types';

// =============================================================================
// Mock User for Development (before Jorge finishes auth)
// =============================================================================

/**
 * Mock user for development when no auth backend exists yet.
 * This allows seeing the full UI without a working auth system.
 * 
 * Set VITE_USE_MOCK_AUTH=true in .env.development to enable.
 * Remove this when real auth is implemented.
 */
const MOCK_USER: AuthUser = {
  userId: 'user-lucia-001',
  email: 'dev@example.com',
  name: 'Lucía Molina',
  avatarUrl: null,
  organizationId: 'org-klass-0001',
  role: 'STUDENT', // STUDENT to see the student dashboard
  platformRole: 'NONE',
  emailNotificationsEnabled: true,
  preferredLanguage: 'es',
};

const USE_MOCK_AUTH = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_AUTH === 'true';

// =============================================================================
// Types
// =============================================================================

interface AuthContextValue {
  /** Current authenticated user, or null if not logged in */
  user: AuthUser | null;
  /** True while checking initial auth state */
  isLoading: boolean;
  /** True if user is authenticated */
  isAuthenticated: boolean;
  /** Login with email/password */
  login: (organizationSlug: string, email: string, password: string) => Promise<void>;
  /** Platform accounts have no organization and authenticate separately. */
  loginPlatform: (email: string, password: string) => Promise<void>;
  /** Register with name/email/password inside an organization */
  /** Register. Resolves to `true` when signed in, or to the pending-verification message (#74). */
  register: (name: string, email: string, password: string, organizationSlug: string) => Promise<true | string>;
  /** Login with OAuth (Google) inside an organization. Returns false if the code is not a slug. */
  loginWithGoogle: (organizationSlug: string) => boolean;
  /** Logout and clear tokens */
  logout: () => void;
  /** Refresh user data from server */
  refreshUser: () => Promise<void>;
}

interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

// =============================================================================
// Context
// =============================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // Logout handler (also used by apiClient on 401)
  // ---------------------------------------------------------------------------
  const logout = useCallback(() => {
    tokenStorage.clearTokens();
    setUser(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch current user from /auth/me
  // ---------------------------------------------------------------------------
  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await apiClient.get<AuthUser>('/auth/me');
      setUser(currentUser);
    } catch {
      // If fetching user fails, clear auth state
      logout();
    }
  }, [logout]);

  // ---------------------------------------------------------------------------
  // Initial auth check on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Register the unauthorized callback with apiClient
    apiClient.setOnUnauthorized(logout);

    const initAuth = async () => {
      // If mock auth is enabled, use mock user immediately
      if (USE_MOCK_AUTH) {
        console.info('[Auth] Using mock user for development');
        setUser(MOCK_USER);
        setIsLoading(false);
        return;
      }

      // Check if we have a token or dev user ID
      const hasToken = tokenStorage.getAccessToken();
      const hasDevUser = tokenStorage.getDevUserId?.();

      if (hasToken || hasDevUser) {
        await refreshUser();
      }
      
      setIsLoading(false);
    };

    initAuth();
  }, [logout, refreshUser]);

  // ---------------------------------------------------------------------------
  // Login with email/password
  // ---------------------------------------------------------------------------
  const login = useCallback(async (organizationSlug: string, email: string, password: string) => {
    const response = await apiClient.post<LoginResponse>(
      '/auth/login',
      { organizationSlug, email, password },
      { skipAuth: true }
    );

    // Store tokens
    const tokens: AuthTokens = {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    };
    tokenStorage.setTokens(tokens);

    // Set user
    setUser(response.user);
  }, []);

  const loginPlatform = useCallback(async (email: string, password: string) => {
    const response = await apiClient.post<LoginResponse>('/auth/platform-login', { email, password }, { skipAuth: true });
    tokenStorage.setTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken });
    setUser(response.user);
  }, []);

  // ---------------------------------------------------------------------------
  // Register with name/email/password
  // ---------------------------------------------------------------------------
  const register = useCallback(async (name: string, email: string, password: string, organizationSlug: string) => {
    const response = await apiClient.post<LoginResponse | { verificationRequired: true; message: string }>(
      '/auth/register',
      { name, email, password, organizationSlug },
      { skipAuth: true }
    );
    // #74: no tokens until the e-mail is verified.
    if ('verificationRequired' in response) return response.message;

    const tokens: AuthTokens = {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    };
    tokenStorage.setTokens(tokens);

    setUser(response.user);
    return true as const;
  }, []);

  // ---------------------------------------------------------------------------
  // Login with Google OAuth
  // ---------------------------------------------------------------------------
  const loginWithGoogle = useCallback((organizationSlug: string) => {
    const slug = organizationSlug.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return false;
    const params = new URLSearchParams({ organizationSlug: slug });
    window.location.href = `/api/auth/google?${params.toString()}`;
    return true;
  }, []);

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      loginPlatform,
      register,
      loginWithGoogle,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, loginPlatform, register, loginWithGoogle, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// =============================================================================
// Hook
// =============================================================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

// =============================================================================
// Helper Hooks
// =============================================================================

/**
 * Hook that returns true if user has any of the specified roles
 */
export function useHasRole(...roles: AuthUser['role'][]): boolean {
  const { user } = useAuth();
  return !!user && roles.includes(user.role);
}

/**
 * Hook that returns true if user is an admin
 */
export function useIsAdmin(): boolean {
  return useHasRole('ADMIN');
}

/**
 * Hook that returns true if user is a teacher or admin
 */
export function useIsTeacher(): boolean {
  return useHasRole('TEACHER', 'ADMIN');
}
