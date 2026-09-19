-- AlterEnum
ALTER TYPE "QuestionKind" ADD VALUE 'ESSAY';
ALTER TYPE "QuestionKind" ADD VALUE 'FILE_UPLOAD';

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "countsTowardFinal" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "templateId" TEXT;

-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "feedback" TEXT;

-- CreateTable
CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "blocks" JSONB NOT NULL,
    "createdFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityFile" (
    "activityId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "ActivityFile_pkey" PRIMARY KEY ("activityId","fileId")
);

-- CreateIndex
CREATE INDEX "TaskTemplate_organizationId_idx" ON "TaskTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "TaskTemplate_createdById_idx" ON "TaskTemplate"("createdById");

-- CreateIndex
CREATE INDEX "ActivityFile_fileId_idx" ON "ActivityFile"("fileId");

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityFile" ADD CONSTRAINT "ActivityFile_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityFile" ADD CONSTRAINT "ActivityFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
