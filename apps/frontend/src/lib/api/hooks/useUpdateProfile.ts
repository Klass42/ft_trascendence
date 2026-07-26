import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { OwnProfileDTO, UpdateProfileInput } from '@/features/profile/types';

interface UseUpdateProfileResult {
  updateProfile: (input: UpdateProfileInput) => Promise<OwnProfileDTO>;
  isSaving: boolean;
  error: Error | null;
}

export function useUpdateProfile(): UseUpdateProfileResult {
  const { refreshUser } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      setIsSaving(true);
      setError(null);
      try {
        const updated = await apiClient.patch<OwnProfileDTO>('/users/me', input);
        await refreshUser();
        return updated;
      } catch (err) {
        const e = err as Error;
        setError(e);
        throw e;
      } finally {
        setIsSaving(false);
      }
    },
    [refreshUser],
  );

  return { updateProfile, isSaving, error };
}
