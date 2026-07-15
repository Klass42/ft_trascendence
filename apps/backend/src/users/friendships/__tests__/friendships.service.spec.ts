import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { FriendshipsService } from '../friendships.service';
import type { PrismaService } from '@/prisma/prisma.service';

const mkPrisma = () => ({
  friendship: { findUnique: jest.fn(), update: jest.fn() },
}) as unknown as PrismaService;

const mockFriendship = {
  id: 'f1', requesterId: 'user-student-0001', addresseeId: 'user-admin-0001',
  status: 'PENDING' as const, createdAt: new Date(),
};

describe('FriendshipsService', () => {
  let service: FriendshipsService;
  let prisma: ReturnType<typeof mkPrisma>;

  beforeEach(() => { jest.clearAllMocks(); prisma = mkPrisma(); service = new FriendshipsService(prisma); });

  it('accepts a PENDING friendship (ACCEPTED)', async () => {
    (prisma.friendship.findUnique as jest.Mock).mockResolvedValue(mockFriendship);
    (prisma.friendship.update as jest.Mock).mockResolvedValue({ ...mockFriendship, status: 'ACCEPTED' });
    const r = await service.updateStatus('f1', 'ACCEPTED', 'user-admin-0001');
    expect(r.status).toBe('ACCEPTED');
    expect(prisma.friendship.update).toHaveBeenCalledWith({ where: { id: 'f1' }, data: { status: 'ACCEPTED' } });
  });

  it('blocks a PENDING friendship (BLOCKED)', async () => {
    (prisma.friendship.findUnique as jest.Mock).mockResolvedValue(mockFriendship);
    (prisma.friendship.update as jest.Mock).mockResolvedValue({ ...mockFriendship, status: 'BLOCKED' });
    const r = await service.updateStatus('f1', 'BLOCKED', 'user-admin-0001');
    expect(r.status).toBe('BLOCKED');
  });

  it('throws 403 if caller is not the addressee', async () => {
    (prisma.friendship.findUnique as jest.Mock).mockResolvedValue(mockFriendship);
    await expect(
      service.updateStatus('f1', 'ACCEPTED', 'user-student-0001'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws 400 for invalid transition (ACCEPTED→BLOCKED)', async () => {
    (prisma.friendship.findUnique as jest.Mock).mockResolvedValue({ ...mockFriendship, status: 'ACCEPTED' });
    await expect(
      service.updateStatus('f1', 'BLOCKED', 'user-admin-0001'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 404 if friendship not found', async () => {
    (prisma.friendship.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(
      service.updateStatus('f1', 'ACCEPTED', 'user-admin-0001'),
    ).rejects.toThrow(NotFoundException);
  });
});
