import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { PLATFORM_ROLES_KEY } from '@/common/auth/platform-roles.decorator';
import { PlatformController } from '../platform.controller';
import { PlatformService } from '../platform.service';

const mkService = () =>
  ({
    createOrganization: jest.fn(),
    listOrganizations: jest.fn(),
    getOrganization: jest.fn(),
    updateOrganization: jest.fn(),
    suspend: jest.fn(),
    deleteOrganization: jest.fn(),
  }) as unknown as PlatformService;

const superadmin = {
  userId: 'user-superadmin-0001',
  email: 'platform@klass',
  name: 'Platform Admin',
  avatarUrl: null,
  organizationId: '',
  role: 'STUDENT' as const,
  platformRole: 'SUPERADMIN' as const,
  emailNotificationsEnabled: true,
  preferredLanguage: 'es',
};

describe('PlatformController', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  describe('DELETE :id', () => {
    it('requires SUPERADMIN platform role', () => {
      const controller = new PlatformController(mkService());
      const roles = reflector.getAllAndOverride(PLATFORM_ROLES_KEY, [
        controller.remove,
        PlatformController,
      ]);
      expect(roles).toEqual(['SUPERADMIN']);
    });

    it('responds with 204 No Content', () => {
      const controller = new PlatformController(mkService());
      const code = Reflect.getMetadata(HTTP_CODE_METADATA, controller.remove);
      expect(code).toBe(204);
    });

    it('calls deleteOrganization with id and actor id', async () => {
      const service = mkService();
      const controller = new PlatformController(service);
      await controller.remove('org-klass-0001', superadmin);
      expect(service.deleteOrganization).toHaveBeenCalledWith(
        'org-klass-0001',
        'user-superadmin-0001',
      );
    });
  });
});
