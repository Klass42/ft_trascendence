import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LearningResourceStatus, LearningResourceType } from '@prisma/client';

/** Metadata for a reusable item in the organization resource library. */
export class CreateResourceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
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
  @IsString()
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
