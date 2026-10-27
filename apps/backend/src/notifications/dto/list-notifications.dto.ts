import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Query params for `GET /notifications`. ValidationPipe runs with
 * `transform: true`, so the raw query strings arrive here already coerced
 * to numbers via `@Type(() => Number)`.
 *
 * Pagination is page based (`page` + `pageSize`, at most 100 per page);
 * `unreadOnly=true` restricts the list (and `total`) to unread notifications.
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

  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  @IsOptional()
  unreadOnly?: boolean;
}
