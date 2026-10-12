import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QuestionKind } from '@prisma/client';

export class TemplateBlockDto {
  @IsEnum(QuestionKind)
  kind: QuestionKind;

  @IsString()
  @MinLength(1)
  prompt: string;

  @IsNumber()
  @Min(0)
  points: number;

  @IsNumber()
  @Min(0)
  order: number;

  @IsObject()
  content: Record<string, unknown>;
}

export class CreateTaskTemplateDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateBlockDto)
  blocks: TemplateBlockDto[];
}
