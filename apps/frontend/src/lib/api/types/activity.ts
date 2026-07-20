/**
 * Activity engine DTOs (Phase B). Mirrors the backend `activities/` module.
 * `content`/`response`/`config` are loose JSON bags whose shape depends on the
 * question kind; the per-kind editors and the backend validate them.
 */
export type ActivityType = 'QUIZ' | 'LISTENING' | 'SPEAKING';
export type ActivityStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type QuestionKind =
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'FILL_BLANK'
  | 'MATCHING'
  | 'ORDERING'
  | 'SHORT_ANSWER';
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

export interface ActivityDTO {
  id: string;
  courseId: string;
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
  createdAt: string;
  updatedAt: string;
  questions?: QuestionDTO[];
}

export interface CreateActivityInput {
  type?: ActivityType;
  title: string;
  description?: string;
  openAt?: string | null;
  dueAt?: string | null;
  closeAt?: string | null;
  maxScore?: number;
  attemptsAllowed?: number;
  timeLimitSec?: number | null;
  config?: Record<string, unknown>;
  status?: ActivityStatus;
}

export type UpdateActivityInput = Partial<CreateActivityInput>;

export interface CreateQuestionInput {
  kind: QuestionKind;
  prompt: string;
  points?: number;
  order?: number;
  content: Record<string, unknown>;
}

export type UpdateQuestionInput = Partial<CreateQuestionInput>;

// ─── Attempts (used by the student player, B2b) ─────────────────────────────
export interface AnswerDTO {
  id: string;
  attemptId: string;
  questionId: string;
  response: Record<string, unknown>;
  correct: boolean | null;
  awarded: number | null;
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
  answers?: AnswerDTO[];
  activity?: ActivityDTO;
}

export interface SaveAnswersInput {
  answers: { questionId: string; response: Record<string, unknown> }[];
}
