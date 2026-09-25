import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { AddStaffDto } from './dto/add-staff.dto';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto';
import { CurrentUser, AuthUser, Roles, RolesGuard } from '@/common/auth';

@Controller()
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('me/courses')
  findMine(@CurrentUser() user: AuthUser) {
    return this.coursesService.findMine(user);
  }

  @Get('me/subjects')
  listMySubjects(@CurrentUser() user: AuthUser) {
    return this.coursesService.listMySubjects(user);
  }

  @Post('courses')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateCourseDto, @CurrentUser() user: AuthUser) {
    return this.coursesService.create(dto, user);
  }

  @Get('courses')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.coursesService.findAll(user, status, search);
  }

  @Post('courses/:courseId/subjects')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  createSubject(
    @Param('courseId') courseId: string,
    @Body() dto: CreateSubjectDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.createSubject(courseId, user, dto);
  }

  @Get('courses/:courseId/subjects')
  listSubjects(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.listSubjects(courseId, user);
  }

  @Post('courses/:courseId/members')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  addMember(
    @Param('courseId') courseId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.addMember(courseId, user, dto);
  }

  @Delete('courses/:courseId/members/:userId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async removeMember(
    @Param('courseId') courseId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.coursesService.removeMember(courseId, userId, user);
    return { deleted: true };
  }

  @Get('courses/:courseId/members')
  listMembers(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.listMembers(courseId, user);
  }

  @Get('courses/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.coursesService.findOne(id, user);
  }

  @Patch('courses/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.update(id, user, dto);
  }

  @Delete('courses/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.coursesService.delete(id, user);
    return { deleted: true };
  }

  @Get('subjects/:subjectId/members')
  listSubjectMembers(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.listSubjectMembers(subjectId, user);
  }

  @Get('subjects/:subjectId/staff')
  listStaff(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.listStaff(subjectId, user);
  }

  @Post('subjects/:subjectId/staff')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  addStaff(
    @Param('subjectId') subjectId: string,
    @Body() dto: AddStaffDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.addStaff(subjectId, user, dto);
  }

  @Patch('subjects/:subjectId/staff/:userId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateStaffRole(
    @Param('subjectId') subjectId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateStaffRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.updateStaffRole(subjectId, userId, user, dto);
  }

  @Delete('subjects/:subjectId/staff/:userId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async removeStaff(
    @Param('subjectId') subjectId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.coursesService.removeStaff(subjectId, userId, user);
    return { deleted: true };
  }

  @Get('subjects/:subjectId')
  findSubject(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.findSubject(subjectId, user);
  }

  @Patch('subjects/:subjectId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateSubject(
    @Param('subjectId') subjectId: string,
    @Body() dto: UpdateSubjectDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.updateSubject(subjectId, user, dto);
  }

  @Delete('subjects/:subjectId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async deleteSubject(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.coursesService.deleteSubject(subjectId, user);
    return { deleted: true };
  }
}
