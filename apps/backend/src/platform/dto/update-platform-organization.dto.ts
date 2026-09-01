import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
export class UpdatePlatformOrganizationDto {
 @IsOptional() @IsString() @MinLength(1) name?: string;
 @IsOptional() @IsString() logoUrl?: string;
 @IsOptional() @IsString() primaryColor?: string;
 @IsOptional() @IsString() defaultLanguage?: string;
 @IsOptional() @IsString() timezone?: string;
 @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED', 'ARCHIVED']) status?: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
}
