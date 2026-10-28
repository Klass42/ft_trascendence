/**
 * API Client
 * 
 * Typed fetch wrapper for communicating with the backend API.
 * 
 * Features:
 * - Automatic auth header injection (JWT or x-dev-user)
 * - Automatic 401 handling with token refresh
 * - Normalized error handling
 * - Type-safe methods (get, post, patch, delete, upload)
 * 
 * Usage:
 *   import { apiClient } from '@/lib/api';
 *   
 *   const courses = await apiClient.get<Course[]>('/courses');
 *   const course = await apiClient.post<Course>('/courses', { title: 'New Course' });
 */

import { ApiError, type ApiErrorResponse, type RequestOptions, type UploadOptions } from './types';
import { tokenStorage, type TokenStorage } from './token-storage';

// =============================================================================
// Configuration
// =============================================================================

const API_BASE_URL = '/api';

// =============================================================================
// API Client Class
// =============================================================================

class ApiClient {
  private storage: TokenStorage;
  private refreshPromise: Promise<void> | null = null;
  private onUnauthorized?: () => void;

  constructor(storage: TokenStorage) {
    this.storage = storage;
  }

  /**
   * Set callback for when user is unauthorized (after refresh fails)
   * This is called by AuthProvider to trigger logout
   */
  setOnUnauthorized(callback: () => void): void {
    this.onUnauthorized = callback;
  }

  // ---------------------------------------------------------------------------
  // Public Methods
  // ---------------------------------------------------------------------------

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  }

  async patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  /**
   * Upload a file using multipart/form-data
   */
  async upload<T>(path: string, file: File, options?: UploadOptions): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    // Add additional fields if provided
    if (options?.fields) {
      for (const [key, value] of Object.entries(options.fields)) {
        formData.append(key, value);
      }
    }

    // Note: Don't set Content-Type header - browser sets it with boundary
    return this.request<T>(path, {
      ...options,
      method: options?.method ?? 'POST',
      body: formData,
    });
  }

  /**
   * Upload a file using XMLHttpRequest for progress tracking
   * Use this when you need upload progress callbacks
   */
  async uploadWithProgress<T>(
    path: string,
    file: File,
    options?: UploadOptions & { signal?: { aborted: boolean } }
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      if (options?.fields) {
        for (const [key, value] of Object.entries(options.fields)) {
          formData.append(key, value);
        }
      }

      const xhr = new XMLHttpRequest();
      const url = `${API_BASE_URL}${path}`;

      // Track upload progress
      if (options?.onProgress) {
        xhr.upload.onprogress = (e: ProgressEvent) => {
          if (e.lengthComputable) {
            options.onProgress!(Math.round((e.loaded / e.total) * 100));
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data as T);
          } catch {
            reject(new ApiError(xhr.status, 'Invalid response from server'));
          }
        } else {
          const contentType = xhr.getResponseHeader('content-type');
          if (contentType?.includes('application/json')) {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(ApiError.fromResponse(xhr.status, errorData));
            } catch {
              reject(new ApiError(xhr.status, xhr.statusText || 'Upload failed'));
            }
          } else {
            reject(new ApiError(xhr.status, xhr.statusText || 'Upload failed'));
          }
        }
      };

      xhr.onerror = () => {
        // Check if aborted
        if (options?.signal?.aborted) return;
        reject(new ApiError(0, 'Network error'));
      };

      xhr.ontimeout = () => {
        reject(new ApiError(0, 'Upload timed out'));
      };

      xhr.open(options?.method ?? 'POST', url);
      xhr.timeout = 15000; // 15s default timeout

      // Add auth headers
      if (!options?.skipAuth) {
        const headers = new Headers();
        this.addAuthHeader(headers);
        headers.forEach((value, key) => {
          xhr.setRequestHeader(key, value);
        });
      }

      xhr.send(formData);
    });
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private async request<T>(
    path: string,
    options: RequestOptions & { method: string; body?: BodyInit }
  ): Promise<T> {
    const url = `${API_BASE_URL}${path}`;
    const headers = new Headers(options.headers);

    // Add auth header unless explicitly skipped
    if (!options.skipAuth) {
      this.addAuthHeader(headers);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 - try to refresh token
    if (response.status === 401 && !options.skipAuth) {
      const refreshed = await this.tryRefreshToken();
      
      if (refreshed) {
        // Retry the request with new token
        this.addAuthHeader(headers);
        const retryResponse = await fetch(url, { ...options, headers });
        return this.handleResponse<T>(retryResponse);
      }
      
      // Refresh failed - trigger logout
      this.onUnauthorized?.();
      throw new ApiError(401, 'Session expired. Please login again.');
    }

    return this.handleResponse<T>(response);
  }

  private addAuthHeader(headers: Headers): void {
    // In dev mode with DevTokenStorage, use x-dev-user header
    const devUserId = this.storage.getDevUserId?.();
    if (devUserId) {
      headers.set('x-dev-user', devUserId);
      return;
    }

    // In production, use Bearer token
    const accessToken = this.storage.getAccessToken();
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    // Handle no content
    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    if (!response.ok) {
      if (isJson) {
        const errorData: ApiErrorResponse = await response.json();
        throw ApiError.fromResponse(response.status, errorData);
      }
      throw new ApiError(response.status, response.statusText || 'Request failed');
    }

    if (isJson) {
      return response.json() as Promise<T>;
    }

    // For non-JSON responses (e.g., file downloads)
    return response.text() as unknown as T;
  }

  /** Refreshes the session tokens on demand (e.g. for the realtime socket); false if it failed. */
  refreshSession(): Promise<boolean> {
    return this.tryRefreshToken();
  }

  private async tryRefreshToken(): Promise<boolean> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      try {
        await this.refreshPromise;
        return true;
      } catch {
        return false;
      }
    }

    const refreshToken = this.storage.getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    this.refreshPromise = this.doRefreshToken(refreshToken);

    try {
      await this.refreshPromise;
      return true;
    } catch {
      return false;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefreshToken(refreshToken: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      this.storage.clearTokens();
      throw new Error('Token refresh failed');
    }

    const tokens = await response.json();
    this.storage.setTokens(tokens);
  }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const apiClient = new ApiClient(tokenStorage);

// Also export the class for testing
export { ApiClient };
