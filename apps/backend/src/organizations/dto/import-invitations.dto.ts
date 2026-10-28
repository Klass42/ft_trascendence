import { IsString, MaxLength, MinLength } from 'class-validator';

export class ImportInvitationsDto {
  @IsString({ message: 'Adjunta el contenido del CSV.' })
  @MinLength(1, { message: 'El CSV está vacío.' })
  @MaxLength(90_000, { message: 'El CSV no puede superar los 90 KB.' })
  csv: string;
}
