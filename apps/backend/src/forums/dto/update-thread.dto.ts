import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from './trim';

/**
 * Edit a thread. Only the title lives on the thread itself: the opening
 * message is a regular post and is edited through PATCH /posts/:id.
 */
export class UpdateThreadDto {
  @Transform(trimString)
  @IsString({ message: 'El título debe ser texto.' })
  @MinLength(1, { message: 'El título no puede estar vacío.' })
  @MaxLength(200, { message: 'El título no puede superar los 200 caracteres.' })
  title: string;
}
