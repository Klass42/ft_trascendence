# Task templates & unified tasks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify assignments and activities into one task made of blocks, with reusable templates, persisted grades, and a per-task `countsTowardFinal` flag.

**Architecture:** Keep Prisma `Activity`/`Question`/`Attempt`/`Answer` as the instance. Add a block-kind registry (`ESSAY`, `FILE_UPLOAD` + the existing six), `TaskTemplate` (JSON snapshot), `ActivityFile`, and `countsTowardFinal`. `GradingService` reads attempts only; a pure `computeFinalGrade` is the average. Migrate `Assignment` rows with gradebook parity, then 410 mutation endpoints. Frontend: one `/activities` surface (copy «Tareas»), `/assignments` redirects.

**Tech Stack:** NestJS 10, Prisma + PostgreSQL, React 19 + Vite, `@/components/ui`, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-19-task-templates-design.md`

## Global Constraints

- Product copy: «Tarea». Persistence names stay `Activity`/`Question`/`Attempt` (no Prisma rename).
- `organizationId` is derived from course/user; never trusted from the client. Cross-org → 404.
- Staff = existing `STAFF_ROLES` (`TEACHER`/`ASSISTANT` on the course). Template write/delete = author or org `ADMIN`. Template list/instantiate = any staff of a course in that org.
- Validate every form client + server. UI Spanish. Compose `@/components/ui`. Zero console errors.
- Do not drop `Assignment*` tables. After cutover, mutation routes return 410.
- Out of v1: LISTENING/SPEAKING adapters, weighted categories, rubrics, peer review.
- Do **not** git commit unless Jorge explicitly asks.
- Do not call Engram. Parent orchestrator owns wake/handoff.
- Tests: `pnpm --filter backend test` (Jest). Frontend unit if present; E2E is Task 12.

---

## File Structure

**Backend create:**
- `apps/backend/src/activities/blocks/types.ts` — `BlockKindAdapter`, `GradeResult`
- `apps/backend/src/activities/blocks/essay.ts`
- `apps/backend/src/activities/blocks/file-upload.ts`
- `apps/backend/src/activities/blocks/registry.ts` — `BLOCK_ADAPTERS`, `getAdapter`
- `apps/backend/src/activities/blocks/registry.spec.ts`
- `apps/backend/src/assignments/grading/final-grade.ts` — pure `computeFinalGrade`
- `apps/backend/src/assignments/grading/final-grade.spec.ts`
- `apps/backend/src/activities/templates/task-templates.service.ts`
- `apps/backend/src/activities/templates/task-templates.controller.ts`
- `apps/backend/src/activities/templates/task-templates.service.spec.ts`
- `apps/backend/src/activities/templates/dto/create-task-template.dto.ts`
- `apps/backend/src/activities/templates/dto/update-task-template.dto.ts`
- `apps/backend/src/activities/templates/dto/save-as-template.dto.ts`
- `apps/backend/prisma/migrate-assignments-to-activities.ts`
- `apps/backend/src/activities/templates/migrate-assignments.spec.ts` (pure mapper tests)

**Backend modify:**
- `apps/backend/prisma/schema.prisma` — `TaskTemplate`, `ActivityFile`, `QuestionKind` + fields
- `apps/backend/src/activities/activities.module.ts`
- `apps/backend/src/activities/activities.service.ts`
- `apps/backend/src/activities/activities.controller.ts`
- `apps/backend/src/activities/dto/create-activity.dto.ts` / `update-activity.dto.ts`
- `apps/backend/src/activities/attempts/attempts.service.ts`
- `apps/backend/src/activities/attempts/dto/grade-attempt.dto.ts`
- `apps/backend/src/activities/attempts/attempts.service.spec.ts`
- `apps/backend/src/assignments/grading/grading.service.ts`
- `apps/backend/src/assignments/grading/grading.controller.ts`
- `apps/backend/src/assignments/grading/grading.service.spec.ts`
- `apps/backend/src/assignments/assignments.controller.ts` (410 after cutover)
- `apps/backend/prisma/seed.ts`
- `apps/backend/src/activities/grading/graders.ts` — keep `gradeQuestion`; subjective kinds stay without `GRADERS` entry

**Frontend modify/create:**
- `apps/frontend/src/lib/api/types/activity.ts`, `gradebook.ts`
- `apps/frontend/src/lib/api/hooks/*` templates + mutations
- `apps/frontend/src/features/activities/*` (form, player, library, ESSAY/FILE editors)
- `apps/frontend/src/features/gradebook/*`, `grades/GradesPage.tsx`
- `apps/frontend/src/app/routes.tsx` — redirect `/assignments`
- `apps/frontend/e2e/tasks.spec.ts`

---

### Task 1: Prisma additive schema

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/20260919120000_task_templates/migration.sql` (or `prisma migrate dev --name task_templates` when DB is up)

**Interfaces:**
- Produces: `QuestionKind.ESSAY | FILE_UPLOAD`; `Activity.countsTowardFinal: boolean`; `Activity.templateId: string | null`; `Attempt.feedback: string | null`; models `TaskTemplate`, `ActivityFile`

- [ ] **Step 1: Extend `QuestionKind`**

```prisma
enum QuestionKind {
  MULTIPLE_CHOICE
  TRUE_FALSE
  FILL_BLANK
  MATCHING
  ORDERING
  SHORT_ANSWER
  ESSAY
  FILE_UPLOAD
}
```

- [ ] **Step 2: Add `TaskTemplate` and `ActivityFile`; patch `Activity`, `Attempt`, `Organization`, `User`, `File`**

On `Organization` add `taskTemplates TaskTemplate[]`.
On `User` add `taskTemplates TaskTemplate[] @relation("TaskTemplateAuthor")`.
On `File` add `activityFiles ActivityFile[]`.
On `Activity` add:

```prisma
  countsTowardFinal Boolean @default(true)
  templateId        String?
  files             ActivityFile[]
```

On `Attempt` add `feedback String?`.

New models (exact text from spec §4.1): `TaskTemplate` with `blocks Json`, `createdFromId String?`, indexes; `ActivityFile` composite id.

- [ ] **Step 3: Validate schema**

Run: `pnpm --filter backend exec prisma validate`
Expected: valid.

- [ ] **Step 4: Generate client**

Run: `pnpm --filter backend exec prisma generate`

---

### Task 2: Block registry — ESSAY + FILE_UPLOAD

**Files:**
- Create: `apps/backend/src/activities/blocks/types.ts`
- Create: `apps/backend/src/activities/blocks/essay.ts`
- Create: `apps/backend/src/activities/blocks/file-upload.ts`
- Create: `apps/backend/src/activities/blocks/registry.ts`
- Create: `apps/backend/src/activities/blocks/registry.spec.ts`
- Modify: `apps/backend/src/activities/activities.service.ts` `validateQuestionContent` — delegate to `getAdapter(kind).validateContent`

**Interfaces:**
- Produces:

```ts
export interface GradeResult { correct: boolean; awarded: number; }
export interface BlockKindAdapter {
  kind: QuestionKind;
  validateContent(content: unknown): void; // throws BadRequestException
  validateResponse(response: unknown): void;
  grade?(content: unknown, response: unknown, points: number): GradeResult;
}
export function getAdapter(kind: QuestionKind): BlockKindAdapter;
export const SECRET_CONTENT_KEYS: Partial<Record<QuestionKind, string[]>>;
```

`ESSAY` content `{ minChars?: number, maxChars?: number }` (both optional ints ≥ 0; if both set `minChars ≤ maxChars`). Response `{ text: string }`. No `grade`.
`FILE_UPLOAD` content `{ maxFiles: number, accept?: string[] }` (`maxFiles` integer ≥ 1; `accept` optional string[]). Response `{ fileIds: string[] }` (array of nonempty strings, length 1..maxFiles). No `grade`.
`SECRET_CONTENT_KEYS`: existing keys `correct`, `accepted`, `pairs`, `correctOrder`, `answer`. ESSAY/FILE_UPLOAD: `[]`.

- [ ] **Step 1: Write failing tests** in `registry.spec.ts`

```ts
import { BadRequestException } from '@nestjs/common';
import { QuestionKind } from '@prisma/client';
import { getAdapter } from './registry';

describe('ESSAY adapter', () => {
  const a = () => getAdapter(QuestionKind.ESSAY);
  it('accepts empty content and { minChars, maxChars }', () => {
    expect(() => a().validateContent({})).not.toThrow();
    expect(() => a().validateContent({ minChars: 10, maxChars: 500 })).not.toThrow();
  });
  it('rejects minChars > maxChars', () => {
    expect(() => a().validateContent({ minChars: 10, maxChars: 5 })).toThrow(BadRequestException);
  });
  it('accepts { text: string } and rejects missing text', () => {
    expect(() => a().validateResponse({ text: 'hola' })).not.toThrow();
    expect(() => a().validateResponse({})).toThrow(BadRequestException);
  });
  it('has no grade function', () => {
    expect(a().grade).toBeUndefined();
  });
});

describe('FILE_UPLOAD adapter', () => {
  const a = () => getAdapter(QuestionKind.FILE_UPLOAD);
  it('requires maxFiles ≥ 1', () => {
    expect(() => a().validateContent({ maxFiles: 3 })).not.toThrow();
    expect(() => a().validateContent({})).toThrow(BadRequestException);
    expect(() => a().validateContent({ maxFiles: 0 })).toThrow(BadRequestException);
  });
  it('rejects fileIds longer than maxFiles', () => {
    a().validateContent({ maxFiles: 1 });
    expect(() => a().validateResponse({ fileIds: ['a', 'b'] })).toThrow(BadRequestException);
  });
  it('accepts one fileId', () => {
    expect(() => a().validateResponse({ fileIds: ['file-1'] })).not.toThrow();
  });
});
```

Note: `validateResponse` for FILE_UPLOAD needs `maxFiles` from content. Change the adapter so `validateResponse(response, content?)` **or** validate maxFiles in the service using content. Spec adapter is `(response: unknown)`. Implement FILE_UPLOAD `validateResponse` as: `fileIds` is a nonempty string array (length checked in AttemptsService against content.maxFiles). Adjust the second FILE_UPLOAD test to:

```ts
  it('rejects non-array fileIds', () => {
    expect(() => a().validateResponse({ fileIds: 'x' })).toThrow(BadRequestException);
  });
```

Length vs `maxFiles` is asserted in AttemptsService tests (Task 4).

- [ ] **Step 2: Run** `pnpm --filter backend test -- src/activities/blocks/registry.spec.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement adapters + registry.** For the six existing kinds, wrap current `validateQuestionContent` switch into adapters (or have registry call the existing function for those kinds and only add ESSAY/FILE). Prefer: move the switch into per-kind files incrementally — **minimum:** ESSAY/FILE adapters + registry that falls back to `ActivitiesService.validateQuestionContent` for the old six **or** duplicate the switch into `legacy.ts`. Cleanest: `getAdapter` returns ESSAY/FILE or `legacyAdapter(kind)` that calls extracted `validateLegacyContent`. Do not break `graders.spec.ts`.

- [ ] **Step 4: Re-run tests.** Expected: PASS. `graders.spec.ts` still PASS (`isAutoGradable(ESSAY)` is false because no GRADERS entry).

Add to `graders.spec.ts`:

```ts
it('ESSAY and FILE_UPLOAD are not auto-gradable', () => {
  expect(isAutoGradable(QuestionKind.ESSAY, {})).toBe(false);
  expect(isAutoGradable(QuestionKind.FILE_UPLOAD, { maxFiles: 1 })).toBe(false);
});
```

---

### Task 3: Activity authoring — flag, derived maxScore, lock, archive

**Files:**
- Modify: `apps/backend/src/activities/dto/create-activity.dto.ts` — add optional `countsTowardFinal?: boolean`, `templateId?: string`, `sourceActivityId?: string`, `fileIds?: string[]`. Keep `maxScore` optional but document ignored.
- Modify: `apps/backend/src/activities/dto/update-activity.dto.ts` — `countsTowardFinal`, `fileIds`.
- Modify: `apps/backend/src/activities/activities.service.ts`
- Create or extend: `apps/backend/src/activities/activities.service.spec.ts`

**Interfaces:**
- Consumes: `getAdapter` from Task 2
- Produces:

```ts
// ActivitiesService
create(courseId, actingUserId, dto): Promise<Activity & { questions: Question[] }>
update(id, actingUserId, dto): Promise<Activity>
addQuestion(...): Promise<Question>        // 409 if any Attempt exists
updateQuestion(...): Promise<Question>     // 409
removeQuestion(...): Promise<void>         // 409
reorderQuestions(...): Promise<void>       // 409
remove(id, actingUserId): Promise<void>    // 409 if attempts exist
recomputeMaxScore(activityId): Promise<number>  // sum(points), writes Activity.maxScore
```

`create`/`update` **ignore** client `maxScore`. After any question mutation, `recomputeMaxScore`. Publishing (`status=PUBLISHED`) with zero questions or maxScore 0 → `BadRequestException` `'no se puede publicar vacía'`.

- [ ] **Step 1: Failing tests** in `activities.service.spec.ts` (follow `attempts.service.spec.ts` in-memory Prisma fake). Minimum cases:

```ts
it('ignores client maxScore and sets 0 when there are no questions', async () => { /* create with maxScore: 99 → stored 0 */ });
it('recomputes maxScore as sum of question points after addQuestion', async () => { /* add ESSAY points 7 + MCQ points 3 → maxScore 10 */ });
it('stores countsTowardFinal default true and can patch false', async () => {});
it('addQuestion throws ConflictException when an attempt exists', async () => {});
it('remove throws ConflictException when attempts exist', async () => {});
it('publishing with no questions throws BadRequestException', async () => {});
```

Use `@nestjs/common` `ConflictException` for 409.

- [ ] **Step 2: Run** `pnpm --filter backend test -- src/activities/activities.service.spec.ts` — FAIL.

- [ ] **Step 3: Implement.** Helper `assertNoAttempts(activityId)`: `prisma.attempt.count` > 0 → `ConflictException('la estructura está bloqueada')`. `remove`: if count > 0 → `ConflictException('archivar en su lugar')`. `update` with `status: PUBLISHED` checks question count.

- [ ] **Step 4: Tests PASS.** Existing activity/attempt tests still PASS.

---

### Task 4: Manual grade DTO + Attempt.feedback

**Files:**
- Modify: `apps/backend/src/activities/attempts/dto/grade-attempt.dto.ts`
- Modify: `apps/backend/src/activities/attempts/attempts.service.ts` `grade`
- Modify: `apps/backend/src/activities/attempts/attempts.service.spec.ts`

**Interfaces:**
- Consumes: `isAutoGradable` / adapters
- Produces:

```ts
class GradeAnswerDto {
  @IsString() questionId: string;
  @IsNumber() @Min(0) awarded: number;
}
class GradeAttemptDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => GradeAnswerDto)
  answers: GradeAnswerDto[];
  @IsOptional() @IsString() feedback?: string;
}

