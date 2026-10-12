import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_AVATAR_UPLOAD_BYTES = 2 * 1024 * 1024;

export type UploadPurpose = 'GENERAL' | 'AVATAR';

const GENERAL_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/epub+zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const AVATAR_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/**
 * Enforces the application upload policy independently of Multer. Multer's
 * limits are still useful for protecting memory, but this guard is the
 * authoritative validation for every caller of FilesService.
 */
export function validateUpload(
  file: Express.Multer.File | undefined,
  purpose: UploadPurpose = 'GENERAL',
): asserts file is Express.Multer.File {
  if (!file) {
    throw new BadRequestException('File is required');
  }
  if (!file.originalname?.trim()) {
    throw new BadRequestException('File name is required');
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || !file.buffer?.length) {
    throw new BadRequestException('File must not be empty');
  }

  const maxBytes = purpose === 'AVATAR' ? MAX_AVATAR_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
  if (file.size > maxBytes || file.buffer.length > maxBytes) {
    throw new PayloadTooLargeException(
      `File exceeds the ${maxBytes / (1024 * 1024)} MB upload limit`,
    );
  }

  const allowedTypes = purpose === 'AVATAR'
    ? AVATAR_CONTENT_TYPES
    : GENERAL_CONTENT_TYPES;
  if (!allowedTypes.has(file.mimetype)) {
    const label = purpose === 'AVATAR' ? 'Avatar' : 'File';
    throw new BadRequestException(`${label} type is not allowed`);
  }
}
