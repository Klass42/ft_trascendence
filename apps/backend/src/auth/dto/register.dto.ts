import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'El código de organización solo puede contener letras minúsculas, números y guiones.' })
  @MaxLength(100, { message: 'El código de organización no puede superar los 100 caracteres.' })
  organizationSlug?: string;
  @IsEmail({ require_tld: false }, { message: 'Introduce un correo electrónico válido.' })
  @MaxLength(254, { message: 'El correo electrónico no puede superar los 254 caracteres.' })
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe incluir al menos una mayúscula, una minúscula y un número.',
  })
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres.' })
  name: string;
}
