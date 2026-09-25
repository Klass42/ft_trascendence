-- CreateEnum
CREATE TYPE "OrganizationPlan" AS ENUM ('STARTER', 'GROWTH', 'ENTERPRISE', 'CUSTOM');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "maxCourses" INTEGER,
ADD COLUMN     "maxStorageMb" INTEGER,
ADD COLUMN     "maxUsers" INTEGER,
ADD COLUMN     "plan" "OrganizationPlan" NOT NULL DEFAULT 'STARTER';
