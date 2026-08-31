-- AlterTable
ALTER TABLE "User"
ADD COLUMN "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "preferredLanguage" TEXT NOT NULL DEFAULT 'es';