grade(attemptId, actingUserId, dto): Promise<Attempt>
// writes Answer.awarded for listed questions (must be non-auto or still null)
// Attempt.score = round2(sum of all Answer.awarded where not null)
// if every question has awarded != null → GRADED + GRADE_PUBLISHED
// else SUBMITTED
// awarded must be ≤ question.points else 400
```

- [ ] **Step 1: Replace the existing `grade` tests** that send `{ score: 8 }`. New cases:

```ts
it('grades subjective answers, sums awarded, emits GRADE_PUBLISHED when complete', async () => {
  // activity: MCQ auto already awarded 4 on submit + ESSAY points 6
  // dto: { answers: [{ questionId: essayId, awarded: 5 }], feedback: 'bien' }
  // expect attempt.status GRADED, score 9, feedback 'bien'
});
it('rejects awarded greater than question.points', async () => { /* 400 */ });
it('stays SUBMITTED if a subjective answer is omitted', async () => { /* two ESSAY, grade one */ });
```

Keep submit auto-grade tests green. Submit of mixed MCQ+ESSAY → SUBMITTED, MCQ answer.awarded set, ESSAY awarded null, no GRADE_PUBLISHED yet.

- [ ] **Step 2: Run** `pnpm --filter backend test -- src/activities/attempts/attempts.service.spec.ts` — FAIL on grade.

- [ ] **Step 3: Implement `grade` per spec §6.4.** Delete the `dto.score` path.

- [ ] **Step 4: PASS.**

---

### Task 5: Pure final-grade + gradebook on attempts

**Files:**
- Create: `apps/backend/src/assignments/grading/final-grade.ts`
- Create: `apps/backend/src/assignments/grading/final-grade.spec.ts`
- Modify: `apps/backend/src/assignments/grading/grading.service.ts`
- Modify: `apps/backend/src/assignments/grading/grading.controller.ts` only if response shape changes (same routes)
- Modify: `apps/backend/src/assignments/grading/grading.service.spec.ts`

**Interfaces:**
- Produces:

```ts
export type FinalItem = {
  id: string;
  maxScore: number;
  countsTowardFinal: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  closeAt: Date | null;
  dueAt: Date | null;
};
export type FinalAttempt = {
  activityId: string;
  userId: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
  score: number | null;
};
export function isClosed(item: FinalItem, now: Date): boolean {
  if (item.closeAt) return now > item.closeAt;
  if (item.dueAt) return now > item.dueAt;
  return false;
}
export function computeFinalGrade(
  items: FinalItem[],
  attempts: FinalAttempt[],
  userId: string,
  now: Date,
): number | null;
```

Formula (spec §6.5): skip `DRAFT` and `!countsTowardFinal`. Per remaining item, best `GRADED.score` for that user; else if `isClosed` → 0; else omit. `ratio = best/maxScore` (skip item if maxScore ≤ 0). `final = average(ratios)` or `null` if none.

`getGradebook` / `getMyGrades` / CSV / `getTeachingSummary` switch to activities+attempts. DTO fields from spec §7.4 (`items`, `final`, `attemptId`, `countsTowardFinal`). `getMyGrades` never 404 for empty: return `{ course, items: [], final: null }` when member with no published items.

`getTeachingSummary` pending count = attempts with `status === SUBMITTED` in courses the actor staffs.

- [ ] **Step 1: `final-grade.spec.ts`**

```ts
import { computeFinalGrade, isClosed, FinalItem, FinalAttempt } from './final-grade';

