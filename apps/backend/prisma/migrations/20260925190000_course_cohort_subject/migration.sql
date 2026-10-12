-- Course becomes a cohort. The previous Course table is the subject offering.
-- Written by hand so Prisma does not DROP TABLE "Course" and lose rows.
-- Demo data may be rewritten by the seed after this migration.

-- 1. Rename the teaching container and the publication enum it shares with Activity.
ALTER TYPE "CourseStatus" RENAME TO "PublicationStatus";

ALTER TABLE "Course" RENAME TO "Subject";
ALTER TABLE "Subject" RENAME CONSTRAINT "Course_pkey" TO "Subject_pkey";
ALTER TABLE "Subject" RENAME CONSTRAINT "Course_organizationId_fkey" TO "Subject_organizationId_fkey";
ALTER TABLE "Subject" RENAME CONSTRAINT "Course_ownerId_fkey" TO "Subject_ownerId_fkey";
ALTER INDEX "Course_accessCode_key" RENAME TO "Subject_accessCode_key";
ALTER INDEX "Course_organizationId_idx" RENAME TO "Subject_organizationId_idx";

-- 2. New cohort table. The old Course name is free after the rename above.
CREATE TYPE "CohortStatus" AS ENUM ('PLANNED', 'ACTIVE', 'ARCHIVED');

CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "status" "CohortStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Course_organizationId_name_academicYear_key" ON "Course"("organizationId", "name", "academicYear");
CREATE INDEX "Course_organizationId_idx" ON "Course"("organizationId");

ALTER TABLE "Course" ADD CONSTRAINT "Course_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. One ACTIVE cohort per organization that already has subjects, then attach them.
INSERT INTO "Course" ("id", "organizationId", "name", "academicYear", "startsOn", "endsOn", "status", "createdAt", "updatedAt")
SELECT
    'legacy-cohort-' || o."id",
    o."id",
    'Cohorte existente',
    '2025-2026',
    TIMESTAMP '2025-09-01 00:00:00',
    TIMESTAMP '2026-06-30 00:00:00',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Organization" o
WHERE EXISTS (
    SELECT 1 FROM "Subject" s WHERE s."organizationId" = o."id"
);

ALTER TABLE "Subject" ADD COLUMN "courseId" TEXT;

UPDATE "Subject" s
SET "courseId" = 'legacy-cohort-' || s."organizationId";

ALTER TABLE "Subject" ALTER COLUMN "courseId" SET NOT NULL;
CREATE INDEX "Subject_courseId_idx" ON "Subject"("courseId");
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Staff enum, memberships, and staff rows copied from Enrollment (+ owners).
CREATE TYPE "SubjectStaffRole" AS ENUM ('TEACHER', 'ASSISTANT');

CREATE TABLE "CourseMembership" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseMembership_courseId_userId_key" ON "CourseMembership"("courseId", "userId");
CREATE INDEX "CourseMembership_userId_idx" ON "CourseMembership"("userId");

ALTER TABLE "CourseMembership" ADD CONSTRAINT "CourseMembership_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseMembership" ADD CONSTRAINT "CourseMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SubjectStaff" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SubjectStaffRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectStaff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubjectStaff_subjectId_userId_key" ON "SubjectStaff"("subjectId", "userId");
CREATE INDEX "SubjectStaff_userId_idx" ON "SubjectStaff"("userId");

ALTER TABLE "SubjectStaff" ADD CONSTRAINT "SubjectStaff_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectStaff" ADD CONSTRAINT "SubjectStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CourseMembership" ("id", "courseId", "userId", "createdAt")
SELECT DISTINCT ON (s."courseId", e."userId")
    'mem-' || e."id",
    s."courseId",
    e."userId",
    e."createdAt"
FROM "Enrollment" e
JOIN "Subject" s ON s."id" = e."courseId"
WHERE e."role" = 'STUDENT'
ORDER BY s."courseId", e."userId", e."createdAt";

INSERT INTO "SubjectStaff" ("id", "subjectId", "userId", "role", "createdAt")
SELECT
    'staff-' || e."id",
    e."courseId",
    e."userId",
    e."role"::text::"SubjectStaffRole",
    e."createdAt"
FROM "Enrollment" e
WHERE e."role" IN ('TEACHER', 'ASSISTANT');

INSERT INTO "SubjectStaff" ("id", "subjectId", "userId", "role", "createdAt")
SELECT
    'owner-' || s."id",
    s."id",
    s."ownerId",
    'TEACHER',
    CURRENT_TIMESTAMP
FROM "Subject" s
WHERE s."ownerId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "SubjectStaff" st
    WHERE st."subjectId" = s."id" AND st."userId" = s."ownerId"
  );

-- 5. Child foreign keys follow the subject. PostgreSQL keeps the FK valid
--    across a column rename; rename the constraints to match Prisma.
ALTER TABLE "Section" RENAME COLUMN "courseId" TO "subjectId";
ALTER TABLE "Section" RENAME CONSTRAINT "Section_courseId_fkey" TO "Section_subjectId_fkey";
ALTER INDEX "Section_courseId_idx" RENAME TO "Section_subjectId_idx";

ALTER TABLE "Assignment" RENAME COLUMN "courseId" TO "subjectId";
ALTER TABLE "Assignment" RENAME CONSTRAINT "Assignment_courseId_fkey" TO "Assignment_subjectId_fkey";
ALTER INDEX "Assignment_courseId_idx" RENAME TO "Assignment_subjectId_idx";

ALTER TABLE "Activity" RENAME COLUMN "courseId" TO "subjectId";
ALTER TABLE "Activity" RENAME CONSTRAINT "Activity_courseId_fkey" TO "Activity_subjectId_fkey";
ALTER INDEX "Activity_courseId_idx" RENAME TO "Activity_subjectId_idx";

ALTER TABLE "ForumThread" RENAME COLUMN "courseId" TO "subjectId";
ALTER TABLE "ForumThread" RENAME CONSTRAINT "ForumThread_courseId_fkey" TO "ForumThread_subjectId_fkey";
ALTER INDEX "ForumThread_courseId_idx" RENAME TO "ForumThread_subjectId_idx";

ALTER TABLE "CourseResource" RENAME COLUMN "courseId" TO "subjectId";
ALTER TABLE "CourseResource" RENAME TO "SubjectResource";
ALTER TABLE "SubjectResource" RENAME CONSTRAINT "CourseResource_pkey" TO "SubjectResource_pkey";
ALTER TABLE "SubjectResource" RENAME CONSTRAINT "CourseResource_resourceId_fkey" TO "SubjectResource_resourceId_fkey";
ALTER TABLE "SubjectResource" RENAME CONSTRAINT "CourseResource_courseId_fkey" TO "SubjectResource_subjectId_fkey";
ALTER INDEX "CourseResource_courseId_order_idx" RENAME TO "SubjectResource_subjectId_order_idx";

-- 6. Point stored notification links that targeted the old course id.
UPDATE "Notification" AS n
SET "link" = '/courses/' || s."courseId" || '/subjects/' || s."id"
FROM "Subject" AS s
WHERE n."link" = '/courses/' || s."id";

-- 7. Drop the old enrolment model, owner, access code, and CourseRole.
DROP TABLE "Enrollment";

ALTER TABLE "Subject" DROP CONSTRAINT "Subject_ownerId_fkey";
ALTER TABLE "Subject" DROP COLUMN "ownerId";
DROP INDEX "Subject_accessCode_key";
ALTER TABLE "Subject" DROP COLUMN "accessCode";

DROP TYPE "CourseRole";
