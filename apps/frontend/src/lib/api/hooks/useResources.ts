import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type {
  SubjectResourceDTO,
  LearningResourceDTO,
  LearningResourceStatus,
  LearningResourceType,
} from '../types';

export interface ResourceFilters {
  search?: string;
  type?: LearningResourceType;
  status?: LearningResourceStatus;
}

export function useResources(filters: ResourceFilters = {}) {
  const { user } = useAuth();
  const [data, setData] = useState<LearningResourceDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const search = filters.search ?? '';
  const type = filters.type ?? '';
  const status = filters.status ?? '';

  const refresh = useCallback(async () => {
    if (!user?.organizationId) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    try {
      const result = await apiClient.get<LearningResourceDTO[]>(`/resources?${params}`);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.organizationId, search, status, type]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { data, isLoading, error, refresh };
}

export function useCourseResources(courseId: string | undefined, filters: Omit<ResourceFilters, 'status'> = {}) {
  const { user } = useAuth();
  const [data, setData] = useState<SubjectResourceDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const search = filters.search ?? '';
  const type = filters.type ?? '';

  const refresh = useCallback(async () => {
    if (!courseId || !user?.organizationId) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type) params.set('type', type);
    try {
      const result = await apiClient.get<SubjectResourceDTO[]>(`/subjects/${courseId}/resources?${params}`);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [courseId, search, type, user?.organizationId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { data, isLoading, error, refresh };
}
