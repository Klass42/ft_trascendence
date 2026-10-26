import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@/common/auth/roles.decorator';
import { RolesGuard } from '@/common/auth/roles.guard';
import { OrganizationsController } from '../organizations.controller';
import { OrganizationsService } from '../organizations.service';

const mkService = () =>
  ({
    findMyOrganization: jest.fn(),
    update: jest.fn(),
    findMembers: jest.fn(),
    removeMember: jest.fn(),
    requestDeletion: jest.fn(),
    getDeletionRequestStatus: jest.fn(),
  }) as unknown as OrganizationsService;

const adminUser = {
  userId: 'user-admin-0001',
  email: 'admin@demo',
  name: 'Ada Admin',
  avatarUrl: null,
  organizationId: 'org-klass-0001',
  role: 'ADMIN' as const,
  emailNotificationsEnabled: true,
  preferredLanguage: 'es',
};

describe('OrganizationsController', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  describe('route metadata', () => {
    it('GET /me has no @Roles decorator', () => {
      const controller = new OrganizationsController(mkService());
      const roles = reflector.getAllAndOverride(ROLES_KEY, [
        controller.findMine,
        OrganizationsController,
      ]);
      expect(roles).toBeUndefined();
    });

    it('PATCH :id requires ADMIN role', () => {
      const controller = new OrganizationsController(mkService());
      const roles = reflector.getAllAndOverride(ROLES_KEY, [
        controller.update,
        OrganizationsController,
      ]);
      expect(roles).toEqual(['ADMIN']);
    });

    it('GET :id/members requires ADMIN role', () => {
      const controller = new OrganizationsController(mkService());
      const roles = reflector.getAllAndOverride(ROLES_KEY, [
        controller.findMembers,
        OrganizationsController,
      ]);
      expect(roles).toEqual(['ADMIN']);
    });

    it('GET /me/deletion-request requires ADMIN role', () => {
      const controller = new OrganizationsController(mkService());
      const roles = reflector.getAllAndOverride(ROLES_KEY, [
        controller.getDeletionRequestStatus,
        OrganizationsController,
      ]);
      expect(roles).toEqual(['ADMIN']);
    });

    it('DELETE :id/members/:userId requires ADMIN role', () => {
      const controller = new OrganizationsController(mkService());
      const roles = reflector.getAllAndOverride(ROLES_KEY, [
        controller.removeMember,
        OrganizationsController,
      ]);
      expect(roles).toEqual(['ADMIN']);
    });

    it('POST /me/deletion-request requires ADMIN role', () => {
      const controller = new OrganizationsController(mkService());
      const roles = reflector.getAllAndOverride(ROLES_KEY, [
        controller.requestDeletion,
        OrganizationsController,
      ]);
      expect(roles).toEqual(['ADMIN']);
    });
  });

  describe('endpoint behavior', () => {
    it('GET /me calls findMyOrganization with user.organizationId', async () => {
      const service = mkService();
      const controller = new OrganizationsController(service);
      await controller.findMine(adminUser);
      expect(service.findMyOrganization).toHaveBeenCalledWith('org-klass-0001');
    });

    it('PATCH :id calls update with id, dto, user.organizationId', async () => {
      const service = mkService();
      const controller = new OrganizationsController(service);
      await controller.update('org-klass-0001', { name: 'New' }, adminUser);
      expect(service.update).toHaveBeenCalledWith(
        'org-klass-0001',
        { name: 'New' },
        'org-klass-0001',
        adminUser.userId,
      );
    });

    it('GET :id/members calls findMembers with id, user.organizationId', async () => {
      const service = mkService();
      const controller = new OrganizationsController(service);
      const query = { q: 'ada', page: 2, pageSize: 25 };
      await controller.findMembers('org-klass-0001', adminUser, query);
      expect(service.findMembers).toHaveBeenCalledWith('org-klass-0001', 'org-klass-0001', query);
    });

    it('GET /me/deletion-request uses the caller organization', async () => {
      const service = mkService();
      const controller = new OrganizationsController(service);
      await controller.getDeletionRequestStatus(adminUser);
      expect(service.getDeletionRequestStatus).toHaveBeenCalledWith('org-klass-0001');
    });

    it('DELETE :id/members/:userId calls removeMember with all params', async () => {
      const service = mkService();
      const controller = new OrganizationsController(service);
      await controller.removeMember('org-klass-0001', 'user-student-0001', adminUser);
      expect(service.removeMember).toHaveBeenCalledWith(
        'org-klass-0001',
        'user-student-0001',
        'org-klass-0001',
        'user-admin-0001',
      );
    });

    it('POST /me/deletion-request uses the caller tenant and identity', async () => {
      const service = mkService();
      const controller = new OrganizationsController(service);
      await controller.requestDeletion(adminUser);
      expect(service.requestDeletion).toHaveBeenCalledWith('org-klass-0001', {
        userId: 'user-admin-0001',
        name: 'Ada Admin',
        email: 'admin@demo',
      });
    });
  });

  describe('admin-only endpoints', () => {
    it.each(['findMembers', 'getDeletionRequestStatus'] as const)(
      '%s denies teacher and student roles through RolesGuard',
      (method) => {
        const controller = new OrganizationsController(mkService());
        const guard = new RolesGuard(reflector);
        expect(Reflect.getMetadata(GUARDS_METADATA, controller[method])).toContain(RolesGuard);
        for (const role of ['TEACHER', 'STUDENT'] as const) {
          const context = {
            getHandler: () => controller[method],
            getClass: () => OrganizationsController,
            switchToHttp: () => ({ getRequest: () => ({ user: { ...adminUser, role } }) }),
          } as unknown as ExecutionContext;

          expect(guard.canActivate(context)).toBe(false);
        }
      },
    );
  });
});
