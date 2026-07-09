import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateFileDto {
  // NOTE(david): ids in this app are cuids (e.g. "org-klass-0001",
  // "cmrd…"), never UUIDs, so @IsUUID() rejected every real upload. Relaxed to
  // a non-empty string to match how the whole codebase (and the seed) issues
  // ids. Flagged for Aloiki (files/ owner).
  @IsString()
  @MinLength(1)
  organizationId: string;

  @IsString()
  @IsOptional()
  uploaderId?: string;
}
