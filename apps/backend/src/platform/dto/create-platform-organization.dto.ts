import { IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
export class CreatePlatformOrganizationDto {
  @IsString() @MinLength(1) @MaxLength(100, { message: 'El nombre de la organización no puede superar los 100 caracteres.' }) name: string;
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'El código de organización solo puede contener letras minúsculas, números y guiones.' }) @MaxLength(100, { message: 'El código de organización no puede superar los 100 caracteres.' }) slug: string;
  @IsEmail({ require_tld: false }, { message: 'Introduce un correo electrónico válido.' }) @MaxLength(254, { message: 'El correo electrónico no puede superar los 254 caracteres.' }) adminEmail: string;
  @IsString() @MinLength(1) @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres.' }) adminName: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() primaryColor?: string;
  @IsOptional() @IsString() defaultLanguage?: string;
  @IsOptional() @IsString() timezone?: string;
  // Custom plans/limits (issue #18). Omit a limit to leave it unlimited.
  @IsOptional() @IsIn(['STARTER', 'GROWTH', 'ENTERPRISE', 'CUSTOM']) plan?: 'STARTER' | 'GROWTH' | 'ENTERPRISE' | 'CUSTOM';
  @IsOptional() @IsInt() @Min(1) maxUsers?: number;
  @IsOptional() @IsInt() @Min(1) maxCourses?: number;
  @IsOptional() @IsInt() @Min(1) maxStorageMb?: number;
}
