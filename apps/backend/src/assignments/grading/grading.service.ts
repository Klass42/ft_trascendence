import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CourseRole,
  NotificationType,
  SubmissionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AssignmentsService, STAFF_ROLES } from '../assignments.service';
import { GradeSubmissionDto } from './dto/grade-submission.dto';

/** One student's score for one assignment inside the gradebook matrix. */
export interface GradebookCell {
  assignmentId: string;
  /** The submission row, if the student has one (needed to grade it). */
  submissionId: string | null;
  score: number | null;
  status: SubmissionStatus | null;
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
   * assignment, with the score/status of the matching submission (or nulls).
   */
  async getGradebook(courseId: string, actingUserId: string) {
    const { course } = await this.assignments.requireCourseMembership(
      courseId,
      actingUserId,
      STAFF_ROLES,
    );

    const assignments = await this.prisma.assignment.findMany({
      where: { courseId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, maxScore: true, dueAt: true },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId, role: CourseRole.STUDENT },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });

    const assignmentIds = assignments.map((a) => a.id);
    const submissions = assignmentIds.length
      ? await this.prisma.submission.findMany({
          where: { assignmentId: { in: assignmentIds } },
          select: {
            id: true,
            assignmentId: true,
            userId: true,
            score: true,
            status: true,
          },
        })
      : [];

    // Index submissions by "assignmentId::userId" for O(1) cell lookup.
    const byKey = new Map(
      submissions.map((s) => [`${s.assignmentId}::${s.userId}`, s]),
    );

    const students = enrollments.map((e) => ({
      user: e.user,
      cells: assignments.map<GradebookCell>((a) => {
        const s = byKey.get(`${a.id}::${e.userId}`);
        return {
          assignmentId: a.id,
          submissionId: s?.id ?? null,
          score: s?.score ?? null,
          status: s?.status ?? null,
        };
      }),
    }));

    return {
      course: { id: course.id, title: course.title },
      assignments,
      students,
    };
  }

  /**
   * A single student's grades for a course (any member — used by the student's
   * "my grades" view). One row per assignment, with their submission's
   * score/status/feedback when present.
   */
  async getMyGrades(courseId: string, actingUserId: string) {
    await this.assignments.requireCourseMembership(courseId, actingUserId);

    const assignments = await this.prisma.assignment.findMany({
      where: { courseId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, maxScore: true, dueAt: true },
    });

    const mine = await this.prisma.submission.findMany({
      where: {
        assignmentId: { in: assignments.map((a) => a.id) },
        userId: actingUserId,
      },
      select: {
        assignmentId: true,
        score: true,
        status: true,
        feedback: true,
        gradedAt: true,
      },
    });
    const byAssignment = new Map(mine.map((s) => [s.assignmentId, s]));

    return assignments.map((a) => {
      const s = byAssignment.get(a.id);
      return {
        assignmentId: a.id,
        title: a.title,
        maxScore: a.maxScore,
        dueAt: a.dueAt,
        score: s?.score ?? null,
        status: s?.status ?? null,
        feedback: s?.feedback ?? null,
        gradedAt: s?.gradedAt ?? null,
      };
    });
  }

  /**
   * The gradebook rendered as CSV: a header row of assignment titles, then one
   * row per student with their score per assignment. Fields are RFC-4180
   * escaped (see {@link csvField}).
   */
  async getGradebookCsv(courseId: string, actingUserId: string) {
    const gradebook = await this.getGradebook(courseId, actingUserId);

    const header = [
      'Alumno',
      'Email',
      ...gradebook.assignments.map(
        (a) => `${a.title} (/${a.maxScore})`,
      ),
    ];

    const rows = gradebook.students.map((student) => [
      student.user.name ?? '',
      student.user.email ?? '',
      ...student.cells.map((c) => (c.score != null ? String(c.score) : '')),
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
