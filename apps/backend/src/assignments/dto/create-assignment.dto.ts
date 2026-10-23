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

export class CreateAssignmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200, { message: 'El título no puede superar los 200 caracteres.' })
  title: string;

  @IsString()
  @MaxLength(5000, { message: 'La descripción no puede superar los 5000 caracteres.' })
  @IsOptional()
  description?: string;

  // Submission window. ISO 8601 strings; the service converts them to Dates.
  // openAt: submissions accepted from this moment (null/absent = open now).
  @IsDateString()
  @IsOptional()
  openAt?: string;

  // dueAt: soft deadline; submissions after it are marked LATE (still accepted).
  @IsDateString()
  @IsOptional()
  dueAt?: string;

  // closeAt: hard close; submissions after it are rejected.
  @IsDateString()
  @IsOptional()
  closeAt?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxScore?: number;

  // Ids of files (already uploaded via /files) to attach as the teacher's
  // prompt/resources. Validated in the service to belong to this org + uploader.
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
