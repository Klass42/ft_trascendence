import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * Body for `PATCH /submissions/:id/grade`.
 *
 * The upper bound is per-assignment (`assignment.maxScore`), so it can't live
 * in a static decorator — the service validates `score <= maxScore`. Here we
 * only guarantee it's a non-negative number.
 */
export class GradeSubmissionDto {
  @IsNumber()
  @Min(0)
  score: number;

  @IsString()
  @IsOptional()
  feedback?: string;
}
