import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import type {
  CreatePostInput,
  CreateThreadInput,
  ForumPostDTO,
  ForumThreadDTO,
  ForumThreadListItemDTO,
} from '../types';

interface MutationState {
  isLoading: boolean;
  error: Error | null;
}

/** Create a new thread in a course (any course member). */
export function useCreateThread() {
  const [state, setState] = useState<MutationState>({
    isLoading: false,
    error: null,
  });

  const create = useCallback(
    async (courseId: string, input: CreateThreadInput) => {
      setState({ isLoading: true, error: null });
      try {
        const thread = await apiClient.post<ForumThreadListItemDTO>(
          `/subjects/${courseId}/forum/threads`,
          input,
        );
        setState({ isLoading: false, error: null });
        return thread;
      } catch (err) {
        setState({ isLoading: false, error: err as Error });
        throw err;
      }
    },
    [],
  );

  return { create, ...state };
}

/** Add a post/reply to a thread (any course member). */
export function useCreatePost() {
  const [state, setState] = useState<MutationState>({
    isLoading: false,
    error: null,
  });

  const create = useCallback(
    async (threadId: string, input: CreatePostInput) => {
      setState({ isLoading: true, error: null });
      try {
        const post = await apiClient.post<ForumPostDTO>(
          `/threads/${threadId}/posts`,
          input,
        );
        setState({ isLoading: false, error: null });
        return post;
      } catch (err) {
        setState({ isLoading: false, error: err as Error });
        throw err;
      }
    },
    [],
  );

  return { create, ...state };
}

/** Toggle a thread's pinned flag (course staff only — enforced server-side). */
export function usePinThread() {
  const [state, setState] = useState<MutationState>({
    isLoading: false,
    error: null,
  });

  const togglePin = useCallback(async (threadId: string) => {
    setState({ isLoading: true, error: null });
    try {
      const thread = await apiClient.patch<ForumThreadDTO>(
        `/threads/${threadId}/pin`,
      );
      setState({ isLoading: false, error: null });
      return thread;
    } catch (err) {
      setState({ isLoading: false, error: err as Error });
      throw err;
    }
  }, []);

  return { togglePin, ...state };
}
