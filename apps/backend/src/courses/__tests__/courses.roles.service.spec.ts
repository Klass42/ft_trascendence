import { ConflictException, ForbiddenException } from '@nestjs/common';
import { CoursesService } from '../courses.service';
import type { AuthUser } from '@/common/auth';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG_ID = 'org-1';
const ADMIN: AuthUser = {
  userId: 'admin-1', email: 'admin@example.test', name: 'Admin', avatarUrl: null,
  organizationId: ORG_ID, role: 'ADMIN', emailNotificationsEnabled: true,
  preferredLanguage: 'es',
};

function memberService(targetRole: string) {
  const tx = {
    course: { findFirst: jest.fn().mockResolvedValue({ id: 'course-1', name: 'C', organizationId: ORG_ID, status: 'ACTIVE' }) },
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'u-1', role: targetRole }) },
    courseMembership: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }: any) => ({ id: 'm-1', ...data })),
    },
  };
  const prisma = { $transaction: jest.fn(async (cb: (c: typeof tx) => unknown) => cb(tx)) } as unknown as PrismaService;
  return { service: new CoursesService(prisma, {} as never), tx };
}

function staffService(targetRole: string) {
  const prisma = {
    subject: { findFirst: jest.fn().mockResolvedValue({ id: 's-1', title: 'S', courseId: 'course-1', organizationId: ORG_ID, course: { organizationId: ORG_ID } }) },
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'u-1', role: targetRole }) },
    subjectStaff: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }: any) => ({ id: 'st-1', ...data })),
    },
  } as unknown as PrismaService;
  return { service: new CoursesService(prisma, {} as never), prisma };
}

describe('CoursesService role rules (#105)', () => {
  it.each(['STUDENT', 'TEACHER'])('enrolls a %s', async (role) => {
    const { service, tx } = memberService(role);
    await expect(service.addMember('course-1', ADMIN, { userId: 'u-1' })).resolves.toMatchObject({ userId: 'u-1' });
    expect(tx.courseMembership.create).toHaveBeenCalled();
  });

  it('rejects enrolling an ADMIN with 403 and a Spanish message', async () => {
    const { service, tx } = memberService('ADMIN');
    const err = await service.addMember('course-1', ADMIN, { userId: 'u-1' }).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.message).toMatch(/alumno o profesor/);
    expect(tx.courseMembership.create).not.toHaveBeenCalled();
  });

  it('#134 rejects enrolling or assigning a deactivated account', async () => {
    const member = memberService('STUDENT');
    member.tx.user.findFirst.mockResolvedValue({ id: 'u-1', role: 'STUDENT', deactivatedAt: new Date() });
    await expect(member.service.addMember('course-1', ADMIN, { userId: 'u-1' })).rejects.toThrow(/desactivada/);
    expect(member.tx.courseMembership.create).not.toHaveBeenCalled();

    const staff = staffService('TEACHER');
    (staff.prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'u-1', role: 'TEACHER', deactivatedAt: new Date() });
    await expect(staff.service.addStaff('s-1', ADMIN, { userId: 'u-1', role: 'TEACHER' })).rejects.toThrow(/desactivada/);
    expect(staff.prisma.subjectStaff.create).not.toHaveBeenCalled();
  });

  it('explains the 409 when the user already has another active cohort', async () => {
    const { service, tx } = memberService('STUDENT');
    tx.courseMembership.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'other' });
    const err = await service.addMember('course-1', ADMIN, { userId: 'u-1' }).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.message).toMatch(/otra cohorte activa/);
  });

  it.each(['TEACHER', 'ADMIN'])('assigns a %s as staff', async (role) => {
    const { service, prisma } = staffService(role);
    await expect(service.addStaff('s-1', ADMIN, { userId: 'u-1', role: 'TEACHER' })).resolves.toMatchObject({ userId: 'u-1' });
    expect(prisma.subjectStaff.create).toHaveBeenCalled();
  });

  it('rejects assigning a STUDENT as staff with 403 and a Spanish message', async () => {
    const { service, prisma } = staffService('STUDENT');
    const err = await service.addStaff('s-1', ADMIN, { userId: 'u-1', role: 'TEACHER' }).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.message).toMatch(/profesor o administrador/);
    expect(prisma.subjectStaff.create).not.toHaveBeenCalled();
  });
});
