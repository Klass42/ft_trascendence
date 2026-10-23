import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ID_PATTERN } from '@/common/validation/id';

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000, { message: 'La descripción no puede superar los 5000 caracteres.' })
  body: string;

  // Optional parent post id — set it to nest a reply under another post.
  @IsString()
  @Matches(ID_PATTERN, { message: 'El identificador del mensaje debe tener un formato válido.' })
  @IsOptional()
  parentId?: string;
}
