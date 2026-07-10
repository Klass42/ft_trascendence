import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  // Optional parent post id — set it to nest a reply under another post.
  @IsString()
  @IsOptional()
  parentId?: string;
}
