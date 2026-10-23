import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateThreadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200, { message: 'El título no puede superar los 200 caracteres.' })
  title: string;

  // Optional opening message posted alongside the thread. When present it
  // becomes the thread's first (root) post authored by the creator.
  @IsString()
  @IsOptional()
  @MaxLength(5000, { message: 'La descripción no puede superar los 5000 caracteres.' })
  body?: string;
}
