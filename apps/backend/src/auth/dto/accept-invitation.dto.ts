import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
export class AcceptInvitationDto {
  @IsString() @MinLength(1) @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres.' }) name: string;
  @IsString() @MinLength(8) @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: 'La contraseña debe incluir al menos una mayúscula, una minúscula y un número.' }) password: string;
}
