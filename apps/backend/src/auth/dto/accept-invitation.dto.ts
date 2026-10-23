import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
export class AcceptInvitationDto {
  @IsString() @MinLength(1) @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres.' }) name: string;
  @IsString() @MinLength(8) @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' }) password: string;
}
