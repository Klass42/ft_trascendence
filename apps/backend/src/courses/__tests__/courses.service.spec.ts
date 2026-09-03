import { CoursesService } from '../courses.service';
import { CourseAccessService } from '../course-access.service';
import type { AuthUser } from '@/common/auth';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG_ID = 'org-klass-0001';
const TEACHER: AuthUser = {
  userId: 'teacher-1', email: 'teacher@example.test', name: 'Teacher',
  avatarUrl: null, organizationId: ORG_ID, role: 'TEACHER',
  emailNotificationsEnabled: true, preferredLanguage: 'es',
};

function buildFake() {
  const courses: Record<string, any> = {};
  const enrollments: any[] = [];
  const course = {
    create: jest.fn(async ({ data }: any) => {
      const result = { id: `course-${Object.keys(courses).length + 1}`, ...data };
      courses[result.id] = result;
      return result;
    }),
    findMany: jest.fn(async () => Object.values(courses)),
    findFirst: jest.fn(),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    delete: jest.fn(async ({ where }: any) => delete courses[where.id]),
  };
  const enrollment = {
    create: jest.fn(async ({ data }: any) => {
      enrollments.push(data);
      return data;
    }),
  };
  const transaction = jest.fn(async (callback: any) => callback({ course, enrollment }));
  const prisma = {
    course,
    enrollment,
    $transaction: transaction,
  } as unknown as PrismaService;
  const access = {
    assertReadable: jest.fn(),
    assertStaff: jest.fn(),
  } as unknown as CourseAccessService;

  return { prisma, access, enrollments, course, transaction };
}

describe('CoursesService', () => {
  it('creates a course atomically with its creator as owner and course teacher', async () => {
    const { prisma, access, enrollments, transaction } = buildFake();
    const service = new CoursesService(prisma, access);

    const result = await service.create({ title: 'New course' }, TEACHER);

    expect(result).toMatchObject({ organizationId: ORG_ID, ownerId: TEACHER.userId });
    expect(enrollments).toEqual([
      { courseId: result.id, userId: TEACHER.userId, role: 'TEACHER' },
    ]);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('limits non-admin course listings to published courses and courses where they are staff', async () => {
    const { prisma, access, course } = buildFake();
    const service = new CoursesService(prisma, access);

    await service.findAll(TEACHER, 'PUBLISHED', 'web');

    expect(course.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: ORG_ID,
        OR: expect.arrayContaining([
          { status: 'PUBLISHED' },
          { ownerId: TEACHER.userId },
        ]),
      }),
    }));
    expect(access.assertReadable).not.toHaveBeenCalled();
  });

  it('lets an admin list every course in their organization', async () => {
    const { prisma, access, course } = buildFake();
    const service = new CoursesService(prisma, access);
    const admin = { ...TEACHER, role: 'ADMIN' as const };

    await service.findAll(admin);

    expect(course.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.not.objectContaining({ OR: expect.anything() }),
    }));
  });

  it('uses course membership authorization before returning course details', async () => {
    const { prisma, access } = buildFake();
    const service = new CoursesService(prisma, access);

    await service.findOne('course-1', TEACHER);

    expect(access.assertReadable).toHaveBeenCalledWith('course-1', TEACHER);
  });

  it('exposes only published same-organization metadata in a course preview', async () => {
    const { prisma, access, course } = buildFake();
    const preview = {
      id: 'course-1',
      title: 'Spanish B1',
      description: 'Conversational Spanish',
      category: 'Languages',
      imageUrl: 'https://example.test/b1.png',
      status: 'PUBLISHED',
    };
    course.findFirst.mockResolvedValue(preview);
    const service = new CoursesService(prisma, access);

    await expect(service.preview('course-1', TEACHER)).resolves.toEqual(preview);

    expect(course.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'course-1',
        organizationId: ORG_ID,
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        imageUrl: true,
        status: true,
      },
    });
  });

  it('does not preview missing, draft, or foreign-organization courses', async () => {
    const { prisma, access, course } = buildFake();
    course.findFirst.mockResolvedValue(null);
    const service = new CoursesService(prisma, access);

    await expect(service.preview('course-1', TEACHER)).rejects.toThrow('Course course-1 not found');
  });

  it.each(['update', 'delete'] as const)('requires course staff access to %s a course', async (operation) => {
    const { prisma, access } = buildFake();
    const service = new CoursesService(prisma, access);

    if (operation === 'update') {
      await service.update('course-1', TEACHER, { title: 'Renamed' });
    } else {
      await service.delete('course-1', TEACHER);
    }

    expect(access.assertStaff).toHaveBeenCalledWith('course-1', TEACHER);
  });
});
