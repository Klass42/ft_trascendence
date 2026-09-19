import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type {
  CreateTaskTemplateInput,
  TaskTemplateDTO,
  UpdateTaskTemplateInput,
} from '../types';

interface UseTaskTemplatesResult {
  data: TaskTemplateDTO[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  create: (input: CreateTaskTemplateInput) => Promise<TaskTemplateDTO>;
  update: (id: string, input: UpdateTaskTemplateInput) => Promise<TaskTemplateDTO>;
  remove: (id: string) => Promise<void>;
}

/**
 * Org-scoped task-template library (staff). Tenant is derived server-side.
 */
export function useTaskTemplates(): UseTaskTemplatesResult {
  const [data, setData] = useState<TaskTemplateDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const { user } = useAuth();

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!user) {
      setData(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    apiClient
      .get<TaskTemplateDTO[]>('/task-templates')
      .then((r) => !cancelled && setData(r))
      .catch((err) => {
        if (!cancelled) {
          setError(err as Error);
          setData(null);
        }
      })
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  const create = useCallback(
    async (input: CreateTaskTemplateInput) => {
      const created = await apiClient.post<TaskTemplateDTO>('/task-templates', input);
      refetch();
      return created;
    },
    [refetch],
  );

  const update = useCallback(
    async (id: string, input: UpdateTaskTemplateInput) => {
      const updated = await apiClient.patch<TaskTemplateDTO>(
        `/task-templates/${id}`,
        input,
      );
      refetch();
      return updated;
    },
    [refetch],
  );

  const remove = useCallback(
    async (id: string) => {
      await apiClient.delete<void>(`/task-templates/${id}`);
      refetch();
    },
    [refetch],
  );

  return { data, isLoading, error, refetch, create, update, remove };
}
