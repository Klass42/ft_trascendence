import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { CoursesController } from '../courses.controller';
import { CoursesService } from '../courses.service';
import { RolesGuard } from '@/common/auth/roles.guard';

const admin = {
  userId: 'admin-1',
  email: 'admin@example.test',
  name: 'Admin',
  avatarUrl: null,
  organizationId: 'org-1',
  role: 'ADMIN' as const,
  emailNotificationsEnabled: true,
  preferredLanguage: 'es',
};

const serviceStub = () => ({
  update: jest.fn(),
  delete: jest.fn(),
  updateSubject: jest.fn(),
  deleteSubject: jest.fn(),
}) as unknown as CoursesService;

describe('CoursesController management routes', () => {
  const routes = [
    ['PATCH /courses/:id', 'update'],
    ['DELETE /courses/:id', 'delete'],
    ['PATCH /subjects/:subjectId', 'updateSubject'],
    ['DELETE /subjects/:subjectId', 'deleteSubject'],
  ] as const;

  it.each(routes)('%s delegates to its tenant-aware service method', async (_route, method) => {
    const service = serviceStub();
    const controller = new CoursesController(service);

    if (method === 'update') {
      const dto = { name: '2º B' };
      await controller.update('course-1', dto, admin);
      expect(service.update).toHaveBeenCalledWith('course-1', admin, dto);
    } else if (method === 'delete') {
      await controller.delete('course-1', admin);
      expect(service.delete).toHaveBeenCalledWith('course-1', admin);
    } else if (method === 'updateSubject') {
      const dto = { title: 'Historia' };
      await controller.updateSubject('subject-1', dto, admin);
      expect(service.updateSubject).toHaveBeenCalledWith('subject-1', admin, dto);
    } else {
      await controller.deleteSubject('subject-1', admin);
      expect(service.deleteSubject).toHaveBeenCalledWith('subject-1', admin);
    }
  });

  it.each(routes)('%s rejects teacher and student roles with the route guard', (_route, method) => {
    const reflector = new Reflector();
    const controller = new CoursesController(serviceStub());
    const handler = controller[method];
    const guard = new RolesGuard(reflector);
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(RolesGuard);

    for (const role of ['TEACHER', 'STUDENT'] as const) {
      const context = {
        getHandler: () => handler,
        getClass: () => CoursesController,
        switchToHttp: () => ({ getRequest: () => ({ user: { ...admin, role } }) }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(context)).toBe(false);
    }
  });
});
