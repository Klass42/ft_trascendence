import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CourseAccessService } from '../courses/course-access.service';

/** Statuses that count as "the student has actually handed something in". */
const SUBMITTED_STATUSES: SubmissionStatus[] = [
  SubmissionStatus.SUBMITTED,
  SubmissionStatus.LATE,
  SubmissionStatus.GRADED,
];

/** Number of buckets in the grade histogram (0–10, 10–20, … 90–100). */
const GRADE_BUCKETS = 10;

/** How many days the submissions time-series covers when no range is given. */
const DEFAULT_RANGE_DAYS = 30;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
  ) {}

  // ---------------------------------------------------------------------------
  // Membership gate
  //
  // TODO: extraer helper de membership compartido (ya hay varias copias:
  // ForumsService.requireMembership, AssignmentsService.requireMembership). Se
  // duplica a propósito para no acoplar AnalyticsModule a los demás; consolidar
  // cuando aterrice el pase de auth.
  // ---------------------------------------------------------------------------

  private async requireStaff(subjectId: string, actingUserId: string) {
    const access = await this.access.assertSubjectStaffForUser(subjectId, actingUserId);
    return access.subject;
  }

  // ---------------------------------------------------------------------------
  // KPIs / overview
  // ---------------------------------------------------------------------------

  /**
   * Headline KPIs for a course, computed with aggregate/groupBy queries (no
   * per-row round-trips). Everything is scoped to the course — and therefore to
   * its organization — because every query filters by `subjectId` (directly or
   * through the assignment/section/thread that owns the row).
   */
  async getOverview(subjectId: string, actingUserId: string) {
    const subject = await this.requireStaff(
      subjectId,
      actingUserId,
    );

    // Assignments carry the per-assignment maxScore we need to normalise grades.
    const assignments = await this.prisma.assignment.findMany({
      where: { subjectId },
      select: { id: true, maxScore: true },
    });
    const assignmentIds = assignments.map((a) => a.id);

    const [studentCount, lessonCount, completionCount, threadCount, postCount] =
      await Promise.all([
        this.prisma.courseMembership.count({
          where: { courseId: subject.courseId, course: { organizationId: subject.organizationId } },
        }),
        this.prisma.lesson.count({ where: { section: { subjectId } } }),
        this.prisma.lessonCompletion.count({
          where: { lesson: { section: { subjectId } } },
        }),
        this.prisma.forumThread.count({ where: { subjectId } }),
        this.prisma.forumPost.count({ where: { thread: { subjectId } } }),
      ]);

    // Per-status submission counts in a single groupBy, then folded into a map.
    const statusGroups = assignmentIds.length
      ? await this.prisma.submission.groupBy({
          by: ['status'],
          where: { assignmentId: { in: assignmentIds } },
          _count: { _all: true },
        })
      : [];
    const countByStatus = new Map<SubmissionStatus, number>(
      statusGroups.map((g) => [g.status, g._count._all]),
    );
    const statusCount = (s: SubmissionStatus) => countByStatus.get(s) ?? 0;

    const submitted =
      statusCount(SubmissionStatus.SUBMITTED) +
      statusCount(SubmissionStatus.LATE) +
      statusCount(SubmissionStatus.GRADED);
    const expectedSubmissions = studentCount * assignments.length;

    const gradedPercents = await this.gradedPercents(assignments);
    const averageGrade = gradedPercents.length
      ? round(
          gradedPercents.reduce((sum, p) => sum + p, 0) / gradedPercents.length,
        )
      : null;

    const expectedCompletions = studentCount * lessonCount;

    return {
      course: { id: subject.id, title: subject.title },
      students: studentCount,
      assignments: assignments.length,
      lessons: lessonCount,
      submissions: {
        total: submitted,
        expected: expectedSubmissions,
        graded: statusCount(SubmissionStatus.GRADED),
        pending:
          statusCount(SubmissionStatus.SUBMITTED) +
          statusCount(SubmissionStatus.LATE),
        // Fraction of expected submissions actually handed in (0..1).
        rate: rate(submitted, expectedSubmissions),
      },
      // Mean grade of GRADED submissions, normalised to each assignment's
      // maxScore and expressed as a percentage (0..100). Null when nothing is
      // graded yet.
      averageGrade,
      lessonsCompletion: {
        completed: completionCount,
        expected: expectedCompletions,
        rate: rate(completionCount, expectedCompletions),
      },
      forum: { threads: threadCount, posts: postCount },
    };
  }

  // ---------------------------------------------------------------------------
  // Submissions over time
  // ---------------------------------------------------------------------------

  /**
   * Daily submission counts across `[from, to]`. Defaults to the last
   * {@link DEFAULT_RANGE_DAYS} days when a bound is missing, and swaps the
   * bounds if they arrive reversed. The range is materialised day-by-day so the
   * chart shows explicit zeros, not gaps.
   */
  async getSubmissionsOverTime(
    subjectId: string,
    actingUserId: string,
    from?: string,
    to?: string,
  ) {
    await this.requireStaff(subjectId, actingUserId);

    const { start, end } = resolveRange(from, to);

    const assignmentIds = (
      await this.prisma.assignment.findMany({
        where: { subjectId },
        select: { id: true },
      })
    ).map((a) => a.id);

    const submissions = assignmentIds.length
      ? await this.prisma.submission.findMany({
          where: {
            assignmentId: { in: assignmentIds },
            createdAt: { gte: start, lte: end },
          },
          select: { createdAt: true },
        })
      : [];

    // Bucket by UTC day. One pass over the rows; O(rows + days).
    const counts = new Map<string, number>();
    for (const s of submissions) {
      const key = dayKey(s.createdAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const series: Array<{ date: string; count: number }> = [];
    for (
      let d = new Date(dayKey(start) + 'T00:00:00.000Z');
      d <= end;
      d = new Date(d.getTime() + 86_400_000)
    ) {
      const key = dayKey(d);
      series.push({ date: key, count: counts.get(key) ?? 0 });
    }

    return {
      from: start.toISOString(),
      to: end.toISOString(),
      total: submissions.length,
      series,
    };
  }

  // ---------------------------------------------------------------------------
  // Grade distribution
  // ---------------------------------------------------------------------------

  /**
   * Histogram of GRADED submission scores, normalised to each assignment's
   * maxScore and bucketed into ten 10-point bands (0–10 … 90–100). A perfect
   * score lands in the top band rather than a phantom 100–110 one.
   */
  async getGradeDistribution(subjectId: string, actingUserId: string) {
    await this.requireStaff(subjectId, actingUserId);

    const assignments = await this.prisma.assignment.findMany({
      where: { subjectId },
      select: { id: true, maxScore: true },
    });

    const percents = await this.gradedPercents(assignments);

    const buckets = Array.from({ length: GRADE_BUCKETS }, (_, i) => ({
      label: `${i * 10}-${i * 10 + 10}`,
      min: i * 10,
      max: i * 10 + 10,
      count: 0,
    }));
    for (const p of percents) {
      const idx = Math.min(GRADE_BUCKETS - 1, Math.floor(p / 10));
      buckets[idx].count += 1;
    }

    return { total: percents.length, buckets };
  }

  // ---------------------------------------------------------------------------
  // CSV export
  // ---------------------------------------------------------------------------

  /**
   * The dashboard's data as a single CSV: an overview KPI block, the grade
   * histogram, and the last-30-days submissions series. Fields are RFC-4180
   * escaped and the file is prefixed with a UTF-8 BOM so Excel reads accents.
   */
  async getExportCsv(subjectId: string, actingUserId: string) {
    const [overview, distribution, overTime] = await Promise.all([
      this.getOverview(subjectId, actingUserId),
      this.getGradeDistribution(subjectId, actingUserId),
      this.getSubmissionsOverTime(subjectId, actingUserId),
    ]);

    const rows: string[][] = [];
    rows.push(['Sección', 'Métrica', 'Valor']);
    rows.push(['Resumen', 'Curso', overview.course.title]);
    rows.push(['Resumen', 'Alumnos', String(overview.students)]);
    rows.push(['Resumen', 'Tareas', String(overview.assignments)]);
    rows.push(['Resumen', 'Lecciones', String(overview.lessons)]);
    rows.push([
      'Resumen',
      'Entregas',
      `${overview.submissions.total}/${overview.submissions.expected}`,
    ]);
    rows.push([
      'Resumen',
      'Tasa de entrega (%)',
      String(pct(overview.submissions.rate)),
    ]);
    rows.push([
      'Resumen',
      'Nota media (%)',
      overview.averageGrade != null ? String(overview.averageGrade) : '',
    ]);
    rows.push([
      'Resumen',
      'Finalización de lecciones (%)',
      String(pct(overview.lessonsCompletion.rate)),
    ]);
    rows.push(['Resumen', 'Hilos de foro', String(overview.forum.threads)]);
    rows.push(['Resumen', 'Mensajes de foro', String(overview.forum.posts)]);

    for (const b of distribution.buckets) {
      rows.push(['Distribución de notas', `${b.label} %`, String(b.count)]);
    }

    for (const point of overTime.series) {
      rows.push(['Entregas por día', point.date, String(point.count)]);
    }

    const csv =
      '﻿' + rows.map((r) => r.map(csvField).join(',')).join('\r\n');
    return { filename: `analytics-${subjectId}.csv`, csv };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Load every GRADED submission for the given assignments and return each
   * score as a percentage of its assignment's maxScore (0..100). One query;
   * normalisation happens in memory against a maxScore lookup so assignments
   * with different scales are comparable.
   */
  private async gradedPercents(
    assignments: Array<{ id: string; maxScore: number }>,
  ): Promise<number[]> {
    if (assignments.length === 0) return [];

    const maxById = new Map(assignments.map((a) => [a.id, a.maxScore]));
    const graded = await this.prisma.submission.findMany({
      where: {
        assignmentId: { in: assignments.map((a) => a.id) },
        status: SubmissionStatus.GRADED,
        score: { not: null },
      },
      select: { assignmentId: true, score: true },
    });

    const percents: number[] = [];
    for (const s of graded) {
      const max = maxById.get(s.assignmentId) ?? 0;
      if (s.score == null || max <= 0) continue;
      // Clamp so a lenient over-max score can't escape the [0,100] range.
      percents.push(Math.max(0, Math.min(100, (s.score / max) * 100)));
    }
    return percents;
  }
}

// =============================================================================
// Pure helpers
// =============================================================================

/** Ratio in [0,1], guarding against divide-by-zero. */
function rate(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

/** A [0,1] rate rendered as a rounded percentage for display/CSV. */
function pct(r: number): number {
  return round(r * 100);
}

/** Round to one decimal place. */
function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** UTC `YYYY-MM-DD` key for day-bucketing. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Turn the optional ISO bounds into a concrete `[start, end]` window: default
 * to the last {@link DEFAULT_RANGE_DAYS} days, snap to whole UTC days, and swap
 * reversed bounds so `start <= end` always holds.
 */
function resolveRange(
  from?: string,
  to?: string,
): { start: Date; end: Date } {
  const end = to ? new Date(to) : new Date();
  const start = from
    ? new Date(from)
    : new Date(end.getTime() - DEFAULT_RANGE_DAYS * 86_400_000);

  // Snap to day boundaries (inclusive range).
  const startDay = new Date(dayKey(start) + 'T00:00:00.000Z');
  const endDay = new Date(dayKey(end) + 'T23:59:59.999Z');

  return startDay <= endDay
    ? { start: startDay, end: endDay }
    : { start: new Date(dayKey(end) + 'T00:00:00.000Z'), end: new Date(dayKey(start) + 'T23:59:59.999Z') };
}

/**
 * Escape a single CSV field per RFC-4180: wrap in double quotes and double any
 * embedded quotes when it contains a comma, quote, or newline. Mirrors the
 * grading module's helper (kept local to avoid a cross-module import).
 */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
