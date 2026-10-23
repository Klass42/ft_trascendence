import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
export class UpdatePlatformOrganizationDto {
 @IsOptional() @IsString() @MinLength(1) @MaxLength(100, { message: 'El nombre de la organización no puede superar los 100 caracteres.' }) name?: string;
 @IsOptional() @IsString() logoUrl?: string;
 @IsOptional() @IsString() primaryColor?: string;
 @IsOptional() @IsString() defaultLanguage?: string;
 @IsOptional() @IsString() timezone?: string;
 @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED', 'ARCHIVED']) status?: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
 // Custom plans/limits (issue #18). `null` resets a limit back to unlimited.
 @IsOptional() @IsIn(['STARTER', 'GROWTH', 'ENTERPRISE', 'CUSTOM']) plan?: 'STARTER' | 'GROWTH' | 'ENTERPRISE' | 'CUSTOM';
 @IsOptional() @IsInt() @Min(1) maxUsers?: number | null;
 @IsOptional() @IsInt() @Min(1) maxCourses?: number | null;
 @IsOptional() @IsInt() @Min(1) maxStorageMb?: number | null;
}
