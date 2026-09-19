import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttemptStatus,
  CourseRole,
  CourseStatus,
  NotificationType,
  SubmissionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AssignmentsService, STAFF_ROLES } from '../assignments.service';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import {
  computeFinalGrade,
  type FinalAttempt,
  type FinalItem,
} from './final-grade';

/** One student's score for one activity inside the gradebook matrix. */
export interface GradebookCell {
  activityId: string;
  /** Best GRADED attempt, or a SUBMITTED one if none is graded yet. */
  attemptId: string | null;
  score: number | null;
  status: AttemptStatus | null;
}

/**
 * Grading + gradebook. Sits inside the assignments module so `app.module.ts`
 * stays untouched; it reuses {@link AssignmentsService} for the tenant/role
 * gate and {@link NotificationsService} to tell students their grade is out.
 */
@Injectable()
export class GradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: AssignmentsService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Grade one submission. Only course staff may grade, and the score must sit
   * within `[0, assignment.maxScore]` (the upper bound is per-assignment, hence
   * validated here rather than in the DTO). On success we mark it GRADED,
   * stamp the grader/time, and notify the submission's author.
   */
  async gradeSubmission(
    submissionId: string,
    actingUserId: string,
    dto: GradeSubmissionDto,
  ) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, userId: true, assignmentId: true },
    });
    if (!submission) {
      throw new NotFoundException(`Submission ${submissionId} not found`);
    }

    // Staff-only gate; also derives the tenant org from the parent course.
    const { assignment } = await this.assignments.requireAssignmentMembership(
      submission.assignmentId,
      actingUserId,
      STAFF_ROLES,
    );

    if (dto.score > assignment.maxScore) {
      throw new BadRequestException(
        `Score must be between 0 and ${assignment.maxScore}`,
      );
    }

    const graded = await this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        score: dto.score,
        feedback: dto.feedback ?? null,
        status: SubmissionStatus.GRADED,
        gradedById: actingUserId,
        gradedAt: new Date(),
      },
      include: {
        files: { include: { file: true } },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    await this.notifications.emit(
      submission.userId,
      NotificationType.GRADE_PUBLISHED,
      {
        title: 'Nota publicada',
        body: `Tu entrega de «${assignment.title}» ha sido calificada: ${dto.score}/${assignment.maxScore}`,
        link: `/assignments?assignmentId=${assignment.id}`,
      },
    );

    return graded;
  }

  /**
   * The full gradebook for a course (staff only): every enrolled student × every
   * published/archived activity, plus a `final` average of countable items.
   */
  async getGradebook(courseId: string, actingUserId: string) {
    const { course } = await this.assignments.requireCourseMembership(
      courseId,
      actingUserId,
      STAFF_ROLES,
    );

    const activities = await this.prisma.activity.findMany({
      where: {
        courseId,
        status: { in: [CourseStatus.PUBLISHED, CourseStatus.ARCHIVED] },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        maxScore: true,
        dueAt: true,
        closeAt: true,
        countsTowardFinal: true,
        status: true,
      },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId, role: CourseRole.STUDENT },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });

    const activityIds = activities.map((a) => a.id);
    const attempts = activityIds.length
      ? await this.prisma.attempt.findMany({
          where: { activityId: { in: activityIds } },
          select: {
            id: true,
            activityId: true,
            userId: true,
            score: true,
            status: true,
            attemptNo: true,
          },
        })
      : [];

    const now = new Date();
    const finalItems: FinalItem[] = activities.map(toFinalItem);
    const finalAttempts: FinalAttempt[] = attempts.map(toFinalAttempt);

    const students = enrollments.map((e) => ({
      user: e.user,
      cells: activities.map<GradebookCell>((a) =>
        pickCell(
          a.id,
          attempts.filter(
            (att) => att.activityId === a.id && att.userId === e.userId,
          ),
        ),
      ),
      final: computeFinalGrade(finalItems, finalAttempts, e.userId, now),
    }));

    return {
      course: { id: course.id, title: course.title },
      items: activities,
      students,
    };
  }

  /**
   * A single student's grades for a course (any member). Never 404 for an
   * empty book: members get `{ items: [], final: null }`.
   */
  async getMyGrades(courseId: string, actingUserId: string) {
    const { course } = await this.assignments.requireCourseMembership(
      courseId,
      actingUserId,
    );

    const activities = await this.prisma.activity.findMany({
      where: {
        courseId,
        status: { in: [CourseStatus.PUBLISHED, CourseStatus.ARCHIVED] },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        maxScore: true,
        dueAt: true,
        closeAt: true,
        countsTowardFinal: true,
        status: true,
      },
    });

    const attempts = activities.length
      ? await this.prisma.attempt.findMany({
          where: {
            activityId: { in: activities.map((a) => a.id) },
            userId: actingUserId,
          },
          select: {
            id: true,
            activityId: true,
            userId: true,
            score: true,
            status: true,
            feedback: true,
            gradedAt: true,
            attemptNo: true,
          },
        })
      : [];

    const now = new Date();
    const items = activities.map((a) => {
      const mine = attempts.filter((att) => att.activityId === a.id);
      const cell = pickCell(a.id, mine);
      const chosen =
        mine.find((att) => att.id === cell.attemptId) ?? null;
      return {
        activityId: a.id,
        title: a.title,
        maxScore: a.maxScore,
        dueAt: a.dueAt,
        countsTowardFinal: a.countsTowardFinal,
        score: cell.score,
        status: cell.status,
        feedback: chosen?.feedback ?? null,
        gradedAt: chosen?.gradedAt ?? null,
      };
    });

    return {
      course: { id: course.id, title: course.title },
      items,
      final: computeFinalGrade(
        activities.map(toFinalItem),
        attempts.map(toFinalAttempt),
        actingUserId,
        now,
      ),
    };
  }

  /**
   * Teacher dashboard summary for the acting staff user, aggregated across every
   * course they teach (role TEACHER/ASSISTANT):
   *  - `activeCourses`  — published courses they teach.
   *  - `totalStudents`  — distinct students enrolled in those courses.
   *  - `pending`        — attempts SUBMITTED (awaiting manual grading), newest
   *                       first (capped), each with its student/activity/course.
   *
   * Tenancy is implicit: we only ever look at courses the user is enrolled in,
   * so no organizationId is trusted from the client. Returns zeros/empty when
   * the user teaches nothing.
   */
  async getTeachingSummary(actingUserId: string) {
    const PENDING_LIMIT = 50;

    const staffEnrollments = await this.prisma.enrollment.findMany({
      where: { userId: actingUserId, role: { in: STAFF_ROLES } },
      select: { course: { select: { id: true, status: true } } },
    });
    const courseIds = staffEnrollments.map((e) => e.course.id);

    if (courseIds.length === 0) {
      return {
        activeCourses: 0,
        totalStudents: 0,
        pendingCount: 0,
        pending: [],
      };
    }

    const activeCourses = staffEnrollments.filter(
      (e) => e.course.status === 'PUBLISHED',
    ).length;

    // Distinct students across the taught courses.
    const studentEnrollments = await this.prisma.enrollment.findMany({
      where: { courseId: { in: courseIds }, role: CourseRole.STUDENT },
      select: { userId: true },
    });
    const totalStudents = new Set(
      studentEnrollments.map((e) => e.userId),
    ).size;

    // Attempts awaiting manual grading (subjective blocks still pending).
    const pendingWhere = {
      status: AttemptStatus.SUBMITTED,
      activity: { courseId: { in: courseIds } },
    };
    const [pendingCount, pendingRows] = await Promise.all([
      this.prisma.attempt.count({ where: pendingWhere }),
      this.prisma.attempt.findMany({
        where: pendingWhere,
        orderBy: { submittedAt: 'desc' },
        take: PENDING_LIMIT,
        select: {
          id: true,
          status: true,
          submittedAt: true,
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          activity: {
            select: {
              id: true,
              title: true,
              course: { select: { id: true, title: true } },
            },
          },
        },
      }),
    ]);

    const pending = pendingRows.map((a) => ({
      attemptId: a.id,
      status: a.status,
      submittedAt: a.submittedAt,
      student: a.user,
      activityId: a.activity.id,
      activityTitle: a.activity.title,
      courseId: a.activity.course.id,
      courseTitle: a.activity.course.title,
    }));

    return { activeCourses, totalStudents, pendingCount, pending };
  }

  /**
   * The gradebook rendered as CSV: a header row of activity titles (practice
   * items get a suffix), then one row per student plus `Nota final`.
   */
  async getGradebookCsv(courseId: string, actingUserId: string) {
    const gradebook = await this.getGradebook(courseId, actingUserId);

    const header = [
      'Alumno',
      'Email',
      ...gradebook.items.map((a) =>
        a.countsTowardFinal
          ? `${a.title} (/${a.maxScore})`
          : `${a.title} (práctica)`,
      ),
      'Nota final',
    ];

    const rows = gradebook.students.map((student) => [
      student.user.name ?? '',
      student.user.email ?? '',
      ...student.cells.map((c) => (c.score != null ? String(c.score) : '')),
      student.final == null ? '' : (Math.round(student.final * 1000) / 10).toFixed(1),
    ]);

    const lines = [header, ...rows].map((row) =>
      row.map(csvField).join(','),
    );
    // Prepend a UTF-8 BOM so Excel opens accented names correctly.
    return { filename: `gradebook-${courseId}.csv`, csv: '﻿' + lines.join('\r\n') };
  }
}

/**
 * Escape a single CSV field: wrap in double quotes and double any embedded
 * quotes when it contains a comma, quote, or newline.
 */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toFinalItem(a: {
  id: string;
  maxScore: number;
  countsTowardFinal: boolean;
  status: CourseStatus;
  closeAt: Date | null;
  dueAt: Date | null;
}): FinalItem {
  return {
    id: a.id,
    maxScore: a.maxScore,
    countsTowardFinal: a.countsTowardFinal,
    status: a.status as FinalItem['status'],
    closeAt: a.closeAt,
    dueAt: a.dueAt,
  };
}

function toFinalAttempt(a: {
  activityId: string;
  userId: string;
  status: AttemptStatus;
  score: number | null;
}): FinalAttempt {
  return {
    activityId: a.activityId,
    userId: a.userId,
    status: a.status as FinalAttempt['status'],
    score: a.score,
  };
}

/** Best GRADED attempt wins; else a SUBMITTED one; else empty cell. */
function pickCell(
  activityId: string,
  attempts: Array<{
    id: string;
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
      attemptId: best.id,
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
      attemptId: submitted[0].id,
      score: submitted[0].score,
      status: submitted[0].status,
    };
  }
  return { activityId, attemptId: null, score: null, status: null };
}
