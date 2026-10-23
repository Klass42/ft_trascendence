import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateLessonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200, { message: 'El título no puede superar los 200 caracteres.' })
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
