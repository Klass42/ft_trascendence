import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString() @MinLength(1) @MaxLength(2048)
  token: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(128, { message: 'La contraseña no puede superar los 128 caracteres.' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: 'La contraseña debe incluir una mayúscula, una minúscula y un número.' })
  password: string;
}