const pub = (over: Partial<FinalItem>): FinalItem => ({
  id: 'a', maxScore: 10, countsTowardFinal: true, status: 'PUBLISHED',
  closeAt: null, dueAt: null, ...over,
});

describe('computeFinalGrade', () => {
  const now = new Date('2026-09-19T12:00:00Z');
  it('returns null when no countable items', () => {
    expect(computeFinalGrade([pub({ countsTowardFinal: false })], [], 'u', now)).toBeNull();
  });
  it('averages ratios of graded countable items', () => {
    const items = [pub({ id: 'x', maxScore: 10 }), pub({ id: 'y', maxScore: 10 })];
    const attempts: FinalAttempt[] = [
      { activityId: 'x', userId: 'u', status: 'GRADED', score: 10 },
      { activityId: 'y', userId: 'u', status: 'GRADED', score: 5 },
    ];
    expect(computeFinalGrade(items, attempts, 'u', now)).toBe(0.75);
  });
  it('uses the best GRADED attempt', () => {
    const items = [pub({ id: 'x' })];
    const attempts: FinalAttempt[] = [
      { activityId: 'x', userId: 'u', status: 'GRADED', score: 4 },
      { activityId: 'x', userId: 'u', status: 'GRADED', score: 9 },
    ];
    expect(computeFinalGrade(items, attempts, 'u', now)).toBe(0.9);
  });
  it('counts missing as 0 after closeAt', () => {
    const items = [pub({ id: 'x', closeAt: new Date('2026-09-01T00:00:00Z') })];
    expect(computeFinalGrade(items, [], 'u', now)).toBe(0);
  });
  it('omits missing before close', () => {
    const items = [pub({ id: 'x', closeAt: new Date('2026-12-01T00:00:00Z') })];
    expect(computeFinalGrade(items, [], 'u', now)).toBeNull();
  });
  it('ignores DRAFT and practice even if graded', () => {
    const items = [
      pub({ id: 'd', status: 'DRAFT' }),
      pub({ id: 'p', countsTowardFinal: false }),
    ];
    const attempts: FinalAttempt[] = [
      { activityId: 'd', userId: 'u', status: 'GRADED', score: 10 },
      { activityId: 'p', userId: 'u', status: 'GRADED', score: 10 },
    ];
    expect(computeFinalGrade(items, attempts, 'u', now)).toBeNull();
  });
});
```

- [ ] **Step 2: Run** — FAIL (module missing).

- [ ] **Step 3: Implement `final-grade.ts` and rewrite `getGradebook`/`getMyGrades`/`getGradebookCsv`/`getTeachingSummary`.** Include ARCHIVED items in the book. Exclude DRAFT. Student `getMyGrades`: require membership; 200 empty.

- [ ] **Step 4: Update `grading.service.spec.ts` fake to `activity`/`attempt` instead of `assignment`/`submission`.** Old grade-submission tests remain until Task 9; they can stay if `gradeSubmission` still exists. Gradebook tests must expect `items` + `final`.

---

### Task 6: TaskTemplate CRUD + save-as + instantiate

**Files:**
- Create: DTOs listed in File Structure
- Create: `task-templates.service.ts`, `.controller.ts`, `.service.spec.ts`
- Modify: `activities.module.ts` — register controller/service
- Modify: `activities.service.ts` `create` — honor `templateId` / `sourceActivityId`
- Modify: `activities.controller.ts` — `POST /activities/:id/save-as-template`
- Modify: `grading.controller.ts` or new methods on activities — `GET /me/teaching/activities`

**Interfaces:**
- Produces:

```ts
type TemplateBlock = { kind: QuestionKind; prompt: string; points: number; order: number; content: Record<string, unknown> };

