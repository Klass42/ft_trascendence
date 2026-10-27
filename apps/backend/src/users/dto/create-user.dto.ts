import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { GlobalRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail({ require_tld: false }, { message: 'Introduce un correo electrónico válido.' })
  @MaxLength(254, { message: 'El correo electrónico no puede superar los 254 caracteres.' })
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'La contraseña debe incluir al menos una mayúscula, una minúscula y un número.',
  })
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres.' })
  name: string;

  @IsEnum(GlobalRole)
  @IsOptional()
  role?: GlobalRole;
}
