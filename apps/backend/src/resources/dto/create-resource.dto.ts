import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LearningResourceStatus, LearningResourceType } from '@prisma/client';
import { ID_PATTERN } from '@/common/validation/id';

/** Metadata for a reusable item in the organization resource library. */
export class CreateResourceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200, { message: 'El título no puede superar los 200 caracteres.' })
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000, { message: 'La descripción no puede superar los 5000 caracteres.' })
  description?: string;

  @IsEnum(LearningResourceType)
  type: LearningResourceType;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  @IsOptional()
  authors?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(200)
  publisher?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  isbn?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  language?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  license?: string;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  @IsOptional()
  tags?: string[];

  /** Existing File uploaded through POST /files. Source exclusivity is service-validated. */
  @IsString({ message: 'El identificador del archivo debe ser texto.' })
  @Matches(ID_PATTERN, { message: 'El identificador del archivo debe tener un formato válido.' })
  @IsOptional()
  fileId?: string;

  /** External HTTPS/HTTP resource. Source exclusivity is service-validated. */
  @IsUrl({ require_tld: false })
  @IsOptional()
  externalUrl?: string;

  @IsEnum(LearningResourceStatus)
  @IsOptional()
  status?: LearningResourceStatus;
}
