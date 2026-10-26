import { IsEmail, MaxLength } from 'class-validator';

export class LookupUserQueryDto {
  @IsEmail({ require_tld: false }, { message: 'Introduce un correo electrónico válido.' })
  @MaxLength(254, { message: 'El correo electrónico no puede superar los 254 caracteres.' })
  email: string;
}
