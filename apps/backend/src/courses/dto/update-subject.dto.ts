import { PublicationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateSubjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200, { message: 'El título no puede superar los 200 caracteres.' })
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(5000, { message: 'La descripción no puede superar los 5000 caracteres.' })
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsEnum(PublicationStatus)
  @IsOptional()
  status?: PublicationStatus;
}
