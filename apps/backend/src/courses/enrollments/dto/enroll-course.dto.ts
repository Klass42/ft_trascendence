import { IsOptional, IsString } from 'class-validator';

export class EnrollCourseDto {
  @IsString()
  @IsOptional()
  accessCode?: string;
}
