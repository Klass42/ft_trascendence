import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from './trim';

export class UpdatePostDto {
  @Transform(trimString)
  @IsString({ message: 'El mensaje debe ser texto.' })
  @MinLength(1, { message: 'El mensaje no puede estar vacío.' })
  @MaxLength(5000, { message: 'La descripción no puede superar los 5000 caracteres.' })
  body: string;
}
