-- CreateEnum
CREATE TYPE "LearningResourceType" AS ENUM ('BOOK', 'DOCUMENT', 'LINK', 'VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "LearningResourceStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('QUIZ', 'LISTENING', 'SPEAKING');

-- CreateEnum
CREATE TYPE "QuestionKind" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'MATCHING', 'ORDERING', 'SHORT_ANSWER');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED');

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "closeAt" TIMESTAMP(3),
ADD COLUMN     "openAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LearningResource" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "LearningResourceType" NOT NULL,
    "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publisher" TEXT,
    "isbn" TEXT,
    "language" TEXT,
    "license" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fileId" TEXT,
    "externalUrl" TEXT,
    "status" "LearningResourceStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseResource" (
    "resourceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CourseResource_pkey" PRIMARY KEY ("resourceId","courseId")
);

-- CreateTable
CREATE TABLE "AssignmentFile" (
    "assignmentId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "AssignmentFile_pkey" PRIMARY KEY ("assignmentId","fileId")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL DEFAULT 'QUIZ',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "openAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "closeAt" TIMESTAMP(3),
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "attemptsAllowed" INTEGER NOT NULL DEFAULT 1,
    "timeLimitSec" INTEGER,
    "config" JSONB NOT NULL DEFAULT '{}',
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "kind" "QuestionKind" NOT NULL,
    "prompt" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "gradedById" TEXT,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "correct" BOOLEAN,
    "awarded" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningResource_organizationId_status_idx" ON "LearningResource"("organizationId", "status");

-- CreateIndex
CREATE INDEX "LearningResource_organizationId_type_idx" ON "LearningResource"("organizationId", "type");

-- CreateIndex
CREATE INDEX "LearningResource_createdById_idx" ON "LearningResource"("createdById");

-- CreateIndex
CREATE INDEX "LearningResource_fileId_idx" ON "LearningResource"("fileId");

-- CreateIndex
CREATE INDEX "CourseResource_courseId_order_idx" ON "CourseResource"("courseId", "order");

-- CreateIndex
CREATE INDEX "AssignmentFile_fileId_idx" ON "AssignmentFile"("fileId");

-- CreateIndex
CREATE INDEX "Activity_courseId_idx" ON "Activity"("courseId");

-- CreateIndex
CREATE INDEX "Question_activityId_idx" ON "Question"("activityId");

-- CreateIndex
CREATE INDEX "Attempt_userId_idx" ON "Attempt"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_activityId_userId_attemptNo_key" ON "Attempt"("activityId", "userId", "attemptNo");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_attemptId_questionId_key" ON "Answer"("attemptId", "questionId");

-- AddForeignKey
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "LearningResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentFile" ADD CONSTRAINT "AssignmentFile_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentFile" ADD CONSTRAINT "AssignmentFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
