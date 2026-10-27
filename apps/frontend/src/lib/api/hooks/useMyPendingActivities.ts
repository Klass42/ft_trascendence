import { useState, useEffect } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { PendingActivityDTO } from '../types';

interface UseMyPendingActivitiesResult {
  data: PendingActivityDTO[] | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Activities the signed-in student still has to hand in, already filtered and
 * sorted by the backend (no completed work, no closed windows, no archived
 * cohorts). Feeds the dashboard "Próxima entrega" card.
 */
export function useMyPendingActivities(): UseMyPendingActivitiesResult {
  const [data, setData] = useState<PendingActivityDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  useEffect(() => {
    if (!orgId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    apiClient.get<PendingActivityDTO[]>('/me/pending-activities')
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err as Error); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [orgId]);

  return { data, isLoading, error };
}
