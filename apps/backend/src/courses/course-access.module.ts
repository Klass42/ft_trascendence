import { Global, Module } from '@nestjs/common';
import { CourseAccessService } from './course-access.service';

/** Global so every feature module shares one cohort/subject authorization gate. */
@Global()
@Module({
  providers: [CourseAccessService],
  exports: [CourseAccessService],
})
export class CourseAccessModule {}
