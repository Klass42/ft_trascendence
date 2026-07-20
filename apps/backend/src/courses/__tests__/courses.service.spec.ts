import { NotFoundException } from '@nestjs/common';
import { CoursesService } from '../courses.service';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG_ID = 'org-klass-0001';
const OTHER_ORG = 'org-other-0001';
const COURSE_ID = 'course-web-101';
const COURSE_ID_2 = 'course-web-102';

function buildFake() {
  const courses: Record<string, any> = {
    [COURSE_ID]: {
      id: COURSE_ID, organizationId: ORG_ID, ownerId: null,
      title: 'Introducción al Desarrollo Web', description: 'Curso inicial',
      category: 'web', imageUrl: null, accessCode: 'WEB101',
      status: 'PUBLISHED', createdAt: new Date(), updatedAt: new Date(),
    },
    [COURSE_ID_2]: {
      id: COURSE_ID_2, organizationId: ORG_ID, ownerId: null,
      title: 'Diseño de Interfaces', description: null,
      category: 'design', imageUrl: null, accessCode: null,
      status: 'DRAFT', createdAt: new Date(), updatedAt: new Date(),
    },
  };

  const prisma = {
    course: {
      create: async ({ data }: any) => {
        const course = { ...data, id: `course-${Date.now()}`, createdAt: new Date(), updatedAt: new Date() };
        courses[course.id] = course;
        return course;
      },
      findMany: async ({ where }: any) => {
        let result = Object.values(courses);
        if (where?.organizationId) result = result.filter((c: any) => c.organizationId === where.organizationId);
        if (where?.status) {
          const statusVal = typeof where.status === 'object' ? where.status.equals : where.status;
          result = result.filter((c: any) => c.status === statusVal);
        }
        if (where?.title?.contains) {
          result = result.filter((c: any) =>
            c.title.toLowerCase().includes(where.title.contains.toLowerCase()),
          );
        }
        return result.sort((a: any, b: any) => b.createdAt - a.createdAt);
      },
      findUnique: async ({ where }: any) => courses[where.id] ?? null,
      update: async ({ where, data }: any) => {
        if (!courses[where.id]) throw new NotFoundException();
        Object.assign(courses[where.id], data);
        return courses[where.id];
      },
      delete: async ({ where }: any) => {
        if (!courses[where.id]) throw new NotFoundException();
        const c = courses[where.id];
        delete courses[where.id];
        return c;
      },
    },
  } as unknown as PrismaService;

  return { prisma, courses };
}

function buildService(prisma: PrismaService) {
  return new CoursesService(prisma);
}

describe('CoursesService', () => {
  describe('create', () => {
    it('creates a course with minimal fields', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.create({ title: 'Nuevo curso' }, ORG_ID);

      expect(result.id).toBeTruthy();
      expect(result.title).toBe('Nuevo curso');
      expect(result.organizationId).toBe(ORG_ID);
      expect(result.status).toBeUndefined();
    });

    it('creates a course with all optional fields', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.create({
        title: 'Curso completo',
        description: 'Descripción completa',
        category: 'backend',
        imageUrl: 'https://example.com/img.png',
        accessCode: 'SECRET',
        status: 'DRAFT',
      }, ORG_ID);

      expect(result.title).toBe('Curso completo');
      expect(result.description).toBe('Descripción completa');
      expect(result.category).toBe('backend');
      expect(result.imageUrl).toBe('https://example.com/img.png');
      expect(result.accessCode).toBe('SECRET');
      expect(result.status).toBe('DRAFT');
    });

    it('stores the organizationId on the course', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.create({ title: 'Org scoped' }, ORG_ID);
      expect(result.organizationId).toBe(ORG_ID);
    });
  });

  describe('findAll', () => {
    it('returns all courses for an org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.findAll(ORG_ID);

      expect(result).toHaveLength(2);
      expect(result.map((c: any) => c.id)).toContain(COURSE_ID);
      expect(result.map((c: any) => c.id)).toContain(COURSE_ID_2);
    });

    it('filters by status', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const published = await service.findAll(ORG_ID, 'PUBLISHED');
      expect(published).toHaveLength(1);
      expect(published[0].id).toBe(COURSE_ID);

      const drafts = await service.findAll(ORG_ID, 'DRAFT');
      expect(drafts).toHaveLength(1);
      expect(drafts[0].id).toBe(COURSE_ID_2);
    });

    it('filters by search (case-insensitive)', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.findAll(ORG_ID, undefined, 'Desarrollo');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(COURSE_ID);
    });

    it('returns empty array for different org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.findAll(OTHER_ORG);
      expect(result).toHaveLength(0);
    });

    it('returns empty array when status matches nothing', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.findAll(ORG_ID, 'ARCHIVED');
      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('returns a course by id within the org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.findOne(COURSE_ID, ORG_ID);
      expect(result.id).toBe(COURSE_ID);
      expect(result.title).toBe('Introducción al Desarrollo Web');
    });

    it('throws NotFoundException when course does not exist', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(service.findOne('ghost', ORG_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when course belongs to another org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(service.findOne(COURSE_ID, OTHER_ORG)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates the course title', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.update(COURSE_ID, ORG_ID, { title: 'Título nuevo' });
      expect(result.title).toBe('Título nuevo');
    });

    it('updates description', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.update(COURSE_ID, ORG_ID, { description: 'Nueva descripción' });
      expect(result.description).toBe('Nueva descripción');
    });

    it('updates status', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.update(COURSE_ID, ORG_ID, { status: 'ARCHIVED' });
      expect(result.status).toBe('ARCHIVED');
    });

    it('updates accessCode', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.update(COURSE_ID, ORG_ID, { accessCode: 'NEWCODE' });
      expect(result.accessCode).toBe('NEWCODE');
    });

    it('persists update across findOne', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await service.update(COURSE_ID, ORG_ID, { title: 'Persistido' });
      const result = await service.findOne(COURSE_ID, ORG_ID);
      expect(result.title).toBe('Persistido');
    });

    it('throws NotFoundException when course does not exist', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(service.update('ghost', ORG_ID, { title: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when course belongs to another org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(service.update(COURSE_ID, OTHER_ORG, { title: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes an existing course', async () => {
      const { prisma, courses } = buildFake();
      const service = buildService(prisma);

      await service.delete(COURSE_ID, ORG_ID);
      expect(courses[COURSE_ID]).toBeUndefined();
    });

    it('removes course from findAll after delete', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await service.delete(COURSE_ID, ORG_ID);
      const result = await service.findAll(ORG_ID);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(COURSE_ID_2);
    });

    it('throws NotFoundException when course does not exist', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(service.delete('ghost', ORG_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when course belongs to another org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(service.delete(COURSE_ID, OTHER_ORG)).rejects.toThrow(NotFoundException);
    });
  });
});
