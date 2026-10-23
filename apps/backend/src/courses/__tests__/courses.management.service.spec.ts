import { ConflictException, NotFoundException } from '@nestjs/common';
import { CoursesService } from '../courses.service';
import type { AuthUser } from '@/common/auth';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG_ID = 'org-1';
const ADMIN: AuthUser = {
  userId: 'admin-1', email: 'admin@example.test', name: 'Admin', avatarUrl: null,
  organizationId: ORG_ID, role: 'ADMIN', emailNotificationsEnabled: true,
  preferredLanguage: 'es',
};

function makeService() {
  const prisma = {
    course: { findFirst: jest.fn(), delete: jest.fn() },
    subject: { findFirst: jest.fn(), delete: jest.fn() },
    courseMembership: { findFirst: jest.fn() },
    attempt: { findFirst: jest.fn() },
    submission: { findFirst: jest.fn() },
  } as unknown as PrismaService;
  return { service: new CoursesService(prisma, {} as never), prisma };
}

describe('CoursesService cohort and subject management', () => {
  it('returns 404 for a cohort outside the caller organization', async () => {
    const { service, prisma } = makeService();
    (prisma.course.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.delete('course-other', ADMIN)).rejects.toThrow(NotFoundException);
    expect(prisma.course.findFirst).toHaveBeenCalledWith({
      where: { id: 'course-other', organizationId: ORG_ID },
      select: { id: true, _count: { select: { memberships: true } } },
    });
    expect(prisma.course.delete).not.toHaveBeenCalled();
  });

  it('blocks cohort deletion when it still has enrollments', async () => {
    const { service, prisma } = makeService();
    (prisma.course.findFirst as jest.Mock).mockResolvedValue({ id: 'course-1', _count: { memberships: 1 } });
    (prisma.attempt.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.submission.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.delete('course-1', ADMIN)).rejects.toThrow(ConflictException);
    expect(prisma.course.delete).not.toHaveBeenCalled();
  });

  it('blocks cohort deletion when a subject has an attempt', async () => {
    const { service, prisma } = makeService();
    (prisma.course.findFirst as jest.Mock).mockResolvedValue({ id: 'course-1', _count: { memberships: 0 } });
    (prisma.attempt.findFirst as jest.Mock).mockResolvedValue({ id: 'attempt-1' });
    (prisma.submission.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.delete('course-1', ADMIN)).rejects.toThrow(ConflictException);
    expect(prisma.attempt.findFirst).toHaveBeenCalledWith({
      where: { activity: { subject: { courseId: 'course-1', organizationId: ORG_ID } } },
      select: { id: true },
    });
    expect(prisma.course.delete).not.toHaveBeenCalled();
  });

  it('deletes an empty cohort inside the caller organization', async () => {
    const { service, prisma } = makeService();
    (prisma.course.findFirst as jest.Mock).mockResolvedValue({ id: 'course-1', _count: { memberships: 0 } });
    (prisma.attempt.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.submission.findFirst as jest.Mock).mockResolvedValue(null);

    await service.delete('course-1', ADMIN);
    expect(prisma.course.delete).toHaveBeenCalledWith({ where: { id: 'course-1' } });
  });

  it('returns 404 for a subject outside the caller organization', async () => {
    const { service, prisma } = makeService();
    (prisma.subject.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.deleteSubject('subject-other', ADMIN)).rejects.toThrow(NotFoundException);
    expect(prisma.subject.findFirst).toHaveBeenCalledWith({
      where: { id: 'subject-other', organizationId: ORG_ID },
      include: { course: true },
    });
    expect(prisma.subject.delete).not.toHaveBeenCalled();
  });

  it('blocks subject deletion when its cohort has enrollments', async () => {
    const { service, prisma } = makeService();
    (prisma.subject.findFirst as jest.Mock).mockResolvedValue({
      id: 'subject-1', organizationId: ORG_ID, courseId: 'course-1', course: { organizationId: ORG_ID },
    });
    (prisma.courseMembership.findFirst as jest.Mock).mockResolvedValue({ id: 'membership-1' });
    (prisma.attempt.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.submission.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.deleteSubject('subject-1', ADMIN)).rejects.toThrow(ConflictException);
    expect(prisma.courseMembership.findFirst).toHaveBeenCalledWith({
      where: { courseId: 'course-1', course: { organizationId: ORG_ID } },
      select: { id: true },
    });
    expect(prisma.subject.delete).not.toHaveBeenCalled();
  });

  it('blocks subject deletion when it has a submission', async () => {
    const { service, prisma } = makeService();
    (prisma.subject.findFirst as jest.Mock).mockResolvedValue({
      id: 'subject-1', organizationId: ORG_ID, courseId: 'course-1', course: { organizationId: ORG_ID },
    });
    (prisma.courseMembership.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.attempt.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.submission.findFirst as jest.Mock).mockResolvedValue({ id: 'submission-1' });

    await expect(service.deleteSubject('subject-1', ADMIN)).rejects.toThrow(ConflictException);
    expect(prisma.subject.delete).not.toHaveBeenCalled();
  });

  it('returns 404 for a cohort PATCH target from another organization', async () => {
    const { service, prisma } = makeService();
    (prisma.course.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.update('course-other', ADMIN, { name: 'Nuevo' })).rejects.toThrow(NotFoundException);
    expect(prisma.course.delete).not.toHaveBeenCalled();
  });

  it('returns 404 for a subject PATCH target from another organization', async () => {
    const { service, prisma } = makeService();
    (prisma.subject.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.updateSubject('subject-other', ADMIN, { title: 'Nuevo' })).rejects.toThrow(NotFoundException);
    expect(prisma.subject.delete).not.toHaveBeenCalled();
  });
});
