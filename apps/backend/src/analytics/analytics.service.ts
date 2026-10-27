import { BadRequestException, Injectable } from '@nestjs/common';
import { AttemptStatus } from '@prisma/client';
import { CourseAccessService } from '../courses/course-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { escapeCsvField } from '../common/csv-field';
import {
  gradableActivitiesWhere,
  subjectStudentsWhere,
  summarizeSubjectResults,
} from '../activities/gradable-activities';
import { analyticsDateRangeError } from './date-range';

const SUBMITTED_STATUSES = [AttemptStatus.SUBMITTED, AttemptStatus.GRADED];
const GRADE_BUCKETS = 10;
const DEFAULT_RANGE_DAYS = 30;
const DAY_MS = 86_400_000;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
  ) {}

  private async requireStaff(subjectId: string, actingUserId: string) {
    const access = await this.access.assertSubjectStaffForUser(subjectId, actingUserId);
    return access.subject;
  }

  /**
   * Course KPIs, scoped to the subject's organization and staff gate. Delivery
   * and grades are counted per (student, gradable activity) pair with the same
   * rules as the gradebook (see `activities/gradable-activities.ts`).
   */
  async getOverview(subjectId: string, actingUserId: string) {
    const subject = await this.requireStaff(subjectId, actingUserId);
    const [results, lessonCount, completionCount, threadCount, postCount] =
      await Promise.all([
        this.subjectResults(subject),
        this.prisma.lesson.count({
          where: {
            section: {
              subjectId,
              subject: { organizationId: subject.organizationId },
            },
          },
        }),
        this.prisma.lessonCompletion.count({
          where: {
            lesson: {
              section: {
                subjectId,
                subject: { organizationId: subject.organizationId },
              },
            },
          },
        }),
        this.prisma.forumThread.count({
          where: { subjectId, subject: { organizationId: subject.organizationId } },
        }),
        this.prisma.forumPost.count({
          where: {
            thread: {
              subjectId,
              subject: { organizationId: subject.organizationId },
            },
          },
        }),
      ]);

    const { studentIds, activities, summary } = results;
    const averageGrade = summary.percents.length
      ? round(summary.percents.reduce((sum, score) => sum + score, 0) / summary.percents.length)
      : null;
    const expectedCompletions = studentIds.length * lessonCount;

    return {
      course: { id: subject.id, title: subject.title },
      students: studentIds.length,
      // Keep the existing response key consumed by the analytics frontend.
      assignments: activities.length,
      lessons: lessonCount,
      // Counted in (student, activity) pairs, so `total <= expected` and
      // `graded` is exactly the number of grades behind `averageGrade`.
      submissions: {
        total: summary.delivered,
        expected: summary.expected,
        graded: summary.graded,
        pending: summary.pending,
        rate: rate(summary.delivered, summary.expected),
      },
      averageGrade,
      lessonsCompletion: {
        completed: completionCount,
        expected: expectedCompletions,
        rate: rate(completionCount, expectedCompletions),
      },
      forum: { threads: threadCount, posts: postCount },
    };
  }

  /** Daily submitted attempts (all attempts, not pairs) over a validated, inclusive UTC date range. */
  async getSubmissionsOverTime(
    subjectId: string,
    actingUserId: string,
    from?: string,
    to?: string,
  ) {
    const subject = await this.requireStaff(subjectId, actingUserId);
    const { start, end } = resolveRange(from, to);
    const [activities, studentIds] = await Promise.all([
      this.gradableActivities(subject),
      this.studentIds(subject),
    ]);
    const submittedGroups = activities.length && studentIds.length
      ? await this.prisma.attempt.groupBy({
          by: ['submittedAt'],
          where: {
            activityId: { in: activities.map((activity) => activity.id) },
            userId: { in: studentIds },
            status: { in: SUBMITTED_STATUSES },
            submittedAt: { not: null, gte: start, lte: end },
            activity: {
              subjectId,
              subject: { organizationId: subject.organizationId },
            },
          },
          _count: { _all: true },
        })
      : [];

    const counts = new Map<string, number>();
    for (const group of submittedGroups) {
      if (!group.submittedAt) continue;
      const key = dayKey(group.submittedAt);
      counts.set(key, (counts.get(key) ?? 0) + group._count._all);
    }

    const series: Array<{ date: string; count: number }> = [];
    for (let day = startOfDay(start); day <= startOfDay(end); day = new Date(day.getTime() + DAY_MS)) {
      const date = dayKey(day);
      series.push({ date, count: counts.get(date) ?? 0 });
    }

    return {
      from: start.toISOString(),
      to: end.toISOString(),
      total: submittedGroups.reduce((sum, group) => sum + group._count._all, 0),
      series,
    };
  }

  /** Grade histogram of the same per-(student, activity) grades behind the average. */
  async getGradeDistribution(subjectId: string, actingUserId: string) {
    const subject = await this.requireStaff(subjectId, actingUserId);
    const { summary } = await this.subjectResults(subject);
    const percents = summary.percents;

    const buckets = Array.from({ length: GRADE_BUCKETS }, (_, index) => ({
      label: `${index * 10}-${index * 10 + 10}`,
      min: index * 10,
      max: index * 10 + 10,
      count: 0,
    }));
    for (const percent of percents) {
      const index = Math.min(GRADE_BUCKETS - 1, Math.floor(percent / 10));
      buckets[index].count += 1;
    }

    return { total: percents.length, buckets };
  }

  /** Export the current overview, full grade histogram, and selected time range. */
  async getExportCsv(
    subjectId: string,
    actingUserId: string,
    from?: string,
    to?: string,
  ) {
    const [overview, distribution, overTime] = await Promise.all([
      this.getOverview(subjectId, actingUserId),
      this.getGradeDistribution(subjectId, actingUserId),
      this.getSubmissionsOverTime(subjectId, actingUserId, from, to),
    ]);

    const rows: string[][] = [
      ['Sección', 'Métrica', 'Valor'],
      ['Resumen', 'Curso', overview.course.title],
      ['Resumen', 'Alumnos', String(overview.students)],
      ['Resumen', 'Tareas', String(overview.assignments)],
      ['Resumen', 'Lecciones', String(overview.lessons)],
      ['Resumen', 'Entregas', `${overview.submissions.total}/${overview.submissions.expected}`],
      ['Resumen', 'Tasa de entrega (%)', String(pct(overview.submissions.rate))],
      ['Resumen', 'Notas calificadas', String(overview.submissions.graded)],
      ['Resumen', 'Nota media (%)', overview.averageGrade == null ? '' : String(overview.averageGrade)],
      ['Resumen', 'Finalización de lecciones (%)', String(pct(overview.lessonsCompletion.rate))],
      ['Resumen', 'Hilos de foro', String(overview.forum.threads)],
      ['Resumen', 'Mensajes de foro', String(overview.forum.posts)],
    ];

    for (const bucket of distribution.buckets) {
      rows.push(['Distribución de notas', `${bucket.label} %`, String(bucket.count)]);
    }
    for (const point of overTime.series) {
      rows.push(['Entregas por día', point.date, String(point.count)]);
    }

    return {
      filename: `analytics-${subjectId}.csv`,
      csv: '\uFEFF' + rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n'),
    };
  }

  private gradableActivities(subject: SubjectScope) {
    return this.prisma.activity.findMany({
      where: gradableActivitiesWhere(subject.id, subject.organizationId),
      select: { id: true, maxScore: true },
    });
  }

  private async studentIds(subject: SubjectScope): Promise<string[]> {
    const members = await this.prisma.courseMembership.findMany({
      where: subjectStudentsWhere(subject),
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  }

  /** Gradable activities, students and their delivery/grade summary for a subject. */
  private async subjectResults(subject: SubjectScope) {
    const [activities, studentIds] = await Promise.all([
      this.gradableActivities(subject),
      this.studentIds(subject),
    ]);
    const attempts = activities.length && studentIds.length
      ? await this.prisma.attempt.findMany({
          where: {
            activityId: { in: activities.map((activity) => activity.id) },
            userId: { in: studentIds },
            status: { in: SUBMITTED_STATUSES },
            activity: {
              subjectId: subject.id,
              subject: { organizationId: subject.organizationId },
            },
          },
          select: {
            activityId: true,
            userId: true,
            status: true,
            score: true,
            attemptNo: true,
          },
        })
      : [];
    return {
      activities,
      studentIds,
      summary: summarizeSubjectResults(activities, studentIds, attempts),
    };
  }
}

interface SubjectScope {
  id: string;
  courseId: string;
  organizationId: string;
}

function rate(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

function pct(value: number): number {
  return round(value * 100);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date): Date {
  return new Date(`${dayKey(date)}T00:00:00.000Z`);
}

function resolveRange(from?: string, to?: string): { start: Date; end: Date } {
  if (from && to) {
    const error = analyticsDateRangeError(from, to);
    if (error) throw new BadRequestException(error);
  }

  const end = to ? new Date(to) : new Date();
  const start = from
    ? new Date(from)
    : new Date(end.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new BadRequestException('Las fechas del rango no son válidas.');
  }

  const resolvedError = analyticsDateRangeError(start.toISOString(), end.toISOString());
  if (resolvedError) throw new BadRequestException(resolvedError);
  return {
    start: startOfDay(start),
    end: new Date(`${dayKey(end)}T23:59:59.999Z`),
  };
}
