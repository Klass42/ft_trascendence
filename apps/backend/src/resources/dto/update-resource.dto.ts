import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { LearningResourceStatus, LearningResourceType } from '@prisma/client';

/** Partial metadata update. `null` clears an optional scalar/source field. */
export class UpdateResourceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(5000)
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
  @IsString()
  fileId?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUrl({ require_tld: false })
  externalUrl?: string | null;

  @IsEnum(LearningResourceStatus)
  @IsOptional()
  status?: LearningResourceStatus;
}
