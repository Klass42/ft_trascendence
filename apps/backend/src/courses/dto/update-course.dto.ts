import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { CourseStatus } from '@prisma/client';

export class UpdateCourseDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  accessCode?: string;

  @IsEnum(CourseStatus)
  @IsOptional()
  status?: CourseStatus;
}
