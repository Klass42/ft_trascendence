/**
 * Idempotent Assignment → Activity migration.
 *
 * Usage (from repo root):
 *   pnpm --filter backend exec tsx prisma/migrate-assignments-to-activities.ts
 *
 * Skips any Assignment that already has an Activity with
 * `config.migratedFromAssignmentId === assignment.id`.
 */
import { AttemptStatus, PrismaClient, QuestionKind } from '@prisma/client';
import {
  mapAssignment,
  mapSubmission,
} from '../src/activities/migration/assignment-mapper';

const prisma = new PrismaClient();

async function alreadyMigrated(assignmentId: string): Promise<boolean> {
  const existing = await prisma.activity.findFirst({
    where: {
      config: {
        path: ['migratedFromAssignmentId'],
        equals: assignmentId,
      },
    },
    select: { id: true },
  });
  return !!existing;
}

async function migrate() {
  const assignments = await prisma.assignment.findMany({
    include: {
      files: true,
      submissions: { include: { files: true } },
    },
  });

  let created = 0;
  let skipped = 0;

  for (const assignment of assignments) {
    if (await alreadyMigrated(assignment.id)) {
      skipped += 1;
      continue;
    }

    const hasStudentFiles = assignment.submissions.some(
      (s) => s.files.length > 0,
    );
    const mapped = mapAssignment({ assignment, hasStudentFiles });

    const activity = await prisma.activity.create({
      data: {
        courseId: mapped.courseId,
        title: mapped.title,
        description: mapped.description,
        openAt: mapped.openAt,
        dueAt: mapped.dueAt,
        closeAt: mapped.closeAt,
        attemptsAllowed: mapped.attemptsAllowed,
        status: mapped.status,
        countsTowardFinal: mapped.countsTowardFinal,
        maxScore: mapped.questions.reduce((s, q) => s + q.points, 0),
        config: mapped.config,
        questions: {
          create: mapped.questions.map((q) => ({
            kind: q.kind as QuestionKind,
            prompt: q.prompt,
            points: q.points,
            order: q.order,
            content: q.content,
          })),
        },
        files: {
          create: assignment.files.map((f) => ({ fileId: f.fileId })),
        },
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    const essay = activity.questions.find((q) => q.kind === QuestionKind.ESSAY);
    const fileQ = activity.questions.find(
      (q) => q.kind === QuestionKind.FILE_UPLOAD,
    );
    if (!essay) {
      throw new Error(`Migrated activity ${activity.id} is missing ESSAY`);
    }

    for (const submission of assignment.submissions) {
      const mappedSub = mapSubmission({
        submission,
        essayQuestionId: essay.id,
        fileQuestionId: fileQ?.id ?? null,
        fileIds: submission.files.map((f) => f.fileId),
      });
      await prisma.attempt.create({
        data: {
          activityId: activity.id,
          userId: submission.userId,
          attemptNo: mappedSub.attempt.attemptNo,
          status: mappedSub.attempt.status as AttemptStatus,
          score: mappedSub.attempt.score,
          feedback: mappedSub.attempt.feedback,
          gradedById: mappedSub.attempt.gradedById,
          gradedAt: mappedSub.attempt.gradedAt,
          submittedAt: submission.updatedAt,
          answers: {
            create: mappedSub.answers.map((a) => ({
              questionId: a.questionId,
              response: a.response as object,
              awarded: a.awarded,
            })),
          },
        },
      });
    }

    created += 1;
  }

  console.log(`migrated ${created} assignment(s), skipped ${skipped}`);
}

migrate()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
