import { IsDateString, IsOptional } from 'class-validator';

/**
 * Optional ISO date range for the submissions time-series. Both bounds are
 * validated as ISO-8601 date strings; the service falls back to "the last 30
 * days" when either is omitted and swaps them if `from` is after `to`.
 */
export class SubmissionsOverTimeDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
