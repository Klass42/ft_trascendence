import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ID_PATTERN } from '@/common/validation/id';

export class UpdateAssignmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200, { message: 'El título no puede superar los 200 caracteres.' })
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(5000, { message: 'La descripción no puede superar los 5000 caracteres.' })
  @IsOptional()
  description?: string;

  // Submission window. Pass an explicit `null` to clear a bound; omit to leave
  // it unchanged. See CreateAssignmentDto for the semantics of each field.
  @IsDateString()
  @IsOptional()
  openAt?: string | null;

  @IsDateString()
  @IsOptional()
  dueAt?: string | null;

  @IsDateString()
  @IsOptional()
  closeAt?: string | null;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxScore?: number;

  // When present, replaces the assignment's attachment set with these file ids
  // (empty array clears them). Omit to leave attachments untouched.
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(ID_PATTERN, {
    each: true,
    message: 'Cada identificador de archivo debe tener un formato válido.',
  })
  @IsOptional()
  fileIds?: string[];
}
