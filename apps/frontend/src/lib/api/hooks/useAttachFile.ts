import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { LessonAttachmentDTO } from '../types';

interface UseAttachFileResult {
  attach: (lessonId: string, fileId: string) => Promise<LessonAttachmentDTO>;
  isLoading: boolean;
  error: Error | null;
}

export function useAttachFile(): UseAttachFileResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const attach = useCallback(
    async (lessonId: string, fileId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        return await apiClient.post<LessonAttachmentDTO>(
          `/lessons/${lessonId}/attachments?organizationId=${orgId}`,
          { fileId },
        );
      } catch (err) {
        const e = err as Error;
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  return { attach, isLoading, error };
}
