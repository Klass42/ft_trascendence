import { PublicationStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  category?: string;

  @IsString()
  @MaxLength(2048)
  @IsOptional()
  imageUrl?: string;

  @IsEnum(PublicationStatus)
  @IsOptional()
  status?: PublicationStatus;
}
