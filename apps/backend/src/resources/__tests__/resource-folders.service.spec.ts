import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ResourceFoldersService, collectDescendants } from '../resource-folders.service';
import { ResourcesService } from '../resources.service';
import type { AuthUser } from '@/common/auth';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG = 'org-1';
const TEACHER: AuthUser = {
  userId: 'teacher-1', email: 't@example.test', name: 'T', avatarUrl: null,
  organizationId: ORG, role: 'TEACHER', emailNotificationsEnabled: true, preferredLanguage: 'es',
};
const OTHER: AuthUser = { ...TEACHER, userId: 'teacher-2' };
const ADMIN: AuthUser = { ...TEACHER, userId: 'admin-1', role: 'ADMIN' };
const STUDENT: AuthUser = { ...TEACHER, userId: 'student-1', role: 'STUDENT' };

function makePrisma(overrides: Record<string, unknown> = {}) {
  const prisma: Record<string, any> = {
    resourceFolder: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(async ({ data }) => ({ id: 'new', ...data })),
      update: jest.fn(async ({ data }) => data),
      updateMany: jest.fn().mockReturnValue('folder.updateMany'),
      delete: jest.fn().mockReturnValue('folder.delete'),
      deleteMany: jest.fn().mockReturnValue('folder.deleteMany'),
    },
    learningResource: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockReturnValue('resource.updateMany'),
      deleteMany: jest.fn().mockReturnValue('resource.deleteMany'),
    },
    subjectFolder: { upsert: jest.fn(async ({ create }) => create), deleteMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    subjectResource: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
    ...overrides,
  };
  return prisma;
}

const access = { assertSubjectStaff: jest.fn(), assertSubjectReadable: jest.fn().mockResolvedValue({ isStaff: false }) };

