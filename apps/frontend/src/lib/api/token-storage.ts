/**
 * Token Storage
 * 
 * Strategy pattern for token storage. In production, tokens are stored in
 * localStorage. In development (before auth exists), we use a dev user ID
 * that maps to the x-dev-user header.
 * 
 * When Jorge finishes auth:
 * 1. Remove the DevTokenStorage usage
 * 2. The rest of the code stays the same
 */

import type { AuthTokens } from './types';

// =============================================================================
// Storage Interface
// =============================================================================

export interface TokenStorage {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(tokens: AuthTokens): void;
  clearTokens(): void;
  /** For dev mode: get the user ID to send as x-dev-user header */
  getDevUserId?(): string | null;
}

// =============================================================================
// LocalStorage Implementation (Production)
// =============================================================================

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

export class LocalStorageTokenStorage implements TokenStorage {
  getAccessToken(): string | null {
    try {
      return localStorage.getItem(ACCESS_TOKEN_KEY);
    } catch {
      // localStorage not available (SSR, private browsing, etc.)
      return null;
    }
  }

  getRefreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  setTokens(tokens: AuthTokens): void {
    try {
      localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    } catch {
      console.warn('Failed to save tokens to localStorage');
    }
  }

  clearTokens(): void {
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      // Ignore
    }
  }
}

// =============================================================================
// Development Implementation (Before Auth Exists)
// =============================================================================

/**
 * Dev-only token storage that reads VITE_DEV_USER_ID from environment.
 * This allows testing API calls before real auth is implemented.
 * 
 * The backend's DevAuthGuard reads the x-dev-user header and loads
 * that user from the database, setting req.user as if they were logged in.
 */
export class DevTokenStorage implements TokenStorage {
  private devUserId: string | null;

  constructor() {
    this.devUserId = import.meta.env.VITE_DEV_USER_ID || null;
    
    if (import.meta.env.DEV && !this.devUserId) {
      console.warn(
        '[DevTokenStorage] VITE_DEV_USER_ID not set in .env.development.\n' +
        'API calls requiring auth will fail until:\n' +
        '1. You set VITE_DEV_USER_ID to a valid user ID from the seed, OR\n' +
        '2. Jorge finishes the auth module and you can login normally'
      );
    }
  }

  getAccessToken(): string | null {
    // In dev mode, we don't use real tokens
    return null;
  }

  getRefreshToken(): string | null {
    return null;
  }

  setTokens(_tokens: AuthTokens): void {
    // In dev mode, tokens are not stored (we use x-dev-user header)
    console.info('[DevTokenStorage] Tokens received but not stored in dev mode');
  }

  clearTokens(): void {
    // Nothing to clear
  }

  getDevUserId(): string | null {
    // A per-session override (localStorage key `dev-user-id`) takes precedence
    // over the build-time VITE_DEV_USER_ID. This lets the E2E suite pick a role
    // per spec (teacher vs. student) without restarting Vite, so the tests are
    // deterministic regardless of the developer's local .env. Dev-only: this
    // storage is never instantiated in production (LocalStorageTokenStorage is).
    try {
      const override = localStorage.getItem('dev-user-id');
      if (override) return override;
    } catch {
      // localStorage unavailable — fall back to the env user.
    }
    return this.devUserId;
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Creates the appropriate token storage based on environment.
 * 
 * In development: Uses DevTokenStorage (x-dev-user header)
 * In production: Uses LocalStorageTokenStorage (JWT tokens)
 */
export function createTokenStorage(): TokenStorage {
  // Check if we're in development AND don't have real auth yet
  // Once Jorge finishes auth, we can switch to LocalStorage even in dev
  const isDev = import.meta.env.DEV;
  const hasDevUserId = !!import.meta.env.VITE_DEV_USER_ID;
  
  // Use dev storage if in dev mode and VITE_DEV_USER_ID is set
  // Otherwise, use localStorage (for when auth is ready)
  if (isDev && hasDevUserId) {
    return new DevTokenStorage();
  }
  
  return new LocalStorageTokenStorage();
}

// Default instance
export const tokenStorage = createTokenStorage();
