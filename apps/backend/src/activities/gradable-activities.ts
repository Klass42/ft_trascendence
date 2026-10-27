import { AttemptStatus, GlobalRole, Prisma, PublicationStatus } from '@prisma/client';

/**
 * Single definition of "what counts" in a subject's results, shared by the
 * gradebook, the analytics dashboard and the teacher summary so they can never
 * disagree.
 *
 * - Gradable activity: any activity of the subject that is not a DRAFT. An
 *   ARCHIVED activity stays in, because archiving an already-graded task must
 *   not erase its grades (the gradebook and final grade have always worked so).
 * - Student: a cohort member whose role is STUDENT and who is not SubjectStaff
 *   of that subject. Teachers or admins enrolled by mistake never count.
 * - Cell: per (student, activity), the best GRADED attempt, else the latest
 *   SUBMITTED one ({@link pickCell}); IN_PROGRESS attempts never show up.
 */
export const GRADABLE_ACTIVITY_STATUSES: PublicationStatus[] = [
  PublicationStatus.PUBLISHED,
  PublicationStatus.ARCHIVED,
];

/** Tenant-scoped filter for a subject's gradable activities. */
export function gradableActivitiesWhere(
  subjectId: string,
  organizationId: string,
): Prisma.ActivityWhereInput {
  return {
    subjectId,
    status: { in: GRADABLE_ACTIVITY_STATUSES },
    subject: { organizationId },
  };
}

/** Tenant-scoped filter for the students of a subject (STUDENT cohort members, never its staff). */
export function subjectStudentsWhere(subject: {
  id: string;
  courseId: string;
  organizationId: string;
}): Prisma.CourseMembershipWhereInput {
  return {
    courseId: subject.courseId,
    course: { organizationId: subject.organizationId },
    user: {
      role: GlobalRole.STUDENT,
      subjectStaff: { none: { subjectId: subject.id } },
    },
  };
}

/** One student's score for one activity inside the gradebook matrix. */
export interface GradebookCell {
  activityId: string;
  /** Best GRADED attempt, or a SUBMITTED one if none is graded yet. */
  attemptId: string | null;
  score: number | null;
  status: AttemptStatus | null;
}

/** Best GRADED attempt wins; else a SUBMITTED one; else empty cell. */
export function pickCell(
  activityId: string,
  attempts: Array<{
    id?: string;
    score: number | null;
    status: AttemptStatus;
    attemptNo?: number;
  }>,
): GradebookCell {
  const graded = attempts.filter((a) => a.status === AttemptStatus.GRADED);
  if (graded.length > 0) {
    const best = graded.reduce((acc, a) =>
      (a.score ?? -Infinity) > (acc.score ?? -Infinity) ? a : acc,
    );
    return {
      activityId,
      attemptId: best.id ?? null,
      score: best.score,
      status: best.status,
    };
  }
  const submitted = attempts
    .filter((a) => a.status === AttemptStatus.SUBMITTED)
    .sort((a, b) => (b.attemptNo ?? 0) - (a.attemptNo ?? 0));
  if (submitted[0]) {
    return {
      activityId,
      attemptId: submitted[0].id ?? null,
      score: submitted[0].score,
      status: submitted[0].status,
    };
  }
  return { activityId, attemptId: null, score: null, status: null };
}

export interface SubjectResultsSummary {
  /** students × gradable activities. */
  expected: number;
  /** (student, activity) pairs with at least one SUBMITTED/GRADED attempt. */
  delivered: number;
  /** Delivered pairs whose cell holds a usable grade. */
  graded: number;
  /** Delivered pairs still without a grade (awaiting manual correction). */
  pending: number;
  /** One percentage (0-100 of maxScore) per graded pair, as the gradebook shows it. */
  percents: number[];
}

/**
 * Delivery and grade figures over (student, activity) pairs. Attempts of users
 * outside `studentIds` are ignored, so each pair counts once however many
 * attempts it has and `delivered <= expected` always holds.
 */
export function summarizeSubjectResults(
  activities: Array<{ id: string; maxScore: number }>,
  studentIds: string[],
  attempts: Array<{
    activityId: string;
    userId: string;
    status: AttemptStatus;
    score: number | null;
    attemptNo?: number;
  }>,
): SubjectResultsSummary {
  const byPair = new Map<string, typeof attempts>();
  for (const attempt of attempts) {
    const key = `${attempt.activityId}:${attempt.userId}`;
    const group = byPair.get(key);
    if (group) group.push(attempt);
    else byPair.set(key, [attempt]);
  }

  const percents: number[] = [];
  let delivered = 0;
  for (const activity of activities) {
    for (const studentId of studentIds) {
      const cell = pickCell(activity.id, byPair.get(`${activity.id}:${studentId}`) ?? []);
      if (cell.status === null) continue;
      delivered += 1;
      if (cell.status === AttemptStatus.GRADED && cell.score != null && activity.maxScore > 0) {
        percents.push(Math.max(0, Math.min(100, (cell.score / activity.maxScore) * 100)));
      }
    }
  }

  return {
    expected: activities.length * studentIds.length,
    delivered,
    graded: percents.length,
    pending: delivered - percents.length,
    percents,
  };
}
