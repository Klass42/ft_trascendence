import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { CourseStatus } from '@prisma/client';

export class CreateCourseDto {
  @IsUUID()
  organizationId: string;

  @IsString()
  @MinLength(1)
  title: string;

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
