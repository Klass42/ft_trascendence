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

export class UpdateAssignmentDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  title?: string;

  @IsString()
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
  @IsOptional()
  fileIds?: string[];
}
