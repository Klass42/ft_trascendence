import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'El código de organización solo puede contener letras minúsculas, números y guiones.' })
  @MaxLength(100, { message: 'El código de organización no puede superar los 100 caracteres.' })
  organizationSlug?: string;
  @IsEmail({ require_tld: false }, { message: 'Introduce un correo electrónico válido.' })
  @MaxLength(254, { message: 'El correo electrónico no puede superar los 254 caracteres.' })
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
