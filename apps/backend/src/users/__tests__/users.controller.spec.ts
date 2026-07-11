import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@/common/auth/roles.decorator';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';

const mkService = () =>
  ({
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  }) as unknown as UsersService;

const admin = {
  userId: 'user-admin-0001',
  organizationId: 'org-klass-0001',
  role: 'ADMIN' as const,
} as any;

describe('UsersController', () => {
  const reflector = new Reflector();

  it('findAll requires ADMIN role', () => {
    const ctrl = new UsersController(mkService());
    const roles = reflector.getAllAndOverride(ROLES_KEY, [
      ctrl.findAll,
      UsersController,
    ]);
    expect(roles).toEqual(['ADMIN']);
  });

  it('findOne requires ADMIN role', () => {
    const ctrl = new UsersController(mkService());
    const roles = reflector.getAllAndOverride(ROLES_KEY, [
      ctrl.findOne,
      UsersController,
    ]);
    expect(roles).toEqual(['ADMIN']);
  });

  it('create requires ADMIN role', () => {
    const ctrl = new UsersController(mkService());
    const roles = reflector.getAllAndOverride(ROLES_KEY, [
      ctrl.create,
      UsersController,
    ]);
    expect(roles).toEqual(['ADMIN']);
  });

  it('update requires ADMIN role', () => {
    const ctrl = new UsersController(mkService());
    const roles = reflector.getAllAndOverride(ROLES_KEY, [
      ctrl.update,
      UsersController,
    ]);
    expect(roles).toEqual(['ADMIN']);
  });

  it('remove requires ADMIN role', () => {
    const ctrl = new UsersController(mkService());
    const roles = reflector.getAllAndOverride(ROLES_KEY, [
      ctrl.remove,
      UsersController,
    ]);
    expect(roles).toEqual(['ADMIN']);
  });

  it('findAll calls service with user.organizationId', async () => {
    const svc = mkService();
    await new UsersController(svc).findAll(admin);
    expect(svc.findAll).toHaveBeenCalledWith('org-klass-0001');
  });

  it('create calls service with dto + user.organizationId', async () => {
    const svc = mkService();
    await new UsersController(svc).create({ email: 'n@demo', password: 'Pw1', name: 'N' } as any, admin);
    expect(svc.create).toHaveBeenCalledWith(expect.any(Object), 'org-klass-0001');
  });

  it('remove calls service with id, orgId, callerUserId', async () => {
    const svc = mkService();
    await new UsersController(svc).remove('user-student-0001', admin);
    expect(svc.remove).toHaveBeenCalledWith('user-student-0001', 'org-klass-0001', 'user-admin-0001');
  });
});
