import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser, AuthUser } from '@/common/auth';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
import { SaveAsTemplateDto } from './dto/save-as-template.dto';
import { UpdateTaskTemplateDto } from './dto/update-task-template.dto';
import { TaskTemplatesService } from './task-templates.service';

@Controller()
export class TaskTemplatesController {
  constructor(private readonly templates: TaskTemplatesService) {}

  @Post('task-templates')
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTaskTemplateDto,
  ) {
    return this.templates.create(user.userId, dto);
  }

  @Get('task-templates')
  findAll(@CurrentUser() user: AuthUser) {
    return this.templates.findAll(user.userId);
  }

  @Get('task-templates/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.templates.findOne(id, user.userId);
  }

  @Patch('task-templates/:id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateTaskTemplateDto,
  ) {
    return this.templates.update(id, user.userId, dto);
  }

  @Delete('task-templates/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.templates.remove(id, user.userId);
  }

  @Post('activities/:id/save-as-template')
  saveAsTemplate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SaveAsTemplateDto,
  ) {
    return this.templates.saveFromActivity(id, user.userId, dto);
  }
}