class TaskTemplatesService {
  create(actingUserId: string, dto: { title: string; description?: string; blocks: TemplateBlock[] }): Promise<TaskTemplate>;
  findAll(actingUserId: string): Promise<TaskTemplate[]>; // org of user; 404 if no org
  findOne(id: string, actingUserId: string): Promise<TaskTemplate>;
  update(id, actingUserId, dto): Promise<TaskTemplate>; // author or org ADMIN
  remove(id, actingUserId): Promise<void>;
  saveFromActivity(activityId, actingUserId, dto?: { title?: string; description?: string }): Promise<TaskTemplate>;
}

// ActivitiesService.create extra:
// if dto.templateId && dto.sourceActivityId → BadRequestException
// copy blocks into Question rows; set activity.templateId when from template
// source/template must share organizationId with dest course → NotFoundException
```

`GET /me/teaching/activities` (ActivitiesService or GradingService): activities of courses where actor is STAFF, order `createdAt desc`, shape spec `TeachingActivityDTO`.

RBAC list: user must be TEACHER/ADMIN global **or** have a STAFF enrollment in some course of `user.organizationId`. Else 404 on list (do not leak org templates to students).

- [ ] **Step 1: Failing tests** `task-templates.service.spec.ts`:

```ts
it('saveFromActivity snapshots questions and does not copy attempts', async () => {});
it('create from templateId hydrates questions with same kind/prompt/points/content', async () => {});
it('create from templateId leaves attempts empty', async () => {});
it('rejects templateId from another organization with NotFoundException', async () => {});
it('rejects templateId and sourceActivityId together with BadRequestException', async () => {});
it('student cannot findAll (NotFoundException)', async () => {});
it('assistant of a course in the org can findAll but cannot delete another teacher template (ForbiddenException)', async () => {});
```

- [ ] **Step 2: FAIL then implement then PASS.**

Validate each block via `getAdapter(kind).validateContent` before save.

---

### Task 7: Assignment → Activity migration mapper (parity)

**Files:**
- Create: `apps/backend/src/activities/migration/assignment-mapper.ts`
- Create: `apps/backend/src/activities/migration/assignment-mapper.spec.ts`
- Create: `apps/backend/prisma/migrate-assignments-to-activities.ts` (CLI that uses PrismaService / PrismaClient)

**Interfaces:**
- Produces:

```ts
export type MappedActivity = {
  courseId: string;
  title: string;
  description: string | null;
  openAt: Date | null;
  dueAt: Date | null;
  closeAt: Date | null;
  attemptsAllowed: 1;
  status: 'PUBLISHED';
  countsTowardFinal: true;
  config: { migratedFromAssignmentId: string };
  questions: Array<{ kind: 'ESSAY' | 'FILE_UPLOAD'; prompt: string; points: number; order: number; content: Record<string, unknown> }>;
};
export function mapAssignment(input: {
  assignment: { id: string; courseId: string; title: string; description: string | null; openAt: Date | null; dueAt: Date | null; closeAt: Date | null; maxScore: number };
  hasStudentFiles: boolean;
}): MappedActivity;

