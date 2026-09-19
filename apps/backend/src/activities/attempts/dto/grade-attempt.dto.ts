import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class GradeAnswerDto {
  @IsString()
  @MinLength(1)
  questionId: string;

  @IsNumber()
  @Min(0)
  awarded: number;
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
  feedback?: string;
}
