import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { GlobalRole } from '@prisma/client';

export class UpdateUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres.' })
  @IsOptional()
  name?: string;

  @IsEmail({ require_tld: false }, { message: 'Introduce un correo electrónico válido.' })
  @MaxLength(254, { message: 'El correo electrónico no puede superar los 254 caracteres.' })
  @IsOptional()
  email?: string;

  @IsEnum(GlobalRole)
  @IsOptional()
  role?: GlobalRole;

  @IsString()
  @MaxLength(5000, { message: 'La descripción no puede superar los 5000 caracteres.' })
  @IsOptional()
  bio?: string;
}
