import { CohortStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200, { message: 'El nombre de la cohorte no puede superar los 200 caracteres.' })
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
