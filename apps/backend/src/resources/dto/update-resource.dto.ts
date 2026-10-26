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
  ValidateIf,
} from 'class-validator';
import { LearningResourceStatus, LearningResourceType } from '@prisma/client';
import { ID_PATTERN } from '@/common/validation/id';

/** Partial metadata update. `null` clears an optional scalar/source field. */
export class UpdateResourceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200, { message: 'El título no puede superar los 200 caracteres.' })
  @IsOptional()
  title?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(5000, { message: 'La descripción no puede superar los 5000 caracteres.' })
  description?: string | null;

  @IsEnum(LearningResourceType)
  @IsOptional()
  type?: LearningResourceType;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  @IsOptional()
  authors?: string[];

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(200)
  publisher?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(32)
  isbn?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(32)
  language?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(200)
  license?: string | null;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  @IsOptional()
  tags?: string[];

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString({ message: 'El identificador del archivo debe ser texto.' })
  @Matches(ID_PATTERN, { message: 'El identificador del archivo debe tener un formato válido.' })
  fileId?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUrl({ require_tld: false })
  externalUrl?: string | null;

  @IsEnum(LearningResourceStatus)
  @IsOptional()
  status?: LearningResourceStatus;

  /** Move to a library folder (#26); `null` moves it to the root. */
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString({ message: 'El identificador de la carpeta debe ser texto.' })
  @Matches(ID_PATTERN, { message: 'El identificador de la carpeta debe tener un formato válido.' })
  folderId?: string | null;
}
