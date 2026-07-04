import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFileDto {
  @IsUUID()
  organizationId: string;

  @IsString()
  @IsOptional()
  uploaderId?: string;
}
