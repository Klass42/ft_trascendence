import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, StoredFile } from './storage/storage.service';
import type { AuthUser } from '@/common/auth';
import { ResourcesService } from '@/resources/resources.service';
import { CourseAccessService } from '@/courses/course-access.service';
import { UploadPurpose, validateUpload } from './file-validation';

const FILE_URL_TTL_SECONDS = 5 * 60;

const FILE_REFERENCE_INCLUDE = {
  lessonAttachments: {
    select: { lesson: { select: { section: { select: { subjectId: true } } } } },
  },
  assignmentFiles: {
    select: { assignment: { select: { subjectId: true } } },
  },
  submissionFiles: {
    select: {
      submission: { select: { userId: true, assignment: { select: { subjectId: true } } } },
    },
  },
  activityFiles: {
    select: { activity: { select: { subjectId: true } } },
  },
  learningResources: { select: { id: true } },
} satisfies Prisma.FileInclude;

type FileWithReferences = Prisma.FileGetPayload<{
  include: typeof FILE_REFERENCE_INCLUDE;
}>;

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly resources: ResourcesService,
    private readonly courseAccess: CourseAccessService,
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

  /**
   * Shared URL function for downloads and avatar links. Keep callers such as
   * avatar linking on this method so authorization and expiry stay consistent.
   */
  async getSignedUrl(fileId: string, user: AuthUser) {
    const fileRecord = await this.assertCanRead(fileId, user);
    return {
      url: this.createSignedContentUrl(fileRecord),
      originalName: fileRecord.originalName,
    };
  }

  /** Resolves legacy avatar URLs without exposing storage paths or skipping access checks. */
  async getSignedUrlByObjectKey(objectKey: string, user: AuthUser) {
    const file = await this.prisma.file.findFirst({
      where: { objectKey, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!file) throw new NotFoundException('File not found');
    return this.getSignedUrl(file.id, user);
  }

  /** A file is readable only through an authorized reference or by its uploader when unlinked. */
  async assertCanRead(fileId: string, user: AuthUser): Promise<FileWithReferences> {
    const file = await this.findFile(fileId, user.organizationId);
    if (!file) throw new NotFoundException(`File ${fileId} not found`);

    const answers = await this.findAnswerReferences(fileId, user.organizationId);
    const hasReferences = file.lessonAttachments.length > 0
      || file.assignmentFiles.length > 0
      || file.submissionFiles.length > 0
      || file.activityFiles.length > 0
      || file.learningResources.length > 0
      || answers.length > 0;

    const subjectIds = new Set<string>([
      ...file.lessonAttachments.map((link) => link.lesson.section.subjectId),
      ...file.assignmentFiles.map((link) => link.assignment.subjectId),
      ...file.activityFiles.map((link) => link.activity.subjectId),
    ]);
    for (const subjectId of subjectIds) {
      if (await this.canReadSubject(subjectId, user)) return file;
    }

    for (const link of file.submissionFiles) {
      const submission = link.submission;
      if (submission.userId === user.userId
        || await this.canReadSubjectStaff(submission.assignment.subjectId, user)) {
        return file;
      }
    }

    for (const answer of answers) {
      const attempt = answer.attempt;
      if (attempt.userId === user.userId
        || await this.canReadSubjectStaff(attempt.activity.subjectId, user)) {
        return file;
      }
    }

    if (file.learningResources.length > 0 && await this.resources.canAccessFile(fileId, user)) {
      return file;
    }

    // Avatar URLs are stored on the uploader's user row. Only that row can
    // establish an avatar reference; arbitrary profile URLs cannot widen access.
    if (file.uploaderId && await this.prisma.user.findFirst({
      where: {
        id: file.uploaderId,
        organizationId: user.organizationId,
        OR: [
          { avatarUrl: { contains: `/files/${file.id}/content` } },
          { avatarUrl: { contains: `/uploads/${file.objectKey}` } },
          { avatarUrl: { contains: `/${file.bucket}/${file.objectKey}` } },
        ],
      },
      select: { id: true },
    })) {
      return file;
    }

    if (!hasReferences && file.uploaderId === user.userId) return file;
    // Orphan whose owner was deleted: org ADMIN can still read during retention.
    if (!hasReferences && !file.uploaderId && user.role === 'ADMIN') return file;
    throw new ForbiddenException('You cannot access this file');
  }

  /** Verifies a short-lived HMAC capability, then streams the stored object. */
  async getContent(
    fileId: string,
    organizationId: string,
    expires: string,
    signature: string,
  ) {
    const expiresAt = Number(expires);
    const now = Math.floor(Date.now() / 1000);
    if (!/^\d{10}$/.test(expires)
      || !Number.isSafeInteger(expiresAt)
      || expiresAt <= now
      || expiresAt > now + FILE_URL_TTL_SECONDS + 5
      || !/^[a-f0-9]{64}$/i.test(signature)) {
      throw new ForbiddenException('Invalid or expired file URL');
    }

    const expected = this.signContentUrl(fileId, organizationId, expiresAt);
    const suppliedBytes = Buffer.from(signature, 'hex');
    const expectedBytes = Buffer.from(expected, 'hex');
    if (suppliedBytes.length !== expectedBytes.length
      || !timingSafeEqual(suppliedBytes, expectedBytes)) {
      throw new ForbiddenException('Invalid or expired file URL');
    }

    const file = await this.findFile(fileId, organizationId);
    if (!file) throw new NotFoundException(`File ${fileId} not found`);
    const stream = await this.storage.getObject(file.objectKey);
    return { file, stream };
  }

  async delete(fileId: string, user: AuthUser) {
    const organizationId = user.organizationId;
    const fileRecord = await this.findFile(fileId, organizationId);

    if (!fileRecord) {
      return { deleted: false };
    }
    const isOwner = fileRecord.uploaderId === user.userId;
    const isOrgAdminOrphan = !fileRecord.uploaderId && user.role === 'ADMIN';
    if (!isOwner && !isOrgAdminOrphan) {
      throw new ForbiddenException('You cannot delete this file');
    }

    const answers = await this.findAnswerReferences(fileId, organizationId);
    const avatarReference = fileRecord.uploaderId && await this.prisma.user.findFirst({
      where: {
        id: fileRecord.uploaderId,
        organizationId,
        OR: [
          { avatarUrl: { contains: `/files/${fileRecord.id}/content` } },
          { avatarUrl: { contains: `/uploads/${fileRecord.objectKey}` } },
          { avatarUrl: { contains: `/${fileRecord.bucket}/${fileRecord.objectKey}` } },
        ],
      },
      select: { id: true },
    });
    if (avatarReference || fileRecord.lessonAttachments.length + fileRecord.submissionFiles.length
      + fileRecord.assignmentFiles.length + fileRecord.activityFiles.length
      + fileRecord.learningResources.length + answers.length > 0) {
      throw new ConflictException(
        'Remove this file from its avatar, lesson, activity, submission, or resource before deleting it',
      );
    }

    // Delete metadata first. If object storage then fails, the remaining bytes
    // are no longer addressable by the app and become a safe orphan candidate;
    // the inverse order could leave a live relation pointing at missing bytes.
    await this.prisma.file.deleteMany({ where: { id: fileId, organizationId } });
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

  /** Removes organization blobs after its File rows have been cascaded away. */
  async deleteOrganizationObjects(organizationId: string, objectKeys: string[]) {
    for (const objectKey of objectKeys) {
      try {
        await this.storage.deleteObject(objectKey);
      } catch (error) {
        this.logger.error(
          `Organization ${organizationId} was deleted but object ${objectKey} remains an orphan`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  private findFile(fileId: string, organizationId: string) {
    return this.prisma.file.findFirst({
      where: { id: fileId, organizationId },
      include: FILE_REFERENCE_INCLUDE,
    });
  }

  private findAnswerReferences(fileId: string, organizationId: string) {
    return this.prisma.answer.findMany({
      where: {
        response: { path: ['fileIds'], array_contains: [fileId] },
        attempt: { activity: { subject: { organizationId } } },
      },
      select: {
        attempt: { select: { userId: true, activity: { select: { subjectId: true } } } },
      },
    });
  }

  private async canReadSubject(subjectId: string, user: AuthUser): Promise<boolean> {
    try {
      await this.courseAccess.assertSubjectReadable(subjectId, user);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) return false;
      throw error;
    }
  }

  private async canReadSubjectStaff(subjectId: string, user: AuthUser): Promise<boolean> {
    try {
      await this.courseAccess.assertSubjectStaff(subjectId, user);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) return false;
      throw error;
    }
  }

  private createSignedContentUrl(file: Pick<FileWithReferences, 'id' | 'organizationId'>): string {
    const expires = Math.floor(Date.now() / 1000) + FILE_URL_TTL_SECONDS;
    const signature = this.signContentUrl(file.id, file.organizationId, expires);
    const query = new URLSearchParams({
      organizationId: file.organizationId,
      expires: String(expires),
      signature,
    });
    return `/api/files/${encodeURIComponent(file.id)}/content?${query.toString()}`;
  }

  private signContentUrl(fileId: string, organizationId: string, expires: number): string {
    const secret = process.env.FILE_URL_SIGNING_SECRET || process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new ServiceUnavailableException('File URL signing is not configured');
    return createHmac('sha256', secret)
      .update(`${fileId}\n${organizationId}\n${expires}`)
      .digest('hex');
  }
}
