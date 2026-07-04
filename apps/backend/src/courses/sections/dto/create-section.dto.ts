import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSectionDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsInt()
  @IsOptional()
  order?: number;
}
