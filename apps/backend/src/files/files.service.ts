import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, StoredFile } from './storage/storage.service';
import type { AuthUser } from '@/common/auth';
import { ResourcesService } from '@/resources/resources.service';
import { UploadPurpose, validateUpload } from './file-validation';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

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

    try {
      return await this.prisma.file.create({
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
    } catch (error) {
      // The object write cannot share Prisma's database transaction. Compensate
      // immediately so a rejected/failed metadata write does not accumulate
      // orphaned bytes. If storage is unavailable, the object is inaccessible
      // (there is no File row) and is handled by the retention workflow.
      try {
        await this.storage.deleteObject(stored.objectKey);
      } catch (cleanupError) {
        this.logger.error(
          `Could not compensate upload ${stored.objectKey}; it is an inaccessible orphan`,
          cleanupError instanceof Error ? cleanupError.stack : undefined,
        );
      }
      throw error;
    }
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

    const [lessonAttachments, submissionFiles, assignmentFiles, learningResources] = await Promise.all([
      this.prisma.lessonAttachment.count({ where: { fileId } }),
      this.prisma.submissionFile.count({ where: { fileId } }),
      this.prisma.assignmentFile.count({ where: { fileId } }),
      this.prisma.learningResource.count({ where: { fileId } }),
    ]);
    if (lessonAttachments + submissionFiles + assignmentFiles + learningResources > 0) {
      throw new ConflictException(
        'Remove this file from its lesson, assignment, submission, or resource before deleting it',
      );
    }

    // Delete metadata first. If object storage then fails, the remaining bytes
    // are no longer addressable by the app and become a safe orphan candidate;
    // the inverse order could leave a live relation pointing at missing bytes.
    await this.prisma.file.delete({ where: { id: fileId } });
    try {
      await this.storage.deleteObject(fileRecord.objectKey);
    } catch (error) {
      this.logger.error(
        `File metadata ${fileId} was deleted but object ${fileRecord.objectKey} remains an orphan`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
    return { deleted: true };
  }
}
