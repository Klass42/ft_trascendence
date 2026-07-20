import { QuestionKind } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

/** Body for `PATCH /questions/:id`. All optional; changing `kind` requires a
 * matching new `content` (validated together in the service). */
export class UpdateQuestionDto {
  @IsEnum(QuestionKind)
  @IsOptional()
  kind?: QuestionKind;

  @IsString()
  @MinLength(1)
  @IsOptional()
  prompt?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  points?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @IsObject()
  @IsOptional()
  content?: Record<string, unknown>;
}
