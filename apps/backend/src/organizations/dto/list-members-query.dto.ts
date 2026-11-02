import { Transform, Type } from 'class-transformer';
import { GlobalRole } from '@prisma/client';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListMembersQueryDto {
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional()
  q?: string;

  @IsEnum(GlobalRole)
  @IsOptional()
  role?: GlobalRole;

  @IsIn(['active', 'inactive', 'pending'])
  @IsOptional()
  status?: 'active' | 'inactive' | 'pending';

  /** #134: account state; `status` above is presence/verification. */
  @IsIn(['active', 'deactivated'])
  @IsOptional()
  account?: 'active' | 'deactivated';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number;
}
