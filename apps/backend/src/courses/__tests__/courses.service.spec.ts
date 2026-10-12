import { CoursesService } from '../courses.service';
import type { AuthUser } from '@/common/auth';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG_ID = 'org-klass-0001';
const TEACHER: AuthUser = {
  userId: 'teacher-1', email: 'teacher@example.test', name: 'Teacher',
  avatarUrl: null, organizationId: ORG_ID, role: 'TEACHER',
  emailNotificationsEnabled: true, preferredLanguage: 'es',
};
const STUDENT: AuthUser = { ...TEACHER, userId: 'student-1', role: 'STUDENT' };
const ADMIN: AuthUser = { ...TEACHER, userId: 'admin-1', role: 'ADMIN' };

describe('CoursesService visibility', () => {
  it('does not list every published subject for a teacher who does not staff it', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { subject: { findMany } } as unknown as PrismaService;
    const service = new CoursesService(prisma, {} as never);

    await service.listMySubjects(TEACHER);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: ORG_ID,
        staff: { some: { userId: TEACHER.userId } },
      }),
    }));
    const where = findMany.mock.calls[0][0].where;
    expect(where.status).toBeUndefined();
    expect(JSON.stringify(where)).not.toContain('PUBLISHED');
  });

  it('lists only published subjects of cohorts the student belongs to', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { subject: { findMany } } as unknown as PrismaService;
    const service = new CoursesService(prisma, {} as never);

    await service.listMySubjects(STUDENT);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: ORG_ID,
        status: 'PUBLISHED',
        course: expect.objectContaining({
          memberships: { some: { userId: STUDENT.userId } },
        }),
      }),
    }));
  });

  it('lets an admin list every subject in their organization', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { subject: { findMany } } as unknown as PrismaService;
    const service = new CoursesService(prisma, {} as never);

    await service.listMySubjects(ADMIN);

    const where = findMany.mock.calls[0][0].where;
    expect(where).toEqual({ organizationId: ORG_ID });
  });

  it('limits cohort listings the same way', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { course: { findMany } } as unknown as PrismaService;
    const service = new CoursesService(prisma, {} as never);

    await service.findAll(STUDENT);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: ORG_ID,
        memberships: { some: { userId: STUDENT.userId } },
      }),
    }));
  });

  it('creates a cohort without making the admin staff or owner', async () => {
    const create = jest.fn(async ({ data }: any) => ({ id: 'course-1', ...data }));
    const prisma = { course: { create } } as unknown as PrismaService;
    const service = new CoursesService(prisma, {} as never);

    const result = await service.create({
      name: '1º A',
      academicYear: '2025-2026',
      startsOn: '2025-09-01',
      endsOn: '2026-06-30',
    }, ADMIN);

    expect(result).toMatchObject({ organizationId: ORG_ID, name: '1º A' });
    expect(result).not.toHaveProperty('ownerId');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
