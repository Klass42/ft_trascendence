import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAssignmentDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
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
  @IsOptional()
  fileIds?: string[];
}
