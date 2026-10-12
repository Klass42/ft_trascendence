/**
 * Task-template library DTOs. Mirrors `activities/templates` on the backend.
 */
import type { ActivityStatus, QuestionKind } from './activity';

export interface TaskTemplateBlock {
  kind: QuestionKind;
  prompt: string;
  points: number;
  order: number;
  content: Record<string, unknown>;
}

export interface TaskTemplateDTO {
  id: string;
  organizationId: string;
  createdById: string;
  title: string;
  description: string | null;
  blocks: TaskTemplateBlock[];
  createdFromId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskTemplateInput {
  title: string;
  description?: string;
  blocks: TaskTemplateBlock[];
}

export interface UpdateTaskTemplateInput {
  title?: string;
  description?: string | null;
  blocks?: TaskTemplateBlock[];
}

export interface SaveAsTemplateInput {
  title?: string;
  description?: string;
}

/** Instance from GET /me/teaching/activities (library «Anteriores»). */
export interface TeachingActivityDTO {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  status: ActivityStatus;
  countsTowardFinal: boolean;
  attemptCount: number;
  createdAt: string;
  dueAt: string | null;
}
