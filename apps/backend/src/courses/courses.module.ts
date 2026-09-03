import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { SectionsController } from './sections/sections.controller';
import { SectionsService } from './sections/sections.service';
import { LessonsController } from './lessons/lessons.controller';
import { LessonsService } from './lessons/lessons.service';
import { EnrollmentsController } from './enrollments/enrollments.controller';
import { EnrollmentsService } from './enrollments/enrollments.service';
import { CourseAccessService } from './course-access.service';

@Module({
  controllers: [
    CoursesController,
    SectionsController,
    LessonsController,
    EnrollmentsController,
  ],
  providers: [
    CoursesService,
    SectionsService,
    LessonsService,
    EnrollmentsService,
    CourseAccessService,
  ],
})
export class CoursesModule {}
