import {
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

  // ISO 8601 string; the service converts it to a Date.
  @IsDateString()
  @IsOptional()
  dueAt?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxScore?: number;
}
