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
  const label = purpose === 'AVATAR' ? 'Avatar' : 'File';
  if (!allowedTypes.has(file.mimetype)) {
    throw new BadRequestException(`${label} type is not allowed`);
  }

  // The declared MIME type comes from the client and can be anything. The
  // extension must agree with it and the bytes must match the format, so a
  // renamed executable or script is rejected however it is labelled.
  const format = FORMATS_BY_EXTENSION.get(fileExtension(file.originalname));
  if (!format || !format.mimeTypes.includes(file.mimetype)) {
    throw new BadRequestException(`${label} extension does not match its type`);
  }
  if (!format.matches(file.buffer)) {
    throw new BadRequestException(`${label} content does not match its type`);
  }
}

// =============================================================================
// Content sniffing
// =============================================================================

interface FileFormat {
  /** Declared MIME types accepted for this extension. */
  mimeTypes: string[];
  /** True when the leading bytes look like this format. */
  matches: (buffer: Buffer) => boolean;
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).trim().toLowerCase();
}

function startsWith(buffer: Buffer, bytes: number[] | string, offset = 0): boolean {
  const expected = typeof bytes === 'string' ? Buffer.from(bytes, 'latin1') : Buffer.from(bytes);
  return buffer.length >= offset + expected.length
    && buffer.subarray(offset, offset + expected.length).equals(expected);
}

const isZip = (b: Buffer) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]);
/** Legacy Office (doc/xls/ppt) compound file. */
const isOle2 = (b: Buffer) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
/** ISO base media (mp4/m4a/mov): a box type at offset 4. */
const isIsoMedia = (b: Buffer) =>
  ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'].some((box) => startsWith(b, box, 4));
const isRiff = (b: Buffer, form: string) => startsWith(b, 'RIFF') && startsWith(b, form, 8);
/** Plain text: no NUL bytes in the first 8 KB (binary formats almost always have them). */
const isText = (b: Buffer) => !b.subarray(0, 8192).includes(0);

const PDF: FileFormat = { mimeTypes: ['application/pdf'], matches: (b) => startsWith(b, '%PDF-') };
const JPEG: FileFormat = { mimeTypes: ['image/jpeg'], matches: (b) => startsWith(b, [0xff, 0xd8, 0xff]) };
const MP4_VIDEO: FileFormat = { mimeTypes: ['video/mp4'], matches: isIsoMedia };

const FORMATS_BY_EXTENSION = new Map<string, FileFormat>([
  ['pdf', PDF],
  ['epub', {
    mimeTypes: ['application/epub+zip'],
    matches: (b) => isZip(b) && startsWith(b, 'mimetypeapplication/epub+zip', 30),
  }],
  ['doc', { mimeTypes: ['application/msword'], matches: isOle2 }],
  ['xls', { mimeTypes: ['application/vnd.ms-excel'], matches: isOle2 }],
  ['ppt', { mimeTypes: ['application/vnd.ms-powerpoint'], matches: isOle2 }],
  ['docx', {
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    matches: isZip,
  }],
  ['xlsx', {
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    matches: isZip,
  }],
  ['pptx', {
    mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    matches: isZip,
  }],
  ['txt', { mimeTypes: ['text/plain'], matches: isText }],
  // Windows browsers report .csv as application/vnd.ms-excel.
  ['csv', { mimeTypes: ['text/csv', 'text/plain', 'application/vnd.ms-excel'], matches: isText }],
  ['jpg', JPEG],
  ['jpeg', JPEG],
  ['png', {
    mimeTypes: ['image/png'],
    matches: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  }],
  ['webp', { mimeTypes: ['image/webp'], matches: (b) => isRiff(b, 'WEBP') }],
  ['gif', { mimeTypes: ['image/gif'], matches: (b) => startsWith(b, 'GIF87a') || startsWith(b, 'GIF89a') }],
  ['mp3', {
    mimeTypes: ['audio/mpeg'],
    // ID3 tag, or a bare MPEG frame sync (11 set bits).
    matches: (b) => startsWith(b, 'ID3') || (b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  }],
  ['wav', { mimeTypes: ['audio/wav'], matches: (b) => isRiff(b, 'WAVE') }],
  ['ogg', { mimeTypes: ['audio/ogg'], matches: (b) => startsWith(b, 'OggS') }],
  ['m4a', { mimeTypes: ['audio/mp4'], matches: isIsoMedia }],
  ['mp4', { mimeTypes: ['video/mp4', 'audio/mp4'], matches: isIsoMedia }],
  ['m4v', MP4_VIDEO],
  ['webm', { mimeTypes: ['video/webm'], matches: (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]) }],
  ['mov', { mimeTypes: ['video/quicktime'], matches: isIsoMedia }],
]);
