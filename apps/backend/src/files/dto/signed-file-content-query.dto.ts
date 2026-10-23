import { IsString, Matches } from 'class-validator';

export class SignedFileContentQueryDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,128}$/)
  organizationId: string;

  @IsString()
  @Matches(/^\d{10}$/)
  expires: string;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  signature: string;
}
