import { ForbiddenException } from '@nestjs/common';
import { assertCourseLimit, assertStorageLimit, assertUserLimit } from '../plan-limits';

const db = (org: any, counts: { users?: number; courses?: number; bytes?: number } = {}) => ({
  organization: { findUnique: jest.fn().mockResolvedValue(org) },
  user: { count: jest.fn().mockResolvedValue(counts.users ?? 0) },
  course: { count: jest.fn().mockResolvedValue(counts.courses ?? 0) },
  file: { aggregate: jest.fn().mockResolvedValue({ _sum: { sizeBytes: BigInt(counts.bytes ?? 0) } }) },
});

describe('plan limits (#106)', () => {
  it('null limits are unlimited', async () => {
    const d = db({ maxUsers: null, maxCourses: null, maxStorageMb: null }, { users: 999 });
    await expect(assertUserLimit(d, 'o')).resolves.toBeUndefined();
    await expect(assertCourseLimit(d, 'o')).resolves.toBeUndefined();
    await expect(assertStorageLimit(d, 'o', 1e12)).resolves.toBeUndefined();
  });
  it('maxUsers=1 blocks a second user', async () => {
    await expect(assertUserLimit(db({ maxUsers: 1 }, { users: 1 }), 'o')).rejects.toThrow(ForbiddenException);
    await expect(assertUserLimit(db({ maxUsers: 2 }, { users: 1 }), 'o')).resolves.toBeUndefined();
  });
  it('maxCourses enforced', async () => {
    await expect(assertCourseLimit(db({ maxCourses: 3 }, { courses: 3 }), 'o')).rejects.toThrow(/límite de cohortes/);
  });
  it('maxStorageMb enforced with incoming size', async () => {
    const mb = 1024 * 1024;
    await expect(assertStorageLimit(db({ maxStorageMb: 10 }, { bytes: 9 * mb }), 'o', 2 * mb)).rejects.toThrow(/almacenamiento/);
    await expect(assertStorageLimit(db({ maxStorageMb: 10 }, { bytes: 9 * mb }), 'o', mb)).resolves.toBeUndefined();
  });
});
