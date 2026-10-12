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
 * Body for `POST /courses/:courseId/activities`.
 *
 * `config` is a free-form JSON bag ({ shuffleQuestions, shuffleOptions,
 * showSolutions }) kept loose on purpose — validated shallowly here and
 * interpreted by the attempt flow. Questions are added via their own endpoints.
 */
export class CreateActivityDto {
  @IsEnum(ActivityType)
  @IsOptional()
  type?: ActivityType; // defaults to QUIZ in the schema

  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  // Same window semantics as Assignment: openAt ≤ dueAt ≤ closeAt (service-checked).
  @IsDateString()
  @IsOptional()
  openAt?: string;

  @IsDateString()
  @IsOptional()
  dueAt?: string;

  @IsDateString()
  @IsOptional()
  closeAt?: string;

  // Ignored: maxScore is always sum(question.points). Kept so old clients don't 400.
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxScore?: number;

  @IsBoolean()
  @IsOptional()
  countsTowardFinal?: boolean;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsString()
  @IsOptional()
  sourceActivityId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fileIds?: string[];

  // 0 = unlimited attempts.
  @IsInt()
  @Min(0)
  @IsOptional()
  attemptsAllowed?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  timeLimitSec?: number;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  // DRAFT (default) hides it from students; PUBLISHED makes it takeable.
  @IsEnum(PublicationStatus)
  @IsOptional()
  status?: PublicationStatus;
}
