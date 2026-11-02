import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from './realtime.gateway';
import {
  ORGANIZATION_SUSPENDED,
  USER_DEACTIVATED,
} from './realtime.events';

// Pure unit tests (no sockets, no DB): Prisma, JWT and the Socket.io server are
// mocked. The wire-level flow lives in realtime.gateway.spec.ts (integration).
describe('RealtimeGateway access control', () => {
  const SECRET = 'test-access-secret';
  const jwt = new JwtService({ secret: SECRET });
  const config = { getOrThrow: () => SECRET } as unknown as ConfigService;

  let user: { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
  let gateway: RealtimeGateway;
  let disconnectSockets: jest.Mock;
  let server: { in: jest.Mock; to: jest.Mock };

  function makeClient(userId = 'u1') {
    return {
      id: 'sock-1',
      data: {} as Record<string, unknown>,
      handshake: { auth: { token: jwt.sign({ sub: userId }) }, headers: {} },
      join: jest.fn(async () => undefined),
      disconnect: jest.fn(),
    };
  }
  const asSocket = (c: ReturnType<typeof makeClient>) => c as unknown as Socket;

  beforeEach(() => {
    user = {
      findUnique: jest.fn(),
      update: jest.fn(async () => ({})),
      findMany: jest.fn(async () => []),
    };
    const prisma = { user, friendship: { findMany: jest.fn(async () => []) } };
    gateway = new RealtimeGateway(prisma as unknown as PrismaService, jwt, config);
    disconnectSockets = jest.fn();
    server = {
      in: jest.fn(() => ({ disconnectSockets })),
      to: jest.fn(() => ({ emit: jest.fn() })),
    };
    (gateway as unknown as { server: unknown }).server = server;
  });

  describe('handleConnection', () => {
    it('accepts a user of an active organization and joins user + org rooms', async () => {
      user.findUnique.mockResolvedValue({ organizationId: 'org1', organization: { status: 'ACTIVE' } });
      const client = makeClient();
      await gateway.handleConnection(asSocket(client));

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.join).toHaveBeenCalledWith('user:u1');
      expect(client.join).toHaveBeenCalledWith('org:org1');
      expect(client.data.userId).toBe('u1');
      expect(gateway.isOnline('u1')).toBe(true);
    });

    it('rejects a user of a suspended organization', async () => {
      user.findUnique.mockResolvedValue({ organizationId: 'org1', organization: { status: 'SUSPENDED' } });
      const client = makeClient();
      await gateway.handleConnection(asSocket(client));

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
      expect(client.data.userId).toBeUndefined();
      expect(gateway.isOnline('u1')).toBe(false);
    });

    it('rejects a user that no longer exists', async () => {
      user.findUnique.mockResolvedValue(null);
      const client = makeClient();
      await gateway.handleConnection(asSocket(client));

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('fails closed when the access check query throws', async () => {
      user.findUnique.mockRejectedValue(new Error('db down'));
      const client = makeClient();
      await gateway.handleConnection(asSocket(client));

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('keeps accepting platform users without an organization', async () => {
      user.findUnique.mockResolvedValue({ organizationId: null, organization: null });
      const client = makeClient();
      await gateway.handleConnection(asSocket(client));

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.join).toHaveBeenCalledWith('user:u1');
      expect(client.join).toHaveBeenCalledTimes(1);
    });

    it('still rejects an invalid token before touching the database', async () => {
      const client = makeClient();
      client.handshake.auth = { token: 'garbage' };
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await gateway.handleConnection(asSocket(client));
      } finally {
        process.env.NODE_ENV = prev;
      }

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('revocation events', () => {
    it('exposes the documented event names', () => {
      expect(ORGANIZATION_SUSPENDED).toBe('organization.suspended');
      expect(USER_DEACTIVATED).toBe('user.deactivated');
    });

    it('organization.suspended disconnects the whole org room', () => {
      gateway.handleOrganizationSuspended({ organizationId: 'org1' });
      expect(server.in).toHaveBeenCalledWith('org:org1');
      expect(disconnectSockets).toHaveBeenCalledWith(true);
    });

    it('user.deactivated disconnects only that user room', () => {
      gateway.handleUserDeactivated({ userId: 'u1' });
      expect(server.in).toHaveBeenCalledWith('user:u1');
      expect(disconnectSockets).toHaveBeenCalledWith(true);
    });
  });
});
