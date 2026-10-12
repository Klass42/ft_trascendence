import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SectionsService } from '../sections.service';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG_ID = 'org-klass-0001';
const OTHER_ORG = 'org-other-0001';
const COURSE_ID = 'course-web-101';
const OTHER_COURSE = 'course-other-001';
const SECTION_ID = 'sec-1';
const SECTION_ID_2 = 'sec-2';

function buildFake() {
  const courses: Record<string, any> = {
    [COURSE_ID]: { id: COURSE_ID, organizationId: ORG_ID, title: 'Web 101' },
    [OTHER_COURSE]: { id: OTHER_COURSE, organizationId: OTHER_ORG, title: 'Other' },
  };

  const sections: Record<string, any> = {
    [SECTION_ID]: {
      id: SECTION_ID, subjectId: COURSE_ID, title: 'HTML & CSS', order: 1,
      createdAt: new Date(), lessons: [],
    },
    [SECTION_ID_2]: {
      id: SECTION_ID_2, subjectId: COURSE_ID, title: 'JavaScript', order: 2,
      createdAt: new Date(), lessons: [],
    },
  };

  const prisma = {
    subject: {
      findFirst: async ({ where }: any) => {
        const course = courses[where.id];
        if (!course || course.organizationId !== where.organizationId) return null;
        return course;
      },
    },
    section: {
      findUnique: async ({ where }: any) => {
        const s = sections[where.id];
        return s ? { ...s, lessons: [...(s.lessons ?? [])] } : null;
      },
      findMany: async ({ where }: any) => {
        let result = Object.values(sections).filter((s: any) => s.subjectId === where.subjectId);
        result = result.sort((a: any, b: any) => a.order - b.order);
        return result.map((s: any) => ({ ...s, lessons: [...(s.lessons ?? [])] }));
      },
      create: async ({ data }: any) => {
        const section = {
          id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          subjectId: data.subjectId, title: data.title, order: data.order ?? 0,
          createdAt: new Date(), lessons: [],
        };
        sections[section.id] = section;
        return section;
      },
      update: async ({ where, data }: any) => {
        if (!sections[where.id]) throw new NotFoundException();
        Object.assign(sections[where.id], data);
        return { ...sections[where.id], lessons: [...(sections[where.id].lessons ?? [])] };
      },
      delete: async ({ where }: any) => {
        if (!sections[where.id]) throw new NotFoundException();
        const s = sections[where.id];
        delete sections[where.id];
        return s;
      },
    },
    $transaction: async (updates: any[]) => {
      const results = [];
      for (const u of updates) results.push(await u);
      return results;
    },
  } as unknown as PrismaService;

  return { prisma, sections, courses };
}

function buildService(prisma: PrismaService) {
  return new SectionsService(prisma);
}

describe('SectionsService', () => {
  describe('create', () => {
    it('creates a section with a title', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.create(COURSE_ID, ORG_ID, { title: 'Nueva sección' });

      expect(result.id).toBeTruthy();
      expect(result.title).toBe('Nueva sección');
      expect(result.subjectId).toBe(COURSE_ID);
    });

    it('creates a section with explicit order', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.create(COURSE_ID, ORG_ID, { title: 'Ordenada', order: 5 });
      expect(result.order).toBe(5);
    });

    it('defaults order to 0', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.create(COURSE_ID, ORG_ID, { title: 'Sin orden' });
      expect(result.order).toBe(0);
    });

    it('throws NotFoundException when course does not exist', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.create('ghost', ORG_ID, { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when course belongs to another org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.create(COURSE_ID, OTHER_ORG, { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns all sections for a course ordered by order asc', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.findAll(COURSE_ID, ORG_ID);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(SECTION_ID);
      expect(result[1].id).toBe(SECTION_ID_2);
    });

    it('includes lessons on each section', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.findAll(COURSE_ID, ORG_ID);
      for (const section of result) {
        expect(section).toHaveProperty('lessons');
        expect(Array.isArray(section.lessons)).toBe(true);
      }
    });

    it('throws NotFoundException when course does not exist', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(service.findAll('ghost', ORG_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when course belongs to another org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(service.findAll(COURSE_ID, OTHER_ORG)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('returns a section by id', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.findOne(COURSE_ID, SECTION_ID, ORG_ID);
      expect(result.id).toBe(SECTION_ID);
      expect(result.title).toBe('HTML & CSS');
    });

    it('includes lessons', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.findOne(COURSE_ID, SECTION_ID, ORG_ID);
      expect(result).toHaveProperty('lessons');
    });

    it('throws NotFoundException for non-existent section', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.findOne(COURSE_ID, 'ghost', ORG_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when section belongs to another course', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.findOne(OTHER_COURSE, SECTION_ID, OTHER_ORG),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when course is wrong org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.findOne(COURSE_ID, SECTION_ID, OTHER_ORG),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('renames a section', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.update(COURSE_ID, SECTION_ID, ORG_ID, { title: 'Renombrado' });
      expect(result.title).toBe('Renombrado');
    });

    it('changes section order', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.update(COURSE_ID, SECTION_ID, ORG_ID, { order: 10 });
      expect(result.order).toBe(10);
    });

    it('throws NotFoundException for non-existent section', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.update(COURSE_ID, 'ghost', ORG_ID, { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when course is wrong org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.update(COURSE_ID, SECTION_ID, OTHER_ORG, { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes an existing section', async () => {
      const { prisma, sections } = buildFake();
      const service = buildService(prisma);

      await service.delete(COURSE_ID, SECTION_ID, ORG_ID);
      expect(sections[SECTION_ID]).toBeUndefined();
    });

    it('removes section from findAll after delete', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await service.delete(COURSE_ID, SECTION_ID, ORG_ID);
      const result = await service.findAll(COURSE_ID, ORG_ID);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(SECTION_ID_2);
    });

    it('throws NotFoundException for non-existent section', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.delete(COURSE_ID, 'ghost', ORG_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when course is wrong org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.delete(COURSE_ID, SECTION_ID, OTHER_ORG),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('reorders sections by the given ids', async () => {
      const { prisma, sections } = buildFake();
      const service = buildService(prisma);

      await service.reorder(COURSE_ID, ORG_ID, [SECTION_ID_2, SECTION_ID]);

      expect(sections[SECTION_ID].order).toBe(1);
      expect(sections[SECTION_ID_2].order).toBe(0);
    });

    it('throws BadRequestException for empty orderedIds', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(service.reorder(COURSE_ID, ORG_ID, [])).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown section ids', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.reorder(COURSE_ID, ORG_ID, ['ghost']),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when course is wrong org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.reorder(COURSE_ID, OTHER_ORG, [SECTION_ID, SECTION_ID_2]),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when ids include sections from another course', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.reorder(COURSE_ID, ORG_ID, [SECTION_ID, 'sec-other-1']),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
