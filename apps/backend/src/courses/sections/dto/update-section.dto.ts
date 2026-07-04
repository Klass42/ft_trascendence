import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSectionDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  title?: string;

  @IsInt()
  @IsOptional()
  order?: number;
}
