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

/**
 * Body for `POST /activities/:id/questions`.
 *
 * `content` shape depends on `kind` and is validated per-kind in the service
 * ({@link ActivitiesService.validateQuestionContent}) — here we only guarantee
 * it is an object so a malformed body is rejected early.
 */
export class CreateQuestionDto {
  @IsEnum(QuestionKind)
  kind: QuestionKind;

  @IsString()
  @MinLength(1)
  prompt: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  points?: number; // defaults to 1

  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @IsObject()
  content: Record<string, unknown>;
}
