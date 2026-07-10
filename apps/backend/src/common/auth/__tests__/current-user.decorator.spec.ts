import { ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { currentUserFactory } from '../current-user.decorator';
import type { AuthUser } from '../auth-user.type';

describe('currentUserFactory (@CurrentUser)', () => {
  it('returns req.user when present', () => {
    const user: AuthUser = {
      userId: 'user-1', email: 'a@b.co', name: 'A',
      avatarUrl: null, organizationId: 'org-1', role: 'STUDENT',
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
    expect(currentUserFactory(undefined, ctx)).toEqual(user);
  });

  it('throws InternalServerErrorException when req.user is undefined (forgot to apply a guard)', () => {
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;
    expect(() => currentUserFactory(undefined, ctx)).toThrow(InternalServerErrorException);
    expect(() => currentUserFactory(undefined, ctx)).toThrow(/@CurrentUser/);
  });
});
