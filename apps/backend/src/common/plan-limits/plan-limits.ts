import { ForbiddenException } from '@nestjs/common';

// Issue #106: plan limits (maxUsers / maxCourses / maxStorageMb) stored on the
// Organization are enforced at creation time. null = unlimited.
// #134: deactivated users do not count against maxUsers (reactivating re-checks).
type Db = {
  organization: { findUnique(args: any): Promise<any> };
  user: { count(args: any): Promise<number> };
  course: { count(args: any): Promise<number> };
  file: { aggregate(args: any): Promise<any> };
};

async function limits(db: Db, organizationId: string) {
  return db.organization.findUnique({ where: { id: organizationId }, select: { maxUsers: true, maxCourses: true, maxStorageMb: true } });
}

export async function assertUserLimit(db: Db, organizationId: string, adding = 1) {
  const org = await limits(db, organizationId);
  if (org?.maxUsers == null) return;
  const count = await db.user.count({ where: { organizationId, deactivatedAt: null } });
  if (count + adding > org.maxUsers) throw new ForbiddenException(`La organización ha alcanzado el límite de usuarios de su plan (${org.maxUsers}).`);
}

export async function assertCourseLimit(db: Db, organizationId: string) {
  const org = await limits(db, organizationId);
  if (org?.maxCourses == null) return;
  const count = await db.course.count({ where: { organizationId } });
  if (count + 1 > org.maxCourses) throw new ForbiddenException(`La organización ha alcanzado el límite de cohortes de su plan (${org.maxCourses}).`);
}

export async function assertStorageLimit(db: Db, organizationId: string, incomingBytes: number) {
  const org = await limits(db, organizationId);
  if (org?.maxStorageMb == null) return;
  const agg = await db.file.aggregate({ where: { organizationId }, _sum: { sizeBytes: true } });
  const used = Number(agg?._sum?.sizeBytes ?? 0);
  if (used + incomingBytes > org.maxStorageMb * 1024 * 1024) throw new ForbiddenException(`La organización ha alcanzado el límite de almacenamiento de su plan (${org.maxStorageMb} MB).`);
}
