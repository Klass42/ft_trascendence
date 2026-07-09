import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Query params for `GET /notifications`. ValidationPipe runs with
 * `transform: true`, so the raw query strings arrive here already coerced
 * to numbers via `@Type(() => Number)`.
 */
export class ListNotificationsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;
}
