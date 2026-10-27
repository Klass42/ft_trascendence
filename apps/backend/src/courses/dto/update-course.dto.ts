import { CohortStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateCourseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200, { message: 'El nombre de la cohorte no puede superar los 200 caracteres.' })
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
