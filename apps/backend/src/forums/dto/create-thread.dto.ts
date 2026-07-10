import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateThreadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  // Optional opening message posted alongside the thread. When present it
  // becomes the thread's first (root) post authored by the creator.
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  body?: string;
}
