import { CohortStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsString()
  @Matches(/^\d{4}-\d{4}$/)
  academicYear: string;

  @IsDateString()
  startsOn: string;

  @IsDateString()
  endsOn: string;

  @IsEnum(CohortStatus)
  @IsOptional()
  status?: CohortStatus;
}
