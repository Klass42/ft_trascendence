import { IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Introduce tu contraseña actual.' })
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres.' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe incluir al menos una mayúscula, una minúscula y un número.',
  })
  newPassword: string;
}
