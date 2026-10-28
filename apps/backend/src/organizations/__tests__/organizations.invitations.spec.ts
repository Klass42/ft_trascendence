import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrganizationsService, escapeLike, parseCsv } from '../organizations.service';
import type { PrismaService } from '@/prisma/prisma.service';

function setup() {
  const prisma = {
    user: { findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    organizationInvitation: {
      findUnique: jest.fn(async () => null),
      findFirst: jest.fn(),
      findMany: jest.fn(async () => []),
      upsert: jest.fn(async ({ create }: any) => ({ id: 'inv-1', ...create })),
    },
    auditLog: { create: jest.fn() },
  };
  const service = new OrganizationsService(prisma as unknown as PrismaService, { emitMany: jest.fn() } as never);
  return { prisma, service };
}

describe('search escaping (#108)', () => {
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b');
  });

  it('passes the escaped term to Prisma', async () => {
    const { service, prisma } = setup();
    await service.findMembers('org1', 'org1', { q: '%' });
    const where = (prisma.user.findMany.mock.calls[0] as any)[0].where;
    expect(JSON.stringify(where)).toContain('"contains":"\\\\%"');
  });
});

describe('parseCsv', () => {
  it('handles quotes, CRLF, BOM, semicolons and blank lines', () => {
    expect(parseCsv('\uFEFFemail,name,role\r\n"a@b","Pérez, Ana",STUDENT\n\nc@d;Bo;TEACHER\n')).toEqual([
      ['email', 'name', 'role'], ['a@b', 'Pérez, Ana', 'STUDENT'], ['c@d', 'Bo', 'TEACHER'],
    ]);
  });
});

describe('invitations (#108)', () => {
  it('warns when re-inviting replaces a live pending link', async () => {
    const { service, prisma } = setup();
    prisma.organizationInvitation.findUnique.mockResolvedValueOnce({ status: 'PENDING', expiresAt: new Date(Date.now() + 1e6) } as never);
    const result = await service.invite('org1', 'admin', { email: 'X@Demo', role: 'STUDENT' });
    expect(result.replacedPending).toBe(true);
    expect(result.email).toBe('x@demo');
  });

  it('lists pending invitations flagging expired ones', async () => {
    const { service, prisma } = setup();
    prisma.organizationInvitation.findMany.mockResolvedValueOnce([
      { id: 'a', expiresAt: new Date(Date.now() - 1000) }, { id: 'b', expiresAt: new Date(Date.now() + 1e6) },
    ] as never);
    const rows = await service.listInvitations('org1');
    expect(rows.map((r) => r.expired)).toEqual([true, false]);
  });

  it('resend 404s when the invitation is not pending and re-issues otherwise', async () => {
    const { service, prisma } = setup();
    prisma.organizationInvitation.findFirst.mockResolvedValueOnce(null);
    await expect(service.resendInvitation('org1', 'inv', 'admin')).rejects.toBeInstanceOf(NotFoundException);
    prisma.organizationInvitation.findFirst.mockResolvedValueOnce({ email: 'a@b', role: 'TEACHER' });
    const result = await service.resendInvitation('org1', 'inv', 'admin');
    expect(result.invitationToken).toEqual(expect.any(String));
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'INVITATION_RESENT' }) });
  });
});

describe('CSV import (#108)', () => {
  it('reports per-row errors and creates valid rows', async () => {
    const { service, prisma } = setup();
    prisma.user.findFirst.mockImplementation((async (args: any) => (args.where.email.equals === 'taken@demo' ? { id: 'u' } : null)) as never);
    const csv = 'email,name,role\nok@demo,Ok,student\nbad,Bad,STUDENT\nx@demo,X,BOSS\nok@demo,Dup,TEACHER\ntaken@demo,T,ADMIN\n';
    const report = await service.importInvitations('org1', 'admin', csv);
    expect(report).toMatchObject({ total: 5, created: 1, failed: 4 });
    expect(report.results.map((r) => [r.line, r.ok])).toEqual([[2, true], [3, false], [4, false], [5, false], [6, false]]);
    expect(report.results[4].error).toMatch(/ya pertenece/);
    expect(prisma.auditLog.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ action: 'INVITATIONS_IMPORTED' }) });
  });

  it('rejects a header without email/role', async () => {
    await expect(setup().service.importInvitations('org1', 'admin', 'foo,bar\n1,2')).rejects.toBeInstanceOf(BadRequestException);
  });
});