describe('collectDescendants', () => {
  it('returns the root and every nested subfolder', () => {
    const tree = [
      { id: 'a', parentId: null }, { id: 'b', parentId: 'a' }, { id: 'c', parentId: 'b' }, { id: 'd', parentId: null },
    ];
    expect([...collectDescendants(['a'], tree)].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('ResourceFoldersService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects students', async () => {
    const service = new ResourceFoldersService(makePrisma() as unknown as PrismaService, access as never);
    await expect(service.findAll(STUDENT)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a folder under an existing parent', async () => {
    const prisma = makePrisma();
    prisma.resourceFolder.findFirst.mockResolvedValue({ id: 'parent', createdById: TEACHER.userId });
    const service = new ResourceFoldersService(prisma as unknown as PrismaService, access as never);
    await service.create({ name: '  Exámenes ', parentId: 'parent' }, TEACHER);
    expect(prisma.resourceFolder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Exámenes', parentId: 'parent', organizationId: ORG, createdById: TEACHER.userId }),
    }));
  });

  it('refuses to move a folder inside its own subtree', async () => {
    const prisma = makePrisma();
    prisma.resourceFolder.findFirst.mockResolvedValue({ id: 'x', createdById: TEACHER.userId });
    prisma.resourceFolder.findMany.mockResolvedValue([{ id: 'a', parentId: null }, { id: 'b', parentId: 'a' }]);
    const service = new ResourceFoldersService(prisma as unknown as PrismaService, access as never);
    await expect(service.update('a', { parentId: 'b' }, TEACHER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deleting a folder moves its contents to the root and deletes only the folder', async () => {
    const prisma = makePrisma();
    prisma.resourceFolder.findFirst.mockResolvedValue({ id: 'f1', createdById: TEACHER.userId });
    const service = new ResourceFoldersService(prisma as unknown as PrismaService, access as never);
    await service.remove('f1', TEACHER);
    expect(prisma.learningResource.updateMany).toHaveBeenCalledWith({ where: { folderId: 'f1' }, data: { folderId: null } });
    expect(prisma.resourceFolder.updateMany).toHaveBeenCalledWith({ where: { parentId: 'f1' }, data: { parentId: null } });
    expect(prisma.resourceFolder.delete).toHaveBeenCalledWith({ where: { id: 'f1' } });
    expect(prisma.learningResource.deleteMany).not.toHaveBeenCalled();
  });

  it('only the owner or an admin can delete a folder', async () => {
    const prisma = makePrisma();
    prisma.resourceFolder.findFirst.mockResolvedValue({ id: 'f1', createdById: TEACHER.userId });
    const service = new ResourceFoldersService(prisma as unknown as PrismaService, access as never);
    await expect(service.remove('f1', OTHER)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove('f1', ADMIN)).resolves.toBeUndefined();
  });

  it('publishing a folder creates a live SubjectFolder link after checking subject staff', async () => {
    const prisma = makePrisma();
    prisma.resourceFolder.findFirst.mockResolvedValue({ id: 'f1', createdById: TEACHER.userId });
    const service = new ResourceFoldersService(prisma as unknown as PrismaService, access as never);
    await service.publishToSubject('f1', { subjectId: 's1' }, TEACHER);
    expect(access.assertSubjectStaff).toHaveBeenCalledWith('s1', TEACHER);
    expect(prisma.subjectFolder.upsert).toHaveBeenCalled();
  });

  describe('batchDelete', () => {
    it('deletes resources and folders in one transaction, releasing folder contents', async () => {
      const prisma = makePrisma();
      prisma.learningResource.findMany.mockResolvedValue([{ id: 'r1', createdById: TEACHER.userId }]);
      prisma.resourceFolder.findMany.mockResolvedValue([{ id: 'f1', createdById: TEACHER.userId }]);
      const service = new ResourceFoldersService(prisma as unknown as PrismaService, access as never);
      await expect(service.batchDelete({ resourceIds: ['r1'], folderIds: ['f1'] }, TEACHER))
        .resolves.toEqual({ deletedResources: 1, deletedFolders: 1 });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.learningResource.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['r1'] } } });
      expect(prisma.learningResource.updateMany).toHaveBeenCalledWith({ where: { folderId: { in: ['f1'] } }, data: { folderId: null } });
      expect(prisma.resourceFolder.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['f1'] } } });
    });

    it('rejects the whole batch with the offending ids when one item belongs to someone else', async () => {
      const prisma = makePrisma();
      prisma.learningResource.findMany.mockResolvedValue([
        { id: 'r1', createdById: TEACHER.userId }, { id: 'r2', createdById: 'someone' },
      ]);
      const service = new ResourceFoldersService(prisma as unknown as PrismaService, access as never);
      const err = await service.batchDelete({ resourceIds: ['r1', 'r2'] }, TEACHER).catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(err.getResponse()).toMatchObject({ ids: ['r2'] });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('reports ids missing from the organization', async () => {
      const service = new ResourceFoldersService(makePrisma() as unknown as PrismaService, access as never);
      await expect(service.batchDelete({ resourceIds: ['ghost'] }, ADMIN)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('requires at least one id', async () => {
      const service = new ResourceFoldersService(makePrisma() as unknown as PrismaService, access as never);
      await expect(service.batchDelete({}, ADMIN)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

describe('ResourcesService live folder publication', () => {
  it('lists resources from a published folder and its subfolders, including future ones', async () => {
    const prisma = makePrisma();
    prisma.subjectResource.findMany.mockResolvedValue([{ resourceId: 'direct', subjectId: 's1', order: 0, required: false, resource: {} }]);
    prisma.subjectFolder.findMany.mockResolvedValue([{ folderId: 'f1', required: true }]);
    prisma.resourceFolder.findMany.mockResolvedValue([{ id: 'f1', parentId: null }, { id: 'f2', parentId: 'f1' }, { id: 'x', parentId: null }]);
    prisma.learningResource.findMany.mockResolvedValue([{ id: 'r-new', folderId: 'f2' }]);
    const service = new ResourcesService(prisma as unknown as PrismaService, access as never);
    const rows = await service.findForSubject('s1', {}, STUDENT);
    const where = prisma.learningResource.findMany.mock.calls[0][0].where;
    expect(where.folderId.in.sort()).toEqual(['f1', 'f2']);
    expect(where.id.notIn).toEqual(['direct']);
    expect(where.status).toBe('PUBLISHED');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ resourceId: 'r-new', required: true, viaFolderId: 'f1' });
  });

  it('lets an enrolled learner open a file reached only through a published ancestor folder', async () => {
    const prisma = makePrisma({
      subjectStaff: { findMany: jest.fn().mockResolvedValue([]) },
      courseMembership: { findMany: jest.fn().mockResolvedValue([{ courseId: 'c1' }]) },
    });
    prisma.learningResource.findMany.mockResolvedValue([{ createdById: 't', status: 'PUBLISHED', folderId: 'f2', subjects: [] }]);
    prisma.resourceFolder.findMany.mockResolvedValue([{ id: 'f1', parentId: null }, { id: 'f2', parentId: 'f1' }]);
    prisma.subjectFolder.findMany.mockResolvedValue([{ folderId: 'f1', subjectId: 's1', subject: { courseId: 'c1', status: 'PUBLISHED' } }]);
    const service = new ResourcesService(prisma as unknown as PrismaService, access as never);
    await expect(service.canAccessFile('file-1', STUDENT)).resolves.toBe(true);
  });
});
