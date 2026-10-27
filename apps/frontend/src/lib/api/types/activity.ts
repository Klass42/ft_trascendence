/**
 * Activity engine DTOs. Mirrors the backend `activities/` module.
 * `content`/`response`/`config` are loose JSON bags whose shape depends on the
 * question kind; the per-kind editors and the backend validate them.
 */
import type { FileDTO } from './course';
import type { SubmissionAuthorDTO } from './assignment';

export type ActivityType = 'QUIZ' | 'LISTENING' | 'SPEAKING';
export type ActivityStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type QuestionKind =
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'FILL_BLANK'
  | 'MATCHING'
  | 'ORDERING'
  | 'SHORT_ANSWER'
  | 'ESSAY'
  | 'FILE_UPLOAD';
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';

export interface QuestionDTO {
  id: string;
  activityId: string;
  kind: QuestionKind;
  prompt: string;
  points: number;
  order: number;
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Teacher prompt attachments on an activity (not student FILE_UPLOAD answers). */
export interface ActivityFileDTO {
  activityId: string;
  fileId: string;
  file: FileDTO;
}

export interface ActivityDTO {
  id: string;
  subjectId: string;
  type: ActivityType;
  title: string;
  description: string | null;
  openAt: string | null;
  dueAt: string | null;
  closeAt: string | null;
  maxScore: number;
  attemptsAllowed: number;
  timeLimitSec: number | null;
  config: Record<string, unknown>;
  status: ActivityStatus;
  countsTowardFinal: boolean;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
  questions?: QuestionDTO[];
  files?: ActivityFileDTO[];
}

export interface CreateActivityInput {
  type?: ActivityType;
  title: string;
  description?: string;
  openAt?: string | null;
  dueAt?: string | null;
  closeAt?: string | null;
  /** Ignored by the API — maxScore is always sum(question.points). */
  maxScore?: number;
  attemptsAllowed?: number;
  timeLimitSec?: number | null;
  config?: Record<string, unknown>;
  status?: ActivityStatus;
  countsTowardFinal?: boolean;
  templateId?: string;
  sourceActivityId?: string;
  fileIds?: string[];
}

export type UpdateActivityInput = Partial<
  Omit<CreateActivityInput, 'templateId' | 'sourceActivityId'>
>;

export interface CreateQuestionInput {
  kind: QuestionKind;
  prompt: string;
  points?: number;
  order?: number;
  content: Record<string, unknown>;
}

export type UpdateQuestionInput = Partial<CreateQuestionInput>;

// ─── Attempts ───────────────────────────────────────────────────────────────
export interface AnswerDTO {
  id: string;
  attemptId: string;
  questionId: string;
  response: Record<string, unknown>;
  correct: boolean | null;
  awarded: number | null;
  /** Original file names are included only in the staff attempt list. */
  files?: Array<{ id: string; originalName: string }>;
}

export interface AttemptDTO {
  id: string;
  activityId: string;
  userId: string;
  attemptNo: number;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  gradedAt: string | null;
  feedback: string | null;
  answers?: AnswerDTO[];
  activity?: ActivityDTO;
  /** Present on the staff list endpoint only. */
  user?: SubmissionAuthorDTO;
}

export interface SaveAnswersInput {
  answers: { questionId: string; response: Record<string, unknown> }[];
}

export interface PreviewGradeResult {
  questionId: string;
  autoGradable: boolean;
  correct: boolean | null;
  awarded: number | null;
  points: number;
}

export interface PreviewGradeResponse {
  score: number;
  maxScore: number;
  results: PreviewGradeResult[];
  solutions: Array<{ questionId: string; content: Record<string, unknown> }>;
}

export interface GradeAttemptInput {
  answers: { questionId: string; awarded: number }[];
  feedback?: string;
}
