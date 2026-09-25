import { CohortStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @MinLength(1)
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
