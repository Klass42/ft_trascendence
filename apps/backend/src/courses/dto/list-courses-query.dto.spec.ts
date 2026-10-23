import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListCoursesQueryDto } from './list-courses-query.dto';

describe('ListCoursesQueryDto', () => {
  const check = (query: Record<string, string>) =>
    validate(plainToInstance(ListCoursesQueryDto, query), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

  it('keeps accepting the legacy organizationId that older clients still send', async () => {
    expect(await check({ organizationId: 'org-klass-0001', status: 'ACTIVE' })).toHaveLength(0);
  });

  it('still rejects unknown parameters and invalid statuses', async () => {
    expect(await check({ unknown: 'x' })).not.toHaveLength(0);
    expect(await check({ status: 'DELETED' })).not.toHaveLength(0);
  });
});
