import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { PLATFORM_ROLES_KEY } from '@/common/auth/platform-roles.decorator';
import { PlatformController } from '../platform.controller';
import { PlatformService } from '../platform.service';
import type { AuthUser } from '@/common/auth';

const mkService = () =>
  ({
    createOrganization: jest.fn(),
    listOrganizations: jest.fn(),
    getOrganization: jest.fn(),
    updateOrganization: jest.fn(),
    suspend: jest.fn(),
    inviteAdmin: jest.fn(),
  }) as unknown as PlatformService;

const superadmin: AuthUser = {
  userId: 'user-superadmin-0001',
  email: 'superadmin@klass.demo',
  name: 'Super Admin',
  avatarUrl: null,
  organizationId: '',
  role: 'STUDENT',
  platformRole: 'SUPERADMIN',
  emailNotificationsEnabled: true,
  preferredLanguage: 'es',
};

describe('PlatformController', () => {
  it('requires the SUPERADMIN platform role on the whole controller', () => {
    const reflector = new Reflector();
    const roles = reflector.getAllAndOverride(PLATFORM_ROLES_KEY, [PlatformController]);
    expect(roles).toEqual(['SUPERADMIN']);
  });

  it('POST :id/admins calls inviteAdmin with id, dto, actor id', async () => {
    const service = mkService();
    const controller = new PlatformController(service);
    await controller.inviteAdmin('org-klass-0001', { email: 'recovery-admin@klass.demo' } as any, superadmin);
    expect(service.inviteAdmin).toHaveBeenCalledWith(
      'org-klass-0001',
      { email: 'recovery-admin@klass.demo' },
      'user-superadmin-0001',
    );
  });

  it('PATCH :id calls updateOrganization with id, dto, actor id', async () => {
    const service = mkService();
    const controller = new PlatformController(service);
    await controller.update('org-klass-0001', { plan: 'ENTERPRISE' } as any, superadmin);
    expect(service.updateOrganization).toHaveBeenCalledWith(
      'org-klass-0001',
      { plan: 'ENTERPRISE' },
      'user-superadmin-0001',
    );
  });
});
