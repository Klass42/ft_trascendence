-- #26: real library folders + live folder publication
ALTER TABLE "LearningResource" ADD COLUMN "folderId" TEXT;

CREATE TABLE "ResourceFolder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResourceFolder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubjectFolder" (
    "folderId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubjectFolder_pkey" PRIMARY KEY ("folderId","subjectId")
);

CREATE INDEX "LearningResource_folderId_idx" ON "LearningResource"("folderId");
CREATE INDEX "ResourceFolder_organizationId_parentId_idx" ON "ResourceFolder"("organizationId", "parentId");
CREATE INDEX "ResourceFolder_createdById_idx" ON "ResourceFolder"("createdById");
CREATE INDEX "SubjectFolder_subjectId_idx" ON "SubjectFolder"("subjectId");

ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ResourceFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResourceFolder" ADD CONSTRAINT "ResourceFolder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceFolder" ADD CONSTRAINT "ResourceFolder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResourceFolder" ADD CONSTRAINT "ResourceFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ResourceFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubjectFolder" ADD CONSTRAINT "SubjectFolder_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ResourceFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectFolder" ADD CONSTRAINT "SubjectFolder_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
