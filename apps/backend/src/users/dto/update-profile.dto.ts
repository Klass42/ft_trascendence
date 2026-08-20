import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  /** Relative file URL returned by FilesService (e.g. /api/files/:id/url) */
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsBoolean()
  @IsOptional()
  emailNotificationsEnabled?: boolean;

  /** UI language preference — stored now, applied when i18n lands (Phase C) */
  @IsIn(['es', 'en'])
  @IsOptional()
  preferredLanguage?: string;
}
