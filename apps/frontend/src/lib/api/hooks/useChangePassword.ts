import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import { useToast } from '@/components/ui';

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

interface UseChangePasswordResult {
  changePassword: (input: ChangePasswordInput) => Promise<void>;
  isSaving: boolean;
  error: Error | null;
}

export function useChangePassword(): UseChangePasswordResult {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const changePassword = useCallback(
    async (input: ChangePasswordInput) => {
      setIsSaving(true);
      setError(null);
      try {
        await apiClient.post('/auth/change-password', input);
        logout();
        toast({ variant: 'success', message: 'Contraseña actualizada — inicia sesión de nuevo' });
        navigate('/login');
      } catch (err) {
        const e = err as Error;
        setError(e);
        throw e;
      } finally {
        setIsSaving(false);
      }
    },
    [logout, navigate, toast],
  );

  return { changePassword, isSaving, error };
}
