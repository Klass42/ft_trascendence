import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateLessonDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  title?: string;

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
