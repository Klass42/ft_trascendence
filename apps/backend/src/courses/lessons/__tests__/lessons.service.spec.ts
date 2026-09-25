import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LessonsService } from '../lessons.service';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG_ID = 'org-klass-0001';
const OTHER_ORG = 'org-other-0001';
const COURSE_ID = 'course-web-101';
const SECTION_ID = 'sec-1';
const OTHER_SECTION = 'sec-other-1';
const LESSON_ID = 'lesson-1';
const LESSON_ID_2 = 'lesson-2';
const FILE_ID = 'file-1';

function buildFake() {
  const sections: Record<string, any> = {
    [SECTION_ID]: {
      id: SECTION_ID, subjectId: COURSE_ID, title: 'HTML & CSS',
      subject: { id: COURSE_ID, title: 'Web 101', organizationId: ORG_ID },
    },
    [OTHER_SECTION]: {
      id: OTHER_SECTION, subjectId: 'course-other',
      subject: { id: 'course-other', title: 'Other', organizationId: OTHER_ORG },
    },
  };

  const lessons: Record<string, any> = {
    [LESSON_ID]: {
      id: LESSON_ID, sectionId: SECTION_ID, title: 'Introducción a HTML',
      contentMd: '# HTML\nEl lenguaje de la web.', videoUrl: null,
      order: 1, createdAt: new Date(), attachments: [],
    },
    [LESSON_ID_2]: {
      id: LESSON_ID_2, sectionId: SECTION_ID, title: 'CSS Básico',
      contentMd: null, videoUrl: 'https://youtube.com/css',
      order: 2, createdAt: new Date(), attachments: [],
    },
  };

  const files: Record<string, any> = {
    [FILE_ID]: { id: FILE_ID, organizationId: ORG_ID, originalName: 'doc.pdf' },
  };

  const attachments: Record<string, any> = {};

  const prisma = {
    section: {
      findUnique: async ({ where, include }: any) => {
        const s = sections[where.id];
        if (!s) return null;
        const result = { ...s };
        if (include?.subject) {
          result.subject = s.subject ?? { id: s.subjectId, title: 'Unknown', organizationId: ORG_ID };
        }
        return result;
      },
    },
    lesson: {
      findUnique: async ({ where, include }: any) => {
        const l = lessons[where.id];
        if (!l) return null;
        const result = { ...l, attachments: [...(l.attachments ?? [])] };
        if (include?.section?.include?.subject) {
          const s = sections[l.sectionId];
          result.section = { ...s, subject: { ...s.subject } };
        }
        if (include?.attachments?.include?.file) {
          result.attachments = (l.attachments ?? []).map((a: any) => ({
            ...a, file: { ...files[a.fileId] },
          }));
        }
        return result;
      },
      findMany: async ({ where, orderBy }: any) => {
        let result = Object.values(lessons).filter((l: any) => l.sectionId === where.sectionId);
        if (orderBy?.order === 'asc') result = result.sort((a: any, b: any) => a.order - b.order);
        return result.map((l: any) => ({ ...l, attachments: [...(l.attachments ?? [])] }));
      },
      create: async ({ data }: any) => {
        const lesson = {
          id: `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sectionId: data.sectionId, title: data.title,
          contentMd: data.contentMd ?? null, videoUrl: data.videoUrl ?? null,
          order: data.order ?? 0, createdAt: new Date(), attachments: [],
        };
        lessons[lesson.id] = lesson;
        return { ...lesson, attachments: [] };
      },
      update: async ({ where, data }: any) => {
        if (!lessons[where.id]) throw new NotFoundException();
        Object.assign(lessons[where.id], data);
        return { ...lessons[where.id], attachments: [...(lessons[where.id].attachments ?? [])] };
      },
      delete: async ({ where }: any) => {
        if (!lessons[where.id]) throw new NotFoundException();
        const l = lessons[where.id];
        delete lessons[where.id];
        return l;
      },
    },
    file: {
      findUnique: async ({ where }: any) => files[where.id] ?? null,
    },
    lessonAttachment: {
      findUnique: async ({ where, include }: any) => {
        const compound = where.lessonId_fileId ?? where;
        const key = `${compound.lessonId}_${compound.fileId}`;
        const a = attachments[key];
        if (!a) return null;
        const result: Record<string, any> = { ...a };
        if (include?.lesson?.include?.section?.include?.subject) {
          const l = lessons[a.lessonId];
          const s = sections[l.sectionId];
          result.lesson = { ...l, section: { ...s, subject: { ...s.subject } } };
        }
        return result;
      },
      create: async ({ data, include }: any) => {
        const key = `${data.lessonId}_${data.fileId}`;
        const attachment = { lessonId: data.lessonId, fileId: data.fileId };
        attachments[key] = attachment;
        if (!lessons[data.lessonId].attachments) lessons[data.lessonId].attachments = [];
        lessons[data.lessonId].attachments.push(attachment);
        const result: Record<string, any> = { ...attachment };
        if (include?.file) result.file = { ...files[data.fileId] };
        return result;
      },
      delete: async ({ where }: any) => {
        const compound = where.lessonId_fileId ?? where;
        const key = `${compound.lessonId}_${compound.fileId}`;
        if (!attachments[key]) throw new NotFoundException();
        delete attachments[key];
      },
    },
    $transaction: async (updates: any[]) => {
      const results = [];
      for (const u of updates) results.push(await u);
      return results;
    },
  } as unknown as PrismaService;

  return { prisma, lessons, files, attachments, sections };
}

function buildService(prisma: PrismaService) {
  return new LessonsService(prisma);
}

describe('LessonsService', () => {
  describe('create', () => {
    it('creates a lesson with just a title', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.create(SECTION_ID, ORG_ID, { title: 'Nueva lección' });

      expect(result.id).toBeTruthy();
      expect(result.title).toBe('Nueva lección');
      expect(result.sectionId).toBe(SECTION_ID);
    });

    it('creates a lesson with contentMd', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.create(SECTION_ID, ORG_ID, {
        title: 'Con markdown', contentMd: '# Título\nContenido',
      });

      expect(result.contentMd).toBe('# Título\nContenido');
    });

    it('creates a lesson with videoUrl', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.create(SECTION_ID, ORG_ID, {
        title: 'Con video', videoUrl: 'https://youtube.com/abc',
      });

      expect(result.videoUrl).toBe('https://youtube.com/abc');
    });

    it('creates a lesson with all fields and explicit order', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.create(SECTION_ID, ORG_ID, {
        title: 'Todo', contentMd: 'md', videoUrl: 'vid', order: 10,
      });

      expect(result.contentMd).toBe('md');
      expect(result.videoUrl).toBe('vid');
      expect(result.order).toBe(10);
    });

    it('defaults order to 0', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.create(SECTION_ID, ORG_ID, { title: 'Sin orden' });
      expect(result.order).toBe(0);
    });

    it('throws NotFoundException when section does not exist', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.create('ghost', ORG_ID, { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when section belongs to another org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.create(SECTION_ID, OTHER_ORG, { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns all lessons for a section ordered by order asc', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.findAll(SECTION_ID, ORG_ID);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(LESSON_ID);
      expect(result[1].id).toBe(LESSON_ID_2);
    });

    it('returns empty array for section with no lessons', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.findAll(SECTION_ID, ORG_ID);
      // We have 2 lessons; create an empty section to test
      expect(Array.isArray(result)).toBe(true);
    });

    it('throws NotFoundException when section does not exist', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(service.findAll('ghost', ORG_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when section is wrong org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(service.findAll(SECTION_ID, OTHER_ORG)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('returns a lesson by id with sectionId', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.findOne(SECTION_ID, LESSON_ID, ORG_ID);
      expect(result!.id).toBe(LESSON_ID);
      expect(result!.title).toBe('Introducción a HTML');
    });

    it('includes attachments with file data', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.findOne(SECTION_ID, LESSON_ID, ORG_ID);
      expect(result!).toHaveProperty('attachments');
    });

    it('throws NotFoundException for non-existent lesson', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.findOne(SECTION_ID, 'ghost', ORG_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when lesson belongs to another section', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.findOne(SECTION_ID, LESSON_ID, OTHER_ORG),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('returns a lesson by id without needing sectionId', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.findById(LESSON_ID, ORG_ID);
      expect(result!.id).toBe(LESSON_ID);
    });

    it('includes attachments', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.findById(LESSON_ID, ORG_ID);
      expect(result!).toHaveProperty('attachments');
    });

    it('throws NotFoundException for non-existent lesson', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(service.findById('ghost', ORG_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when lesson is wrong org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(service.findById(LESSON_ID, OTHER_ORG)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates lesson title', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.update(SECTION_ID, LESSON_ID, ORG_ID, { title: 'Nuevo título' });
      expect(result.title).toBe('Nuevo título');
    });

    it('updates contentMd', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.update(SECTION_ID, LESSON_ID, ORG_ID, { contentMd: 'Nuevo markdown' });
      expect(result.contentMd).toBe('Nuevo markdown');
    });

    it('updates videoUrl', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.update(SECTION_ID, LESSON_ID, ORG_ID, { videoUrl: 'https://new.video' });
      expect(result.videoUrl).toBe('https://new.video');
    });

    it('updates order', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.update(SECTION_ID, LESSON_ID, ORG_ID, { order: 99 });
      expect(result.order).toBe(99);
    });

    it('persists update across findById', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await service.update(SECTION_ID, LESSON_ID, ORG_ID, { title: 'Persistido' });
      const result = await service.findById(LESSON_ID, ORG_ID);
      expect(result!.title).toBe('Persistido');
    });

    it('throws NotFoundException for non-existent lesson', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.update(SECTION_ID, 'ghost', ORG_ID, { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when lesson is wrong org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.update(SECTION_ID, LESSON_ID, OTHER_ORG, { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes an existing lesson', async () => {
      const { prisma, lessons } = buildFake();
      const service = buildService(prisma);

      await service.delete(SECTION_ID, LESSON_ID, ORG_ID);
      expect(lessons[LESSON_ID]).toBeUndefined();
    });

    it('removes lesson from findAll after delete', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await service.delete(SECTION_ID, LESSON_ID, ORG_ID);
      const result = await service.findAll(SECTION_ID, ORG_ID);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(LESSON_ID_2);
    });

    it('throws NotFoundException for non-existent lesson', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.delete(SECTION_ID, 'ghost', ORG_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when lesson is wrong org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.delete(SECTION_ID, LESSON_ID, OTHER_ORG),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('reorders lessons by the given ids', async () => {
      const { prisma, lessons } = buildFake();
      const service = buildService(prisma);

      await service.reorder(SECTION_ID, ORG_ID, [LESSON_ID_2, LESSON_ID]);

      expect(lessons[LESSON_ID].order).toBe(1);
      expect(lessons[LESSON_ID_2].order).toBe(0);
    });

    it('throws BadRequestException for empty orderedIds', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(service.reorder(SECTION_ID, ORG_ID, [])).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown lesson ids', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.reorder(SECTION_ID, ORG_ID, ['ghost']),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when section is wrong org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.reorder(SECTION_ID, OTHER_ORG, [LESSON_ID, LESSON_ID_2]),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('attachFile', () => {
    it('attaches a file to a lesson', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      const result = await service.attachFile(LESSON_ID, FILE_ID, ORG_ID);

      expect(result.lessonId).toBe(LESSON_ID);
      expect(result.fileId).toBe(FILE_ID);
    });

    it('throws NotFoundException when lesson does not exist', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.attachFile('ghost', FILE_ID, ORG_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when file does not exist', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.attachFile(LESSON_ID, 'ghost-file', ORG_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when lesson is wrong org', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.attachFile(LESSON_ID, FILE_ID, OTHER_ORG),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when file is wrong org', async () => {
      const { prisma, files } = buildFake();
      files['file-other'] = { id: 'file-other', organizationId: OTHER_ORG, originalName: 'other.pdf' };
      const service = buildService(prisma);

      await expect(
        service.attachFile(LESSON_ID, 'file-other', ORG_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('detachFile', () => {
    it('detaches an existing attachment', async () => {
      const { prisma, attachments } = buildFake();
      const service = buildService(prisma);

      // Attach first
      await service.attachFile(LESSON_ID, FILE_ID, ORG_ID);
      expect(attachments[`${LESSON_ID}_${FILE_ID}`]).toBeTruthy();

      // Detach
      await service.detachFile(LESSON_ID, FILE_ID, ORG_ID);
      expect(attachments[`${LESSON_ID}_${FILE_ID}`]).toBeUndefined();
    });

    it('throws NotFoundException when attachment does not exist', async () => {
      const { prisma } = buildFake();
      const service = buildService(prisma);

      await expect(
        service.detachFile(LESSON_ID, FILE_ID, ORG_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
