import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '@/common/auth';
import { CreateResourceDto } from './dto/create-resource.dto';
import { ListResourcesDto } from './dto/list-resources.dto';
import { PublishResourceDto } from './dto/publish-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { ResourcesService } from './resources.service';

@Controller()
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get('resources')
  findAll(@Query() query: ListResourcesDto, @CurrentUser() user: AuthUser) {
    return this.resources.findAll(query, user);
  }

  @Post('resources')
  create(@Body() dto: CreateResourceDto, @CurrentUser() user: AuthUser) {
    return this.resources.create(dto, user);
  }

  @Get('resources/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.resources.findOne(id, user);
  }

  @Patch('resources/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateResourceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.resources.update(id, dto, user);
  }

  @Delete('resources/:id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.resources.remove(id, user);
    return { deleted: true };
  }

  @Post('resources/:id/courses')
  publishToCourse(
    @Param('id') id: string,
    @Body() dto: PublishResourceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.resources.publishToCourse(id, dto.courseId, dto, user);
  }

  @Delete('resources/:id/courses/:courseId')
  async removeFromCourse(
    @Param('id') id: string,
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.resources.removeFromCourse(id, courseId, user);
    return { deleted: true };
  }

  @Get('courses/:courseId/resources')
  findForCourse(
    @Param('courseId') courseId: string,
    @Query() query: ListResourcesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.resources.findForCourse(courseId, query, user);
  }
}
