import { CohortStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateCourseDto {
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(1)
  @MaxLength(120)
  @IsOptional()
  name?: string;

  @IsString()
  @Matches(/^\d{4}-\d{4}$/)
  @IsOptional()
  academicYear?: string;

  @IsDateString()
  @IsOptional()
  startsOn?: string;

  @IsDateString()
  @IsOptional()
  endsOn?: string;

  @IsEnum(CohortStatus)
  @IsOptional()
  status?: CohortStatus;
}
