import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const GRADE_FEEDBACK_MAX = 2000;

export class GradeAnswerDto {
  @IsString()
  @MinLength(1)
  questionId: string;

  /** Omit to leave the points untouched (e.g. a comment on an auto-graded
   * question). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  awarded?: number;

  /** Per-question comment for the student. Empty string clears it. */
  @IsOptional()
  @IsString()
  @MaxLength(GRADE_FEEDBACK_MAX)
  feedback?: string;
}

/**
 * Body for `PATCH /attempts/:id/grade`. Per-question awarded points for
 * subjective blocks; overall score is derived as sum(Answer.awarded).
 */
export class GradeAttemptDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayUnique((a: GradeAnswerDto) => a.questionId)
  @Type(() => GradeAnswerDto)
  answers: GradeAnswerDto[];

  @IsOptional()
  @IsString()
  @MaxLength(GRADE_FEEDBACK_MAX)
  feedback?: string;
}
