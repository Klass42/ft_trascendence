import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres.' })
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(5000, { message: 'La descripción no puede superar los 5000 caracteres.' })
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
