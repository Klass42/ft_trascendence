import { useState, useEffect } from 'react';
import { apiClient } from '../client';
import type { UserDTO } from '@/features/admin/types';

interface UseUsersResult {
  data: UserDTO[] | null;
  isLoading: boolean;
  error: Error | null;
}

export function useUsers(): UseUsersResult {
  const [data, setData] = useState<UserDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient
      .get<UserDTO[]>('/users')
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err as Error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}

interface UseUserResult {
  data: UserDTO | null;
  isLoading: boolean;
  error: Error | null;
}

export function useUser(id: string | undefined): UseUserResult {
  const [data, setData] = useState<UserDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient
      .get<UserDTO>(`/users/${id}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err as Error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { data, isLoading, error };
}
