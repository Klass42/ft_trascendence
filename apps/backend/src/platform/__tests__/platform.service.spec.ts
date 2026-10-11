import { NotFoundException } from '@nestjs/common';
import { PlatformService } from '../platform.service';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG_ID = 'org-klass-0001';
const ACTOR_ID = 'user-superadmin-0001';

const mockOrg = {
  id: ORG_ID,
  name: 'Klass Academy',
  slug: 'klass',
  logoUrl: null,
  status: 'ACTIVE' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function mkPrisma() {
  const prisma: {
    organization: { findUnique: jest.Mock; delete: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  } = {
    organization: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
    fn(prisma),
  );
  return prisma as unknown as PrismaService & typeof prisma;
}

describe('PlatformService', () => {
  let service: PlatformService;
  let prisma: ReturnType<typeof mkPrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = mkPrisma();
    service = new PlatformService(prisma);
  });

  describe('deleteOrganization', () => {
    it('hard-deletes the organization and writes ORGANIZATION_DELETED', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockOrg);
      prisma.organization.delete.mockResolvedValue(mockOrg);
      prisma.auditLog.create.mockResolvedValue({});

      await service.deleteOrganization(ORG_ID, ACTOR_ID);

      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: ORG_ID },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: ACTOR_ID,
          action: 'ORGANIZATION_DELETED',
          organizationId: ORG_ID,
          metadata: { name: mockOrg.name, slug: mockOrg.slug },
        }),
      });
      expect(prisma.organization.delete).toHaveBeenCalledWith({
        where: { id: ORG_ID },
      });
    });

    it('throws NotFoundException when the organization does not exist', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteOrganization('ghost', ACTOR_ID),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.organization.delete).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });
});
