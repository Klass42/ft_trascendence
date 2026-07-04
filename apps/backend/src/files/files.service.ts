import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, StoredFile } from './storage/storage.service';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async createUpload(
    file: Express.Multer.File,
    organizationId: string,
    uploaderId?: string,
  ) {
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

  async getSignedUrl(fileId: string) {
    const fileRecord = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!fileRecord) {
      throw new NotFoundException(`File ${fileId} not found`);
    }

    const url = await this.storage.getSignedUrl(fileRecord.objectKey);

    return { url, originalName: fileRecord.originalName };
  }

  async delete(fileId: string) {
    const fileRecord = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!fileRecord) {
      return { deleted: false };
    }

    await this.storage.deleteObject(fileRecord.objectKey);
    await this.prisma.file.delete({ where: { id: fileId } });
    return { deleted: true };
  }
}
