import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TemplateBlockDto } from './create-task-template.dto';

export class UpdateTaskTemplateDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateBlockDto)
  @IsOptional()
  blocks?: TemplateBlockDto[];
}
