import { IsString, MaxLength, MinLength } from 'class-validator';

/** Query params for the forum search endpoint. */
export class SearchForumDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q: string;
}
