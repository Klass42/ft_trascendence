import { IsString, Matches, MaxLength } from 'class-validator';

export class ResolveFileUrlQueryDto {
  @IsString()
  @MaxLength(256)
  @Matches(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/)
  objectKey: string;
}
