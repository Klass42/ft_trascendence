import { PublicationStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateSubjectDto {
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(1)
  @MaxLength(120)
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  description?: string;

  @IsString()
  @MaxLength(2048)
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsEnum(PublicationStatus)
  @IsOptional()
  status?: PublicationStatus;
}
