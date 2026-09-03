import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, StoredFile } from './storage/storage.service';
import type { AuthUser } from '@/common/auth';
import { ResourcesService } from '@/resources/resources.service';
import { UploadPurpose, validateUpload } from './file-validation';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly resources: ResourcesService,
  ) {}

  async createUpload(
    file: Express.Multer.File,
    organizationId: string,
    uploaderId?: string,
    purpose: UploadPurpose = 'GENERAL',
  ) {
    validateUpload(file, purpose);
    const stored: StoredFile = await this.storage.putObject(
      file,
      organizationId,
    );

    const fileRecord = await this.prisma.file.create({
      data: {
        organizationId,
        uploaderId,
        bucket: stored.bucket,
        objectKey: stored.objectKey,
        originalName: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
      },
    });

    return fileRecord;
  }

  async getSignedUrl(fileId: string, user: AuthUser) {
    const fileRecord = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!fileRecord) {
      throw new NotFoundException(`File ${fileId} not found`);
    }
    if (fileRecord.organizationId !== user.organizationId) {
      throw new ForbiddenException('File belongs to another organization');
    }

    // A library file is never authorized merely by tenant membership. This is
    // deliberately separate from existing lesson/assignment attachments, whose
    // membership checks are handled by their own endpoints while that work is
    // migrated. It closes the resource-library download leak now.
    const referencedByResource = await this.prisma.learningResource.count({
      where: { fileId, organizationId: user.organizationId },
    });
    if (referencedByResource > 0 && !(await this.resources.canAccessFile(fileId, user))) {
      throw new ForbiddenException('You cannot access this resource file');
    }

    const url = await this.storage.getSignedUrl(fileRecord.objectKey);

    return { url, originalName: fileRecord.originalName };
  }

  async delete(fileId: string, organizationId: string, userId: string) {
    const fileRecord = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!fileRecord) {
      return { deleted: false };
    }
    if (fileRecord.organizationId !== organizationId || fileRecord.uploaderId !== userId) {
      throw new ForbiddenException('You cannot delete this file');
    }

    await this.storage.deleteObject(fileRecord.objectKey);
    await this.prisma.file.delete({ where: { id: fileId } });
    return { deleted: true };
  }
}
