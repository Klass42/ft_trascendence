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

function makeService(notifications?: unknown) {
  const prisma = {
    course: { findFirst: jest.fn(), delete: jest.fn() },
    subject: { findFirst: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
    forumThread: { findMany: jest.fn() },
    courseMembership: { findFirst: jest.fn() },
    attempt: { findFirst: jest.fn() },
    submission: { findFirst: jest.fn() },
  } as unknown as PrismaService;
  return { service: new CoursesService(prisma, {} as never, notifications as never), prisma };
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

  it('deletes an empty subject even if its cohort has enrollments (#105)', async () => {
    const { service, prisma } = makeService();
    (prisma.subject.findFirst as jest.Mock).mockResolvedValue({
      id: 'subject-1', organizationId: ORG_ID, courseId: 'course-1', course: { organizationId: ORG_ID },
    });
    (prisma.courseMembership.findFirst as jest.Mock).mockResolvedValue({ id: 'membership-1' });
    (prisma.attempt.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.submission.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.deleteSubject('subject-1', ADMIN)).resolves.toBeUndefined();
    expect(prisma.subject.delete).toHaveBeenCalledWith({ where: { id: 'subject-1' } });
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

  describe('notifications that link to deleted entities', () => {
    const notifications = () => ({ emitMany: jest.fn(), removeByLink: jest.fn() });

    it('removes the subject, activity, grade and forum thread links when a subject is deleted', async () => {
      const notify = notifications();
      const { service, prisma } = makeService(notify);
      jest.spyOn(service as any, 'subjectRecipients').mockResolvedValue([]);
      (prisma.subject.findFirst as jest.Mock).mockResolvedValue({
        id: 'subject-1', organizationId: ORG_ID, courseId: 'course-1', status: 'PUBLISHED', title: 'Web', course: { organizationId: ORG_ID },
      });
      (prisma.courseMembership.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.attempt.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.submission.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.forumThread.findMany as jest.Mock).mockResolvedValue([{ id: 'thread-1' }]);

      await service.deleteSubject('subject-1', ADMIN);

      expect(prisma.forumThread.findMany).toHaveBeenCalledWith({
        where: { subjectId: { in: ['subject-1'] }, subject: { organizationId: ORG_ID } },
        select: { id: true },
      });
      expect(notify.removeByLink).toHaveBeenCalledWith(ORG_ID, {
        equals: ['/courses/course-1/subjects/subject-1', '/forums/thread-1'],
        startsWith: [
          '/courses/course-1/subjects/subject-1/',
          '/activities?subjectId=subject-1&',
          '/grades?subjectId=subject-1&',
        ],
      });
      // The cleanup runs after the row is gone and before the "deleted" notice is sent.
      expect((prisma.subject.delete as jest.Mock).mock.invocationCallOrder[0])
        .toBeLessThan(notify.removeByLink.mock.invocationCallOrder[0]);
      expect(notify.removeByLink.mock.invocationCallOrder[0])
        .toBeLessThan(notify.emitMany.mock.invocationCallOrder[0]);
    });

    it('also removes the links of every subject when a cohort is deleted', async () => {
      const notify = notifications();
      const { service, prisma } = makeService(notify);
      jest.spyOn(service as any, 'courseRecipients').mockResolvedValue([]);
      jest.spyOn(service as any, 'requireCourse').mockResolvedValue({ id: 'course-1', name: 'Cohorte' });
      (prisma.course.findFirst as jest.Mock).mockResolvedValue({ id: 'course-1', _count: { memberships: 0 } });
      (prisma.attempt.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.submission.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.subject.findMany as jest.Mock).mockResolvedValue([{ id: 'subject-1', courseId: 'course-1' }]);
      (prisma.forumThread.findMany as jest.Mock).mockResolvedValue([]);

      await service.delete('course-1', ADMIN);

      expect(prisma.subject.findMany).toHaveBeenCalledWith({
        where: { courseId: 'course-1', organizationId: ORG_ID },
        select: { id: true, courseId: true },
      });
      expect(notify.removeByLink).toHaveBeenCalledWith(ORG_ID, {
        equals: ['/courses/course-1', '/courses/course-1/subjects/subject-1'],
        startsWith: [
          '/courses/course-1/',
          '/courses/course-1/subjects/subject-1/',
          '/activities?subjectId=subject-1&',
          '/grades?subjectId=subject-1&',
        ],
      });
    });
  });
});
