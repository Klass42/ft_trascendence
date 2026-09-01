import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  organizationSlug?: string;
  @IsEmail({ require_tld: false })
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
