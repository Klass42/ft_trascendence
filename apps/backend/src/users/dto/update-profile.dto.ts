import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString({ message: 'El nombre no es válido.' })
  @Matches(/\S/, { message: 'El nombre no puede estar vacío.' })
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

  /** UI language preference (es/en), persisted per user. */
  @IsIn(['es', 'en'], { message: 'El idioma debe ser es o en.' })
  @IsOptional()
  preferredLanguage?: string;
}
