import { IsNumber, Min } from 'class-validator';

/**
 * Body for `PATCH /attempts/:id/grade` (staff manual grading of an attempt that
 * contains subjective questions). Sets the final overall score; the upper bound
 * (activity.maxScore) is checked in the service. (Per-answer feedback/rubric is
 * a Phase C enhancement.)
 */
export class GradeAttemptDto {
  @IsNumber()
  @Min(0)
  score: number;
}
