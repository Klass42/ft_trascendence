import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FriendshipsService } from '../friendships.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { NotificationsService } from '@/notifications/notifications.service';

const ORG_ID = 'org-klass-0001';
const OTHER_ORG = 'org-other-0001';
const requesterId = 'user-requester';
const addresseeId = 'user-addressee';
const friendId = 'user-friend';

const pendingFriendship = {
  id: 'friendship-1',
  requesterId,
  addresseeId,
  status: 'PENDING' as const,
  createdAt: new Date(),
};

const mkPrisma = () => ({
  friendship: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
}) as unknown as PrismaService;

describe('FriendshipsService', () => {
  let service: FriendshipsService;
  let prisma: ReturnType<typeof mkPrisma>;
  let notifications: { emit: jest.Mock; emitMany: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = mkPrisma();
    notifications = { emit: jest.fn().mockResolvedValue({}), emitMany: jest.fn().mockResolvedValue(undefined) };
    service = new FriendshipsService(prisma, notifications as unknown as NotificationsService);
  });

  it('lists accepted friends and pending requests in both directions within the organization', async () => {
    (prisma.friendship.findMany as jest.Mock).mockResolvedValue([
      {
        ...pendingFriendship,
        requester: { id: requesterId, name: 'Rita', avatarUrl: null },
        addressee: { id: addresseeId, name: 'Alex', avatarUrl: '/avatar' },
      },
      {
        ...pendingFriendship,
        id: 'friendship-2',
        requesterId: addresseeId,
        addresseeId: requesterId,
        requester: { id: addresseeId, name: 'Alex', avatarUrl: '/avatar' },
        addressee: { id: requesterId, name: 'Rita', avatarUrl: null },
      },
      {
        ...pendingFriendship,
        id: 'friendship-3',
        status: 'ACCEPTED',
        requesterId: friendId,
        addresseeId: requesterId,
        requester: { id: friendId, name: 'Morgan', avatarUrl: null },
        addressee: { id: requesterId, name: 'Rita', avatarUrl: null },
      },
    ]);

    const result = await service.listMine(requesterId, ORG_ID);

    expect(result.receivedRequests).toEqual([
      { friendshipId: 'friendship-2', id: addresseeId, name: 'Alex', avatarUrl: '/avatar' },
    ]);
    expect(result.friends).toEqual([
      { friendshipId: 'friendship-3', id: friendId, name: 'Morgan', avatarUrl: null },
    ]);
    expect(result.sentRequests).toEqual([
      { friendshipId: 'friendship-1', id: addresseeId, name: 'Alex', avatarUrl: '/avatar' },
    ]);
    const args = (prisma.friendship.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.requester.is.organizationId).toBe(ORG_ID);
    expect(args.where.addressee.is.organizationId).toBe(ORG_ID);
  });

  it('accepts a pending request only for its addressee and notifies the requester', async () => {
    (prisma.friendship.findFirst as jest.Mock).mockResolvedValue(pendingFriendship);
    (prisma.friendship.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.friendship.findFirst as jest.Mock)
      .mockResolvedValueOnce(pendingFriendship)
      .mockResolvedValueOnce({ ...pendingFriendship, status: 'ACCEPTED' });

    const result = await service.updateStatus('friendship-1', 'ACCEPTED', addresseeId, ORG_ID);

    expect(result?.status).toBe('ACCEPTED');
    expect(prisma.friendship.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'friendship-1',
        requester: { is: { organizationId: ORG_ID } },
        addressee: { is: { organizationId: ORG_ID } },
      },
    });
    expect(notifications.emit).toHaveBeenCalledWith(requesterId, 'FRIEND_REQUEST', {
      title: 'Solicitud de amistad aceptada',
      body: 'Tu solicitud de amistad ha sido aceptada.',
      link: '/friends',
    });
    expect(prisma.friendship.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'friendship-1',
        status: 'PENDING',
        requester: { is: { organizationId: ORG_ID } },
        addressee: { is: { organizationId: ORG_ID } },
      },
      data: { status: 'ACCEPTED' },
    });
  });

  it('rejects attempts to accept another user’s request', async () => {
    (prisma.friendship.findFirst as jest.Mock).mockResolvedValue(pendingFriendship);

    await expect(service.updateStatus('friendship-1', 'ACCEPTED', requesterId, ORG_ID))
      .rejects.toThrow(ForbiddenException);
    expect(prisma.friendship.updateMany).not.toHaveBeenCalled();
  });

  it('cannot accept a friendship whose participants belong to different organizations', async () => {
    (prisma.friendship.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.updateStatus('friendship-1', 'ACCEPTED', addresseeId, ORG_ID))
      .rejects.toThrow(NotFoundException);
    expect(prisma.friendship.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        requester: { is: { organizationId: ORG_ID } },
        addressee: { is: { organizationId: ORG_ID } },
      }),
    }));
    expect(prisma.friendship.updateMany).not.toHaveBeenCalled();
  });

  it('rejects invalid status transitions', async () => {
    (prisma.friendship.findFirst as jest.Mock).mockResolvedValue({ ...pendingFriendship, status: 'ACCEPTED' });

    await expect(service.updateStatus('friendship-1', 'BLOCKED', addresseeId, ORG_ID))
      .rejects.toThrow(BadRequestException);
  });

  it('allows a participant to cancel, reject, or remove a friendship', async () => {
    (prisma.friendship.findFirst as jest.Mock).mockResolvedValue(pendingFriendship);
    (prisma.friendship.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

    await expect(service.remove('friendship-1', requesterId, ORG_ID)).resolves.toEqual({ deleted: true });
    expect(prisma.friendship.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'friendship-1',
        requester: { is: { organizationId: ORG_ID } },
        addressee: { is: { organizationId: ORG_ID } },
      },
    });
  });

  it('tells the other person when a request is cancelled, rejected or a friendship ends', async () => {
    (prisma.friendship.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

    (prisma.friendship.findFirst as jest.Mock).mockResolvedValue(pendingFriendship);
    await service.remove('friendship-1', requesterId, ORG_ID);
    expect(notifications.emitMany).toHaveBeenLastCalledWith(
      [addresseeId], 'FRIEND_REQUEST', expect.objectContaining({ title: 'Solicitud de amistad cancelada' }),
      { organizationId: ORG_ID, actorId: requesterId },
    );

    await service.remove('friendship-1', addresseeId, ORG_ID);
    expect(notifications.emitMany).toHaveBeenLastCalledWith(
      [requesterId], 'FRIEND_REQUEST', expect.objectContaining({ title: 'Solicitud de amistad rechazada' }),
      { organizationId: ORG_ID, actorId: addresseeId },
    );

    (prisma.friendship.findFirst as jest.Mock).mockResolvedValue({ ...pendingFriendship, status: 'ACCEPTED' });
    await service.remove('friendship-1', addresseeId, ORG_ID);
    expect(notifications.emitMany).toHaveBeenLastCalledWith(
      [requesterId], 'FRIEND_REQUEST', expect.objectContaining({ title: 'Una amistad ha terminado' }),
      { organizationId: ORG_ID, actorId: addresseeId },
    );
  });

  it('never announces the removal of a blocked relation', async () => {
    (prisma.friendship.findFirst as jest.Mock).mockResolvedValue({ ...pendingFriendship, status: 'BLOCKED' });
    (prisma.friendship.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    await service.remove('friendship-1', addresseeId, ORG_ID);
    expect(notifications.emitMany).not.toHaveBeenCalled();
  });

  it('does not expose or delete a friendship from another organization', async () => {
    (prisma.friendship.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.remove('friendship-1', requesterId, OTHER_ORG)).rejects.toThrow(NotFoundException);
    expect(prisma.friendship.deleteMany).not.toHaveBeenCalled();
  });
});
