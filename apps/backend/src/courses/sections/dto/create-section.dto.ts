import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200, { message: 'El título no puede superar los 200 caracteres.' })
  title: string;

  @IsInt()
  @IsOptional()
  order?: number;
}
