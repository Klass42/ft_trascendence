import { IsString, MinLength } from 'class-validator';

export class AddMemberDto {
  @IsString()
  @MinLength(1)
  userId: string;
}
