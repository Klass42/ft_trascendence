import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CourseRole,
  LearningResourceStatus,
  Prisma,
} from '@prisma/client';
import type { AuthUser } from '@/common/auth';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { ListResourcesDto } from './dto/list-resources.dto';
import { PublishResourceDto } from './dto/publish-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';

const STAFF_COURSE_ROLES: readonly CourseRole[] = [CourseRole.TEACHER, CourseRole.ASSISTANT];

// Resource API responses never disclose the storage bucket or object key. A
// caller must use GET /files/:id/url, which authorizes the linked resource
// before it returns a temporary object-storage URL.
const RESOURCE_FILE_SELECT = {
  id: true,
  originalName: true,
  contentType: true,
  sizeBytes: true,
  createdAt: true,
} satisfies Prisma.FileSelect;

const RESOURCE_INCLUDE = {
  file: { select: RESOURCE_FILE_SELECT },
  courses: {
    include: { course: { select: { id: true, title: true } } },
    orderBy: { order: 'asc' },
  },
} satisfies Prisma.LearningResourceInclude;

/** A course view must never reveal which other courses reuse the resource. */
function resourceIncludeForCourse(courseId: string) {
  return {
    file: { select: RESOURCE_FILE_SELECT },
    courses: {
      where: { courseId },
      include: { course: { select: { id: true, title: true } } },
      orderBy: { order: 'asc' },
    },
  } satisfies Prisma.LearningResourceInclude;
}

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  private isLibraryStaff(user: AuthUser) {
    return user.role === 'ADMIN' || user.role === 'TEACHER';
  }

  private assertLibraryStaff(user: AuthUser) {
    if (!this.isLibraryStaff(user)) {
      throw new ForbiddenException('Only teachers and administrators can use the resource library');
    }
  }

  private assertOwnerOrAdmin(
    resource: { createdById: string },
    user: AuthUser,
  ) {
    if (user.role !== 'ADMIN' && resource.createdById !== user.userId) {
      throw new ForbiddenException('Only the resource owner or an administrator can manage it');
    }
  }

  private async requireOwnedResource(id: string, user: AuthUser) {
    const resource = await this.prisma.learningResource.findFirst({
      where: { id, organizationId: user.organizationId },
      include: RESOURCE_INCLUDE,
    });
    if (!resource) throw new NotFoundException(`Resource ${id} not found`);
    return resource;
  }

  private async assertSource(
    organizationId: string,
    fileId: string | null | undefined,
    externalUrl: string | null | undefined,
  ) {
    const hasFile = !!fileId;
    const hasExternalUrl = !!externalUrl;
    if (hasFile === hasExternalUrl) {
      throw new BadRequestException('Provide exactly one source: fileId or externalUrl');
    }
    if (fileId) {
      const file = await this.prisma.file.findFirst({
        where: { id: fileId, organizationId },
        select: { id: true },
      });
      if (!file) {
        throw new BadRequestException('The file does not belong to this organization');
      }
    }
  }

  async create(dto: CreateResourceDto, user: AuthUser) {
    this.assertLibraryStaff(user);
    await this.assertSource(user.organizationId, dto.fileId, dto.externalUrl);

    const status = dto.status ?? LearningResourceStatus.DRAFT;
    return this.prisma.learningResource.create({
      data: {
        organizationId: user.organizationId,
        createdById: user.userId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        type: dto.type,
        authors: this.cleanList(dto.authors),
        publisher: dto.publisher?.trim() || null,
        isbn: dto.isbn?.trim() || null,
        language: dto.language?.trim() || null,
        license: dto.license?.trim() || null,
        tags: this.cleanList(dto.tags),
        fileId: dto.fileId ?? null,
        externalUrl: dto.externalUrl?.trim() || null,
        status,
        publishedAt: status === LearningResourceStatus.PUBLISHED ? new Date() : null,
      },
      include: RESOURCE_INCLUDE,
    });
  }

  async findAll(dto: ListResourcesDto, user: AuthUser) {
    this.assertLibraryStaff(user);
    const search = dto.search?.trim();
    return this.prisma.learningResource.findMany({
      where: {
        organizationId: user.organizationId,
        ...(dto.type && { type: dto.type }),
        ...(dto.status && { status: dto.status }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { authors: { has: search } },
            { tags: { has: search } },
          ],
        }),
      },
      include: RESOURCE_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthUser) {
    this.assertLibraryStaff(user);
    const resource = await this.requireOwnedResource(id, user);
    this.assertOwnerOrAdmin(resource, user);
    return resource;
  }

  async update(id: string, dto: UpdateResourceDto, user: AuthUser) {
    this.assertLibraryStaff(user);
    const existing = await this.requireOwnedResource(id, user);
    this.assertOwnerOrAdmin(existing, user);

    const nextFileId = dto.fileId === undefined ? existing.fileId : dto.fileId;
    const nextExternalUrl =
      dto.externalUrl === undefined ? existing.externalUrl : dto.externalUrl;
    await this.assertSource(user.organizationId, nextFileId, nextExternalUrl);

    const status = dto.status ?? existing.status;
    const publishedAt =
      status === LearningResourceStatus.PUBLISHED &&
      existing.status !== LearningResourceStatus.PUBLISHED
        ? new Date()
        : existing.publishedAt;

    return this.prisma.learningResource.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.authors !== undefined && { authors: this.cleanList(dto.authors) }),
        ...(dto.publisher !== undefined && { publisher: dto.publisher?.trim() || null }),
        ...(dto.isbn !== undefined && { isbn: dto.isbn?.trim() || null }),
        ...(dto.language !== undefined && { language: dto.language?.trim() || null }),
        ...(dto.license !== undefined && { license: dto.license?.trim() || null }),
        ...(dto.tags !== undefined && { tags: this.cleanList(dto.tags) }),
        ...(dto.fileId !== undefined && { fileId: dto.fileId }),
        ...(dto.externalUrl !== undefined && { externalUrl: dto.externalUrl?.trim() || null }),
        ...(dto.status !== undefined && { status, publishedAt }),
      },
      include: RESOURCE_INCLUDE,
    });
  }

  async remove(id: string, user: AuthUser) {
    this.assertLibraryStaff(user);
    const resource = await this.requireOwnedResource(id, user);
    this.assertOwnerOrAdmin(resource, user);
    await this.prisma.learningResource.delete({ where: { id } });
  }

  /** Link a resource to a course; course staff or an organization admin may do so. */
  async publishToCourse(
    resourceId: string,
    courseId: string,
    dto: PublishResourceDto,
    user: AuthUser,
  ) {
    await this.requireOwnedResource(resourceId, user);
    await this.requireCourseMembership(courseId, user, true);

    return this.prisma.courseResource.upsert({
      where: { resourceId_courseId: { resourceId, courseId } },
      create: {
        resourceId,
        courseId,
        order: dto.order ?? 0,
        required: dto.required ?? false,
      },
      update: {
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.required !== undefined && { required: dto.required }),
      },
      include: { resource: { include: RESOURCE_INCLUDE } },
    });
  }

  async removeFromCourse(resourceId: string, courseId: string, user: AuthUser) {
    await this.requireOwnedResource(resourceId, user);
    await this.requireCourseMembership(courseId, user, true);
    await this.prisma.courseResource.deleteMany({ where: { resourceId, courseId } });
  }

  /** Resource list inside one course. Students see only PUBLISHED entries. */
  async findForCourse(courseId: string, dto: ListResourcesDto, user: AuthUser) {
    const membership = await this.requireCourseMembership(courseId, user, false);
    const search = dto.search?.trim();
    const studentView = !membership.isStaff;
    return this.prisma.courseResource.findMany({
      where: {
        courseId,
        resource: {
          organizationId: user.organizationId,
          ...(studentView && { status: LearningResourceStatus.PUBLISHED }),
          ...(dto.type && { type: dto.type }),
          ...(search && {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { authors: { has: search } },
              { tags: { has: search } },
            ],
          }),
        },
      },
      include: { resource: { include: resourceIncludeForCourse(courseId) } },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Authorizes a file reached via the resource library before FilesService
   * signs it. A learner must be enrolled in a linked course and the resource
   * must be published; owners/admins and linked course staff may also open it.
   */
  async canAccessFile(fileId: string, user: AuthUser): Promise<boolean> {
    const resources = await this.prisma.learningResource.findMany({
      where: { fileId, organizationId: user.organizationId },
      select: {
        createdById: true,
        status: true,
        courses: { select: { courseId: true } },
      },
    });
    if (resources.length === 0) return false;
    if (user.role === 'ADMIN' || resources.some((resource) => resource.createdById === user.userId)) {
      return true;
    }

    const courseIds = [...new Set(resources.flatMap((resource) => resource.courses.map((course) => course.courseId)))];
    if (courseIds.length === 0) return false;
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId: user.userId, courseId: { in: courseIds } },
      select: { courseId: true, role: true },
    });
    const rolesByCourse = new Map(enrollments.map((item) => [item.courseId, item.role]));
    return resources.some((resource) =>
      resource.courses.some((course) => {
        const role = rolesByCourse.get(course.courseId);
        return role !== undefined &&
          (STAFF_COURSE_ROLES.includes(role) || resource.status === LearningResourceStatus.PUBLISHED);
      }),
    );
  }

  private async requireCourseMembership(
    courseId: string,
    user: AuthUser,
    requireStaff: boolean,
  ): Promise<{ isStaff: boolean }> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!course) throw new NotFoundException(`Course ${courseId} not found`);
    if (user.role === 'ADMIN') return { isStaff: true };

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId, userId: user.userId } },
      select: { role: true },
    });
    if (!enrollment) throw new NotFoundException(`Course ${courseId} not found`);
    const isStaff = STAFF_COURSE_ROLES.includes(enrollment.role);
    if (requireStaff && !isStaff) {
      throw new ForbiddenException('Only course staff can publish resources');
    }
    return { isStaff };
  }

  private cleanList(values?: string[]) {
    return (values ?? []).map((value) => value.trim()).filter(Boolean);
  }
}
