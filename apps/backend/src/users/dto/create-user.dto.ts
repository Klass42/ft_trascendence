import { IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { GlobalRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail({ require_tld: false })
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsEnum(GlobalRole)
  @IsOptional()
  role?: GlobalRole;
}
