import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, AuthUser } from '@/common/auth';
import { ForumsService } from './forums.service';
import { CreateThreadDto } from './dto/create-thread.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { SearchForumDto } from './dto/search-forum.dto';

@Controller()
export class ForumsController {
  constructor(private readonly forums: ForumsService) {}

  @Get('courses/:courseId/forum/threads')
  async listThreads(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.forums.listThreads(courseId, user.userId);
  }

  @Post('courses/:courseId/forum/threads')
  async createThread(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateThreadDto,
  ) {
    return this.forums.createThread(courseId, user.userId, dto);
  }

  // Declared before the parametrised search-less routes so Nest's router does
  // not treat "search" as a courseId — but these live under distinct paths so
  // order is not actually load-bearing here.
  @Get('courses/:courseId/forum/search')
  async search(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: SearchForumDto,
  ) {
    return this.forums.search(courseId, user.userId, query.q);
  }

  @Get('threads/:id')
  async getThread(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.forums.getThread(id, user.userId);
  }

  @Post('threads/:id/posts')
  async addPost(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePostDto,
  ) {
    return this.forums.addPost(id, user.userId, dto);
  }

  @Patch('threads/:id/pin')
  async togglePin(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.forums.togglePin(id, user.userId);
  }
}
