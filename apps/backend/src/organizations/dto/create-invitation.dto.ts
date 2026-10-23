import { IsEmail, IsIn, MaxLength } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail({ require_tld: false }, { message: 'Introduce un correo electrónico válido.' })
  @MaxLength(254, { message: 'El correo electrónico no puede superar los 254 caracteres.' })
  email: string;

  @IsIn(['ADMIN', 'TEACHER', 'STUDENT'], { message: 'El rol debe ser ADMIN, TEACHER o STUDENT.' })
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
}
