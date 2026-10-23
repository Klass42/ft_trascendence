import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** Deliberately separate from tenant login: platform accounts have no tenant. */
export class PlatformLoginDto {
  @IsEmail({ require_tld: false }, { message: 'Introduce un correo electrónico válido.' })
  @MaxLength(254, { message: 'El correo electrónico no puede superar los 254 caracteres.' })
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
