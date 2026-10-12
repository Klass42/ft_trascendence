import { IsOptional, IsString } from 'class-validator';

export class EnrollCourseDto {
  @IsString()
  @IsOptional()
  /** Removed with self-enrolment. Field kept absent on purpose. */
  note?: never;
}