export function mapSubmission(input: {
  submission: { text: string | null; score: number | null; feedback: string | null; status: string; gradedById: string | null; gradedAt: Date | null; updatedAt: Date };
  essayQuestionId: string;
  fileQuestionId: string | null;
  fileIds: string[];
}): { attempt: { attemptNo: 1; status: 'GRADED' | 'SUBMITTED' | 'IN_PROGRESS'; score: number | null; feedback: string | null; gradedById: string | null; gradedAt: Date | null }; answers: Array<{ questionId: string; response: unknown; awarded: number | null }> };
```

Status map: `GRADED` if `score != null`; `DRAFT` → `IN_PROGRESS`; else `SUBMITTED`. ESSAY `points = maxScore`. FILE_UPLOAD only if `hasStudentFiles`, `points = 0`, `content = { maxFiles: 10 }`.

- [ ] **Step 1: Tests** — one assignment with files, one without; graded vs submitted vs draft; config.migratedFromAssignmentId set; FILE_UPLOAD absent when no student files.

- [ ] **Step 2: FAIL / implement mapper / PASS.**

- [ ] **Step 3: CLI script** idempotent: skip if an Activity with `config.migratedFromAssignmentId === assignment.id` exists. Uses mapper then Prisma writes. Document: `pnpm --filter backend exec tsx prisma/migrate-assignments-to-activities.ts`.

---

### Task 8: Seed + freeze Assignment writes

**Files:**
- Modify: `apps/backend/prisma/seed.ts` — stop creating new `Assignment` in standard/e2e seeds; create one ESSAY+FILE activity and one org `TaskTemplate` «Examen mixto» (2× MCQ + 1 MATCHING + 1 ESSAY). Keep existing quiz activity.
- Modify: `apps/backend/src/assignments/assignments.controller.ts` — `POST/PATCH/DELETE` throw `GoneException` (410) **after** mapper tests pass. Keep GET for one release.
- Modify: `apps/backend/src/assignments/submissions/submissions.controller.ts` — `POST` submit → 410.
- Modify: `apps/backend/src/assignments/grading/grading.controller.ts` — `PATCH submissions/:id/grade` → 410.

Do **not** 410 until Task 7 mapper is green and frontend Task 10 is in the same staging train (spec §13). If implementing backend-first, **gate 410 behind** completing Task 10 in the same branch, not an earlier merge to staging.

- [ ] **Step 1:** Seed builds without `prisma.assignment.create`.
- [ ] **Step 2:** Manual inspect of seed functions; run seed in a throwaway compose only if the environment is already up.

---

### Task 9: Frontend API types and hooks

**Files:**
- Modify: `apps/frontend/src/lib/api/types/activity.ts` — `QuestionKind` includes `ESSAY` | `FILE_UPLOAD`; `countsTowardFinal`; `templateId`; `files`; `CreateActivityInput` gains `templateId?`, `sourceActivityId?`, `countsTowardFinal?`, `fileIds?`
- Modify: `apps/frontend/src/lib/api/types/gradebook.ts` — spec §7.4
- Create: `apps/frontend/src/lib/api/types/task-template.ts`
- Create: hooks `useTaskTemplates.ts`, `useSaveAsTemplate.ts`, `useTeachingActivities.ts`; extend `useActivityMutations.ts` / `useCreateActivity`
- Modify: `useGradeSubmission.ts` → grade attempts (`PATCH /attempts/:id/grade` with `{ answers, feedback }`). Keep old export name as deprecated wrapper only if needed; prefer `useGradeAttempt`.
- Barrel `lib/api/hooks/index.ts` + `lib/api/index.ts`

No new UI yet; TypeScript must compile.

---

### Task 10: Frontend unified Tareas + library + player blocks

**Files:**
- Modify: `apps/frontend/src/features/activities/ActivityForm.tsx` — switch «Cuenta para la nota final»; remove maxScore input; optional template/source.
- Modify: `QuestionContentEditor.tsx` — ESSAY (`Textarea` min/max), FILE_UPLOAD (`maxFiles`, accept + hint).
- Modify: `ActivityPlayer.tsx` — ESSAY textarea; FILE_UPLOAD `FileUpload` then send `fileIds`.
- Modify: `ActivitiesPage.tsx` — copy «Tareas»; staff: create from blank / template / previous; student player already routed here.
- Create: `apps/frontend/src/features/activities/TaskLibrary.tsx` — Tabs Plantillas | Anteriores (`Table`, `EmptyState`, `Modal`).
- Modify: `apps/frontend/src/app/routes.tsx` — `/assignments` → `<Navigate to="/activities" replace />`. Nav label «Tareas» only (find the sidebar/nav item for assignments and merge).
- Modify: `GradebookPage.tsx`, `GradePanel.tsx`, `GradesPage.tsx` — `items`, práctica badge, `final`, grade via answers DTO.
- Modify: `TeacherDashboard` pending-count still uses teaching summary.

Compose `@/components/ui` only. Empty/loading/error on every view.

---

### Task 11: Cutover wiring

On the **same branch** after Tasks 1–10:

- Enable 410 on assignment mutations (Task 8).
- Run mapper CLI against the demo DB if compose is up.
- Delete or skip Playwright `assignments-authoring.spec.ts` calls to `POST /courses/:id/assignments`; replace with activity ESSAY+FILE.

---

### Task 12: E2E `tasks.spec.ts`

**Files:**
- Create: `apps/frontend/e2e/tasks.spec.ts` (Playwright, reuse `dev-user.ts` / compose helpers from `activity-player.spec.ts` and `assignments-authoring.spec.ts`)

Cases from spec §11:

1. Mixed exam MCQ+MATCHING+ESSAY → auto + pending + teacher grade → student sees score → gradebook `final`.
2. Save as template → instantiate other course same org → copy has 0 attempts; original keeps grades.
3. `countsTowardFinal=false` does not change course `final`.
4. Outside window 400; student does not see `correct` before submit.
5. Org-b teacher 404 on org-a template/activity.

Run: `pnpm --filter frontend test:e2e` (or compose config used in `activity-player.spec.ts`). This is `finaltests` territory; implementers still add the spec file.

---

## Spec coverage

| Spec section | Task |
|---|---|
| §4 schema, kinds, ActivityFile, feedback | 1 |
| §5 registry | 2 |
| §4.3 maxScore, §6.1 publish, §6.4 lock/delete | 3 |
| §6.3–6.4 submit/grade | 4 |
| §6.5 §7.4 gradebook/final | 5 |
| §6.2 §7.1 templates, teaching list | 6 |
| §9 migration | 7 |
| seed + 410 | 8, 11 |
| §8 frontend | 9–10 |
| §11 E2E | 12 |
| §10 errors | 3, 4, 6 (HTTP mapping via Nest exceptions) |

## Type consistency

- `GradeAttemptDto.answers[]` not `score`
- Gradebook `items` not `assignments`
- `ConflictException` → 409, `GoneException` → 410, `NotFoundException` → 404, `BadRequestException` → 400
- `computeFinalGrade` returns `number | null` (ratio 0..1). Display as percent in UI (`Math.round(final * 1000) / 10` + '%' or points — **UI shows percentage 0–100 with one decimal**, e.g. 75.0). CSV column `Nota final` is that percentage.

---

## Execution notes for agents

Work Task 1 → 12 in order. Tasks 9–10 may start after 6’s API exists. Task 12 after 10. Do not merge 410 (Task 8/11) to `staging` without Task 10. Skip git commits unless Jorge asks.
