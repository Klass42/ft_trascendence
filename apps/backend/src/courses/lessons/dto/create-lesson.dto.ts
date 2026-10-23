import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLessonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200, { message: 'El título no puede superar los 200 caracteres.' })
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
