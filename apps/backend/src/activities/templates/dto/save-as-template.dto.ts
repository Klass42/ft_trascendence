import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const TEMPLATE_TITLE_MAX = 200;

export class SaveAsTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(TEMPLATE_TITLE_MAX)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
