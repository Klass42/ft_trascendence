import { ConflictException } from '@nestjs/common';
import { FilesService } from '../files.service';

const upload = {
  originalname: 'e2e-proof.txt',
  mimetype: 'text/plain',
  size: 12,
  buffer: Buffer.from('proof bytes'),
} as Express.Multer.File;

describe('FilesService orphan safety', () => {
  const storage = {
    putObject: jest.fn(),
    deleteObject: jest.fn(),
    getSignedUrl: jest.fn(),
  };
  const prisma = {
    file: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    lessonAttachment: { count: jest.fn() },
    submissionFile: { count: jest.fn() },
    assignmentFile: { count: jest.fn() },
    learningResource: { count: jest.fn() },
  };
  const resources = { canAccessFile: jest.fn() };
  let service: FilesService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new FilesService(prisma as never, storage as never, resources as never);
    storage.putObject.mockResolvedValue({ bucket: 'uploads', objectKey: 'org-a/file-a' });
    storage.deleteObject.mockResolvedValue(undefined);
    prisma.lessonAttachment.count.mockResolvedValue(0);
    prisma.submissionFile.count.mockResolvedValue(0);
    prisma.assignmentFile.count.mockResolvedValue(0);
    prisma.learningResource.count.mockResolvedValue(0);
  });

  it('removes bytes when metadata creation fails after an object upload', async () => {
    prisma.file.create.mockRejectedValue(new Error('database unavailable'));

    await expect(service.createUpload(upload, 'org-a', 'user-a')).rejects.toThrow('database unavailable');

    expect(storage.deleteObject).toHaveBeenCalledWith('org-a/file-a');
  });

  it('refuses to delete a file while any application relation still references it', async () => {
    prisma.file.findUnique.mockResolvedValue({
      id: 'file-a', organizationId: 'org-a', uploaderId: 'user-a', objectKey: 'org-a/file-a',
    });
    prisma.learningResource.count.mockResolvedValue(1);

    await expect(service.delete('file-a', 'org-a', 'user-a')).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.file.delete).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('deletes metadata before the unreferenced object', async () => {
    prisma.file.findUnique.mockResolvedValue({
      id: 'file-a', organizationId: 'org-a', uploaderId: 'user-a', objectKey: 'org-a/file-a',
    });
    prisma.file.delete.mockResolvedValue({});

    await expect(service.delete('file-a', 'org-a', 'user-a')).resolves.toEqual({ deleted: true });

    expect(prisma.file.delete.mock.invocationCallOrder[0])
      .toBeLessThan(storage.deleteObject.mock.invocationCallOrder[0]);
  });
});
