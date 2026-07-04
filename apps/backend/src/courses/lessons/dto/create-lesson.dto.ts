import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLessonDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @IsOptional()
  contentMd?: string;

  @IsString()
  @IsOptional()
  videoUrl?: string;

  @IsInt()
  @IsOptional()
  order?: number;
}
