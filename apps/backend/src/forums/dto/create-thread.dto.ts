import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from './trim';

export class CreateThreadDto {
  @Transform(trimString)
  @IsString({ message: 'El título debe ser texto.' })
  @MinLength(1, { message: 'El título no puede estar vacío.' })
  @MaxLength(200, { message: 'El título no puede superar los 200 caracteres.' })
  title: string;

  // Optional opening message posted alongside the thread. When present it
  // becomes the thread's first (root) post authored by the creator. Omit it
  // instead of sending whitespace: a blank body is rejected.
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'El mensaje debe ser texto.' })
  @MinLength(1, { message: 'El mensaje no puede estar vacío.' })
  @MaxLength(5000, { message: 'La descripción no puede superar los 5000 caracteres.' })
  body?: string;
}
