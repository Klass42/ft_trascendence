import { useState, useEffect } from 'react';
import { apiClient } from '../client';
import type { OrgDTO, MemberDTO } from '@/features/org/types';

interface UseOrgResult {
  data: OrgDTO | null;
  isLoading: boolean;
  error: Error | null;
}

export function useOrg(): UseOrgResult {
  const [data, setData] = useState<OrgDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient
      .get<OrgDTO>('/organizations/me')
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

interface UseOrgMembersResult {
  data: MemberDTO[] | null;
  isLoading: boolean;
  error: Error | null;
}

export function useOrgMembers(
  orgId: string | undefined,
): UseOrgMembersResult {
  const [data, setData] = useState<MemberDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!orgId) {
      setIsLoading(false);
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient
      .get<MemberDTO[]>(`/organizations/${orgId}/members`)
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
  }, [orgId]);

  return { data, isLoading, error };
}
