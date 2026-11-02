import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import type { AuthUser } from '@/common/auth';
import { CourseAccessService } from '@/courses/course-access.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BatchDeleteDto, CreateFolderDto, PublishFolderDto, UpdateFolderDto } from './dto/folder.dto';
import { NotificationsService } from '../notifications/notifications.service';

const FOLDER_INCLUDE = {
  subjects: { include: { subject: { select: { id: true, title: true, courseId: true } } } },
  _count: { select: { resources: true, children: true } },
} as const;

/** Map folderId -> every descendant id (including itself) for an org's folder tree. */
export function collectDescendants(
  rootIds: string[],
  folders: { id: string; parentId: string | null }[],
): Set<string> {
  const children = new Map<string, string[]>();
  for (const folder of folders) {
    if (!folder.parentId) continue;
    children.set(folder.parentId, [...(children.get(folder.parentId) ?? []), folder.id]);
  }
  const out = new Set<string>();
  const stack = [...rootIds];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}

/**
 * Real library folders (#26). Same permission model as resources: only
 * TEACHER/ADMIN use the library; the creator or an ADMIN manages a folder.
 */
@Injectable()
export class ResourceFoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
    private readonly notifications?: NotificationsService,
  ) {}

  private assertLibraryStaff(user: AuthUser) {
    if (user.role !== 'ADMIN' && user.role !== 'TEACHER') {
      throw new ForbiddenException('Solo profesores y administradores pueden usar la biblioteca de recursos.');
    }
  }

  private assertOwnerOrAdmin(item: { createdById: string }, user: AuthUser, label = 'carpeta') {
    if (user.role !== 'ADMIN' && item.createdById !== user.userId) {
      throw new ForbiddenException(`Solo quien creó la ${label} o un administrador puede gestionarla.`);
    }
  }

  private async requireFolder(id: string, user: AuthUser) {
    const folder = await this.prisma.resourceFolder.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!folder) throw new NotFoundException('Carpeta no encontrada.');
    return folder;
  }

  /** Throws unless `parentId` is an org folder (and, when moving, not inside `selfId`). */
  async assertValidParent(parentId: string, user: AuthUser, selfId?: string) {
    await this.requireFolder(parentId, user);
    if (!selfId) return;
    const all = await this.prisma.resourceFolder.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, parentId: true },
    });
    if (collectDescendants([selfId], all).has(parentId)) {
      throw new BadRequestException('Una carpeta no puede moverse dentro de sí misma ni de sus subcarpetas.');
    }
  }

  async findAll(user: AuthUser) {
    this.assertLibraryStaff(user);
    return this.prisma.resourceFolder.findMany({
      where: { organizationId: user.organizationId },
      include: FOLDER_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateFolderDto, user: AuthUser) {
    this.assertLibraryStaff(user);
    if (dto.parentId) await this.assertValidParent(dto.parentId, user);
    const created = await this.prisma.resourceFolder.create({
      data: {
        organizationId: user.organizationId,
        createdById: user.userId,
        name: dto.name.trim(),
        parentId: dto.parentId ?? null,
      },
      include: FOLDER_INCLUDE,
    });
    await this.notifyLibraryStaff(user, `Carpeta creada: ${created.name}`);
    return created;
  }

  async update(id: string, dto: UpdateFolderDto, user: AuthUser) {
    this.assertLibraryStaff(user);
    const folder = await this.requireFolder(id, user);
    this.assertOwnerOrAdmin(folder, user);
    if (dto.parentId) await this.assertValidParent(dto.parentId, user, id);
    const updated = await this.prisma.resourceFolder.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      },
      include: FOLDER_INCLUDE,
    });
    await this.notifyLibraryStaff(user, `Carpeta actualizada: ${updated.name}`);
    return updated;
  }

  /** Deleting a folder moves its subfolders and resources to the root; nothing else is deleted. */
  async remove(id: string, user: AuthUser) {
    this.assertLibraryStaff(user);
    const folder = await this.requireFolder(id, user);
    this.assertOwnerOrAdmin(folder, user);
    await this.prisma.$transaction([
      this.prisma.learningResource.updateMany({ where: { folderId: id }, data: { folderId: null } }),
      this.prisma.resourceFolder.updateMany({ where: { parentId: id }, data: { parentId: null } }),
      this.prisma.resourceFolder.delete({ where: { id } }),
    ]);
    await this.notifyLibraryStaff(user, `Carpeta eliminada: ${folder.name}`);
  }

  /** Live publication: the subject sees everything inside the folder tree, now and later. */
  async publishToSubject(id: string, dto: PublishFolderDto, user: AuthUser) {
    const folder = await this.requireFolder(id, user);
    const { subject } = await this.access.assertSubjectStaff(dto.subjectId, user);
    const link = await this.prisma.subjectFolder.upsert({
      where: { folderId_subjectId: { folderId: id, subjectId: dto.subjectId } },
      create: { folderId: id, subjectId: dto.subjectId, required: dto.required ?? false },
      update: { ...(dto.required !== undefined && { required: dto.required }) },
    });
    await this.notifyLibraryStaff(user, `Carpeta «${folder.name}» publicada en ${subject.title}`);
    if (subject.status === 'PUBLISHED') {
      await this.notifySubjectStudents(
        subject.id,
        user,
        `Nuevo material en ${subject.title}: carpeta ${folder.name}`,
        `/courses/${subject.courseId}/subjects/${subject.id}`,
      );
    }
    return link;
  }

  async removeFromSubject(id: string, subjectId: string, user: AuthUser) {
    const folder = await this.requireFolder(id, user);
    const { subject } = await this.access.assertSubjectStaff(subjectId, user);
    const removed = await this.prisma.subjectFolder.deleteMany({ where: { folderId: id, subjectId } });
    if (removed.count > 0) {
      await this.notifyLibraryStaff(user, `Carpeta «${folder.name}» retirada de ${subject.title}`);
    }
  }

  /**
   * Batch delete (#26). All-or-nothing: every id must exist in the org and be
   * manageable by the caller, otherwise nothing is deleted and the offending
   * ids are reported. Selected folders release their remaining contents to
   * the root. Storage files are never deleted (same as single delete).
   */
  async batchDelete(dto: BatchDeleteDto, user: AuthUser) {
    this.assertLibraryStaff(user);
    const resourceIds = [...new Set(dto.resourceIds ?? [])];
    const folderIds = [...new Set(dto.folderIds ?? [])];
    if (resourceIds.length === 0 && folderIds.length === 0) {
      throw new BadRequestException('Selecciona al menos un recurso o carpeta.');
    }
    const [resources, folders] = await Promise.all([
      resourceIds.length
        ? this.prisma.learningResource.findMany({
          where: { id: { in: resourceIds }, organizationId: user.organizationId },
          select: { id: true, createdById: true },
        })
        : Promise.resolve([]),
      folderIds.length
        ? this.prisma.resourceFolder.findMany({
          where: { id: { in: folderIds }, organizationId: user.organizationId },
          select: { id: true, createdById: true },
        })
        : Promise.resolve([]),
    ]);
    const foundR = new Set(resources.map((r) => r.id));
    const foundF = new Set(folders.map((f) => f.id));
    const missing = [...resourceIds.filter((id) => !foundR.has(id)), ...folderIds.filter((id) => !foundF.has(id))];
    if (missing.length) {
      throw new NotFoundException({ message: 'Algunos elementos no existen en esta organización.', ids: missing });
    }
    const isAdmin = user.role === 'ADMIN';
    const forbidden = [...resources, ...folders].filter((item) => !isAdmin && item.createdById !== user.userId).map((item) => item.id);
    if (forbidden.length) {
      throw new ForbiddenException({ message: 'No puedes eliminar algunos de los elementos seleccionados.', ids: forbidden });
    }

    await this.prisma.$transaction([
      this.prisma.learningResource.deleteMany({ where: { id: { in: resourceIds } } }),
      this.prisma.learningResource.updateMany({ where: { folderId: { in: folderIds } }, data: { folderId: null } }),
      this.prisma.resourceFolder.updateMany({
        where: { parentId: { in: folderIds }, id: { notIn: folderIds } },
        data: { parentId: null },
      }),
      this.prisma.resourceFolder.deleteMany({ where: { id: { in: folderIds } } }),
    ]);

    const result = { deletedResources: resourceIds.length, deletedFolders: folderIds.length };
    if (this.notifications) {
      const parts = [
        result.deletedResources && `${result.deletedResources} ${result.deletedResources === 1 ? 'recurso' : 'recursos'}`,
        result.deletedFolders && `${result.deletedFolders} ${result.deletedFolders === 1 ? 'carpeta' : 'carpetas'}`,
      ].filter(Boolean).join(' y ');
      const verb = result.deletedResources + result.deletedFolders === 1 ? 'se ha eliminado' : 'se han eliminado';
      await this.notifications.emitMany(
        async () => (await this.prisma.user.findMany({
          where: { organizationId: user.organizationId, role: { in: ['ADMIN', 'TEACHER'] } },
          select: { id: true },
        })).map(({ id }) => id),
        NotificationType.RESOURCE_CHANGED,
        { title: `Biblioteca: ${verb} ${parts}`, link: '/resources' },
        { organizationId: user.organizationId, actorId: user.userId },
      );
    }
    return result;
  }

  /** Admins and teachers of the organization (everyone who uses the library), minus the actor. */
  private async notifyLibraryStaff(user: AuthUser, title: string) {
    await this.notifications?.emitMany(
      async () => (await this.prisma.user.findMany({
        where: { organizationId: user.organizationId, role: { in: ['ADMIN', 'TEACHER'] } },
        select: { id: true },
      })).map(({ id }) => id),
      NotificationType.RESOURCE_CHANGED,
      { title, link: '/resources' },
      { organizationId: user.organizationId, actorId: user.userId },
    );
  }

  /** Students of the cohort that owns `subjectId`, minus the actor. */
  private async notifySubjectStudents(subjectId: string, user: AuthUser, title: string, link: string) {
    await this.notifications?.emitMany(
      async () => (await this.prisma.courseMembership.findMany({
        where: {
          course: {
            organizationId: user.organizationId,
            subjects: { some: { id: subjectId, organizationId: user.organizationId, status: 'PUBLISHED' } },
          },
          user: { organizationId: user.organizationId, role: 'STUDENT' },
        },
        select: { userId: true },
      })).map(({ userId }) => userId),
      NotificationType.RESOURCE_CHANGED,
      { title, body: 'Hay material nuevo o actualizado en una asignatura.', link },
      { organizationId: user.organizationId, actorId: user.userId },
    );
  }
}
