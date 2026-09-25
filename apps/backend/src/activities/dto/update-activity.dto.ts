import { ActivityType, PublicationStatus } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Body for `PATCH /activities/:id`. Every field optional; pass an explicit
 * `null` on a date bound to clear it, omit to leave unchanged (mirrors
 * UpdateAssignmentDto).
 */
export class UpdateActivityDto {
  @IsEnum(ActivityType)
  @IsOptional()
  type?: ActivityType;

  @IsString()
  @MinLength(1)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  openAt?: string | null;

  @IsDateString()
  @IsOptional()
  dueAt?: string | null;

  @IsDateString()
  @IsOptional()
  closeAt?: string | null;

  // Ignored: maxScore is derived from question points.
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxScore?: number;

  @IsBoolean()
  @IsOptional()
  countsTowardFinal?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fileIds?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  attemptsAllowed?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  timeLimitSec?: number | null;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @IsEnum(PublicationStatus)
  @IsOptional()
  status?: PublicationStatus;
}
