import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import type { AuthUser } from '@/common/auth';
import { FilesService } from '../files.service';

const upload = {
  originalname: 'e2e-proof.txt',
  mimetype: 'text/plain',
  size: 12,
  buffer: Buffer.from('proof bytes'),
} as Express.Multer.File;

const baseFile = {
  id: 'file-a',
  organizationId: 'org-a',
  uploaderId: 'user-a',
  bucket: 'local',
  objectKey: 'org-a/file-a',
  originalName: 'informe.pdf',
  contentType: 'application/pdf',
  sizeBytes: 12n,
  lessonAttachments: [],
  assignmentFiles: [],
  submissionFiles: [],
  activityFiles: [],
  learningResources: [],
};

const student: AuthUser = {
  userId: 'user-a',
  organizationId: 'org-a',
  role: 'STUDENT',
} as AuthUser;


const admin: AuthUser = {
  userId: 'user-admin',
  organizationId: 'org-a',
  role: 'ADMIN',
} as AuthUser;

function buildService() {
  const storage = {
    putObject: jest.fn(),
    getObject: jest.fn(async () => Readable.from([Buffer.from('content')])),
    deleteObject: jest.fn(),
  };
  const prisma = {
    organization: { findUnique: jest.fn(async () => null) }, 
    file: {
      create: jest.fn(),
      findFirst: jest.fn(async () => baseFile),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    answer: { findMany: jest.fn(async () => []) },
    user: { findFirst: jest.fn(async () => null) },
  };
  const resources = { canAccessFile: jest.fn(async () => false) };
  const courseAccess = {
    assertSubjectReadable: jest.fn(async () => ({})),
    assertSubjectStaff: jest.fn(async () => ({})),
  };
  const service = new FilesService(
    prisma as never,
    storage as never,
    resources as never,
    courseAccess as never,
  );
  return { service, storage, prisma, resources, courseAccess };
}

describe('FilesService access and orphan safety', () => {
  const previousAccessSecret = process.env.JWT_ACCESS_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'test-file-url-secret';
  });

  afterAll(() => {
    if (previousAccessSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previousAccessSecret;
  });

  it('removes bytes when metadata creation fails after an object upload', async () => {
    const { service, storage, prisma } = buildService();
    storage.putObject.mockResolvedValue({ bucket: 'local', objectKey: 'org-a/file-a' });
    prisma.file.create.mockRejectedValue(new Error('database unavailable'));

    await expect(service.createUpload(upload, 'org-a', 'user-a'))
      .rejects.toThrow('database unavailable');

    expect(storage.deleteObject).toHaveBeenCalledWith('org-a/file-a');
  });

  it('authorizes lesson attachments through course membership or subject staff access', async () => {
    const { service, prisma, courseAccess } = buildService();
    prisma.file.findFirst.mockResolvedValue({
      ...baseFile,
      lessonAttachments: [{ lesson: { section: { subjectId: 'subject-a' } } }],
    } as never);

    await expect(service.assertCanRead('file-a', student)).resolves.toBeDefined();
    expect(courseAccess.assertSubjectReadable).toHaveBeenCalledWith('subject-a', student);
  });

  it('denies a student who is not enrolled in the referenced course', async () => {
    const { service, prisma, courseAccess } = buildService();
    prisma.file.findFirst.mockResolvedValue({
      ...baseFile,
      activityFiles: [{ activity: { subjectId: 'subject-other' } }],
    } as never);
    courseAccess.assertSubjectReadable.mockRejectedValue(new ForbiddenException());

    await expect(service.assertCanRead('file-a', student)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('authorizes prompt attachments for assignments and activities through subject access', async () => {
    const { service, prisma, courseAccess } = buildService();
    prisma.file.findFirst.mockResolvedValue({
      ...baseFile,
      assignmentFiles: [{ assignment: { subjectId: 'subject-assignment' } }],
      activityFiles: [{ activity: { subjectId: 'subject-activity' } }],
    } as never);

    await expect(service.assertCanRead('file-a', student)).resolves.toBeDefined();
    expect(courseAccess.assertSubjectReadable).toHaveBeenCalledWith('subject-assignment', student);
  });

  it('allows a submission author and allows course staff to read another submission', async () => {
    const { service, prisma, courseAccess } = buildService();
    prisma.file.findFirst.mockResolvedValue({
      ...baseFile,
      submissionFiles: [{ submission: { userId: student.userId, assignment: { subjectId: 'subject-a' } } }],
    } as never);
    await expect(service.assertCanRead('file-a', student)).resolves.toBeDefined();
    expect(courseAccess.assertSubjectStaff).not.toHaveBeenCalled();

    prisma.file.findFirst.mockResolvedValue({
      ...baseFile,
      submissionFiles: [{ submission: { userId: 'another-student', assignment: { subjectId: 'subject-a' } } }],
    } as never);
    await expect(service.assertCanRead('file-a', student)).resolves.toBeDefined();
    expect(courseAccess.assertSubjectStaff).toHaveBeenCalledWith('subject-a', student);
  });

  it('authorizes answer fileIds only for the attempt author or course staff', async () => {
    const { service, prisma, courseAccess } = buildService();
    prisma.answer.findMany.mockResolvedValue([{
      attempt: { userId: student.userId, activity: { subjectId: 'subject-a' } },
    }] as never);

    await expect(service.assertCanRead('file-a', student)).resolves.toBeDefined();
    expect(prisma.answer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        response: { path: ['fileIds'], array_contains: ['file-a'] },
        attempt: { activity: { subject: { organizationId: 'org-a' } } },
      }),
    }));
    expect(courseAccess.assertSubjectStaff).not.toHaveBeenCalled();

    prisma.answer.findMany.mockResolvedValue([{
      attempt: { userId: 'another-student', activity: { subjectId: 'subject-a' } },
    }] as never);
    await expect(service.assertCanRead('file-a', student)).resolves.toBeDefined();
    expect(courseAccess.assertSubjectStaff).toHaveBeenCalledWith('subject-a', student);
  });

  it('uses the existing resource-library access rule for linked library files', async () => {
    const { service, prisma, resources } = buildService();
    prisma.file.findFirst.mockResolvedValue({
      ...baseFile,
      learningResources: [{ id: 'resource-a' }],
    } as never);
    resources.canAccessFile.mockResolvedValue(true);

    await expect(service.assertCanRead('file-a', student)).resolves.toBeDefined();
    expect(resources.canAccessFile).toHaveBeenCalledWith('file-a', student);
  });

  it('allows organization members to read an uploader avatar', async () => {
    const { service, prisma } = buildService();
    prisma.user.findFirst.mockResolvedValue({ id: 'user-a' } as never);

    await expect(service.assertCanRead('file-a', { ...student, userId: 'user-b' }))
      .resolves.toBeDefined();
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'user-a',
        organizationId: 'org-a',
        OR: [
          { avatarUrl: { contains: '/files/file-a/content' } },
          { avatarUrl: { contains: '/uploads/org-a/file-a' } },
          { avatarUrl: { contains: '/local/org-a/file-a' } },
        ],
      },
      select: { id: true },
    });
  });

  it('refreshes legacy avatar URLs only after resolving an organization-scoped file', async () => {
    const { service, prisma } = buildService();

    const result = await service.getSignedUrlByObjectKey('org-a/file-a', student);

    expect(result.url).toMatch(/^\/api\/files\/file-a\/content\?/);
    expect(prisma.file.findFirst).toHaveBeenNthCalledWith(1, {
      where: { objectKey: 'org-a/file-a', organizationId: 'org-a' },
      select: { id: true },
    });
    expect(prisma.file.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { id: 'file-a', organizationId: 'org-a' },
    }));
  });

  it('allows the uploader to read an unlinked file', async () => {
    const { service } = buildService();
    await expect(service.assertCanRead('file-a', student)).resolves.toBeDefined();
  });

  it('does not let an uploader bypass access on a linked file', async () => {
    const { service, prisma, courseAccess } = buildService();
    prisma.file.findFirst.mockResolvedValue({
      ...baseFile,
      lessonAttachments: [{ lesson: { section: { subjectId: 'subject-other' } } }],
    } as never);
    courseAccess.assertSubjectReadable.mockRejectedValue(new ForbiddenException());

    await expect(service.assertCanRead('file-a', student)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns not found for a file in another organization', async () => {
    const { service, prisma } = buildService();
    prisma.file.findFirst.mockResolvedValue(null as never);

    await expect(service.assertCanRead('file-a', { ...student, organizationId: 'org-b' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.file.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'file-a', organizationId: 'org-b' },
    }));
  });

  it('returns a five-minute HMAC content URL and streams it only while the signature is valid', async () => {
    const { service, storage } = buildService();
    const result = await service.getSignedUrl('file-a', student);
    expect(result.originalName).toBe('informe.pdf');
    expect(result.url).toMatch(/^\/api\/files\/file-a\/content\?/);

    const url = new URL(result.url, 'https://app.test');
    const response = await service.getContent(
      'file-a',
      url.searchParams.get('organizationId')!,
      url.searchParams.get('expires')!,
      url.searchParams.get('signature')!,
    );
    expect(response.file.originalName).toBe('informe.pdf');
    expect(storage.getObject).toHaveBeenCalledWith('org-a/file-a');

    await expect(service.getContent('file-a', 'org-a', '1', '0'.repeat(64)))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getContent('file-a', 'org-a', String(Math.floor(Date.now() / 1000) + 60), '0'.repeat(64)))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to delete a referenced file before changing metadata or storage', async () => {
    const { service, storage, prisma } = buildService();
    prisma.file.findFirst.mockResolvedValue({
      ...baseFile,
      lessonAttachments: [{ lesson: { section: { subjectId: 'subject-a' } } }],
    } as never);

    await expect(service.delete('file-a', student))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.file.deleteMany).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('deletes file metadata before its unreferenced blob', async () => {
    const { service, storage, prisma } = buildService();
    prisma.file.deleteMany.mockResolvedValue({ count: 1 });

    await expect(service.delete('file-a', student)).resolves.toEqual({ deleted: true });

    expect(prisma.file.deleteMany).toHaveBeenCalledWith({
      where: { id: 'file-a', organizationId: 'org-a' },
    });
    expect(prisma.file.deleteMany.mock.invocationCallOrder[0])
      .toBeLessThan(storage.deleteObject.mock.invocationCallOrder[0]);
  });

  it('retains blobs referenced by an avatar or an attempt answer', async () => {
    const { service, storage, prisma } = buildService();
    prisma.user.findFirst.mockResolvedValue({ id: 'user-a' } as never);
    await expect(service.delete('file-a', student))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.file.deleteMany).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();

    prisma.user.findFirst.mockResolvedValue(null as never);
    prisma.answer.findMany.mockResolvedValue([{
      attempt: { userId: 'user-a', activity: { subjectId: 'subject-a' } },
    }] as never);
    await expect(service.delete('file-a', student))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.file.deleteMany).not.toHaveBeenCalled();
  });

  it('continues deleting organization objects when one storage deletion fails', async () => {
    const { service, storage } = buildService();
    storage.deleteObject
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce(undefined);

    await expect(service.deleteOrganizationObjects('org-a', ['org-a/one', 'org-a/two']))
      .resolves.toBeUndefined();
    expect(storage.deleteObject).toHaveBeenCalledTimes(2);
  });

  it('lets an org admin read and delete an unlinked file with no uploader', async () => {
    const { service, prisma, storage } = buildService();
    prisma.file.findFirst.mockResolvedValue({ ...baseFile, uploaderId: null } as never);
    prisma.file.deleteMany.mockResolvedValue({ count: 1 });

    await expect(service.assertCanRead('file-a', admin)).resolves.toBeDefined();
    await expect(service.delete('file-a', admin)).resolves.toEqual({ deleted: true });
    expect(prisma.file.deleteMany).toHaveBeenCalledWith({
      where: { id: 'file-a', organizationId: 'org-a' },
    });
    expect(storage.deleteObject).toHaveBeenCalledWith('org-a/file-a');
  });

  it('does not let a non-admin read or delete an unlinked file with no uploader', async () => {
    const { service, prisma, storage } = buildService();
    prisma.file.findFirst.mockResolvedValue({ ...baseFile, uploaderId: null } as never);

    await expect(service.assertCanRead('file-a', student)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.delete('file-a', student)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.file.deleteMany).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

});
