import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttemptStatus,
  PublicationStatus,
  NotificationType,
  SubmissionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AssignmentsService } from '../assignments.service';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { csvField } from '@/common/csv';
import {
  computeFinalGrade,
  type FinalAttempt,
  type FinalItem,
} from './final-grade';
import {
  GRADABLE_ACTIVITY_STATUSES,
  gradableActivitiesWhere,
  pickCell,
  subjectStudentsWhere,
  type GradebookCell,
} from '../../activities/gradable-activities';

export type { GradebookCell };

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
      true,
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
   * gradable (non-draft) activity, plus a `final` average of countable items.
   * "Gradable" and "student" are defined once in `gradable-activities.ts`.
   */
  async getGradebook(subjectId: string, actingUserId: string) {
    const { subject } = await this.assignments.requireCourseMembership(
      subjectId,
      actingUserId,
      true,
    );

    const activities = await this.prisma.activity.findMany({
      where: gradableActivitiesWhere(subjectId, subject.organizationId),
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

    const enrollments = await this.prisma.courseMembership.findMany({
      where: subjectStudentsWhere(subject),
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
      course: { id: subject.id, title: subject.title },
      items: activities,
      students,
    };
  }

  /**
   * A single student's grades for a course (any member). Never 404 for an
   * empty book: members get `{ items: [], final: null }`.
   */
  async getMyGrades(subjectId: string, actingUserId: string) {
    const { subject } = await this.assignments.requireCourseMembership(
      subjectId,
      actingUserId,
    );

    const activities = await this.prisma.activity.findMany({
      where: gradableActivitiesWhere(subjectId, subject.organizationId),
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
      course: { id: subject.id, title: subject.title },
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

    const actor = await this.prisma.user.findUnique({
      where: { id: actingUserId },
      select: { organizationId: true, role: true },
    });
    const organizationId = actor?.organizationId;
    const staffSubjects = organizationId
      ? await this.prisma.subject.findMany({
          where: actor.role === 'ADMIN'
            ? { organizationId }
            : {
                organizationId,
                staff: { some: { userId: actingUserId } },
              },
          select: { id: true, status: true, courseId: true },
        })
      : [];
    const subjectIds = staffSubjects.map((subject) => subject.id);

    if (!organizationId || subjectIds.length === 0) {
      return {
        activeCourses: 0,
        totalStudents: 0,
        pendingCount: 0,
        pending: [],
      };
    }

    const activeCourses = staffSubjects.filter(
      (subject) => subject.status === 'PUBLISHED',
    ).length;

    // Same notion of "student" as the gradebook and analytics: a STUDENT cohort
    // member who is not staff of the subject being counted.
    const studentEnrollments = await this.prisma.courseMembership.findMany({
      where: {
        courseId: { in: staffSubjects.map((subject) => subject.courseId) },
        course: { organizationId },
        user: { role: 'STUDENT' },
      },
      select: {
        userId: true,
        courseId: true,
        user: {
          select: {
            subjectStaff: {
              where: { subjectId: { in: subjectIds } },
              select: { subjectId: true },
            },
          },
        },
      },
    });
    const totalStudents = new Set(
      studentEnrollments
        .filter((e) =>
          staffSubjects.some(
            (subject) =>
              subject.courseId === e.courseId &&
              !e.user.subjectStaff.some((s) => s.subjectId === subject.id),
          ),
        )
        .map((e) => e.userId),
    ).size;

    // Attempts awaiting manual grading (subjective blocks still pending).
    const pendingWhere = {
      status: AttemptStatus.SUBMITTED,
      activity: {
        subjectId: { in: subjectIds },
        status: { in: GRADABLE_ACTIVITY_STATUSES },
        subject: { organizationId },
      },
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
              subject: { select: { id: true, title: true } },
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
      courseId: a.activity.subject.id,
      courseTitle: a.activity.subject.title,
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

function toFinalItem(a: {
  id: string;
  maxScore: number;
  countsTowardFinal: boolean;
  status: PublicationStatus;
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
