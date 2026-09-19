import { IsOptional, IsString, MinLength } from 'class-validator';

export class SaveAsTemplateDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
