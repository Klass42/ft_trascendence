import { IsInt, IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateLessonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200, { message: 'El título no puede superar los 200 caracteres.' })
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  contentMd?: string;

  // Empty string or null clears the video; anything else must be an https URL.
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsString({ message: 'La URL del vídeo debe ser texto.' })
  @MaxLength(2000, { message: 'La URL del vídeo no puede superar los 2000 caracteres.' })
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'La URL del vídeo debe ser una dirección https válida.' },
  )
  videoUrl?: string | null;

  @IsInt()
  @IsOptional()
  order?: number;
}
