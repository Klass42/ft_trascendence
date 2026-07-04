import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { SectionsController } from './sections/sections.controller';
import { SectionsService } from './sections/sections.service';
import { LessonsController } from './lessons/lessons.controller';
import { LessonsService } from './lessons/lessons.service';

@Module({
  controllers: [
    CoursesController,
    SectionsController,
    LessonsController,
  ],
  providers: [
    CoursesService,
    SectionsService,
    LessonsService,
  ],
})
export class CoursesModule {}
