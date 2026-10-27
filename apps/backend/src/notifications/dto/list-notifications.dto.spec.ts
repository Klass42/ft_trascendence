import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListNotificationsDto } from './list-notifications.dto';

async function parse(query: Record<string, string>) {
  const dto = plainToInstance(ListNotificationsDto, query);
  return { dto, errors: await validate(dto, { whitelist: true, forbidNonWhitelisted: true }) };
}

describe('ListNotificationsDto', () => {
  it('defaults to the first page of 20 and keeps the old query shape valid', async () => {
    const { dto, errors } = await parse({});
    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({ page: 1, pageSize: 20 });
    expect(dto.unreadOnly).toBeUndefined();
  });

  it('coerces page, pageSize and unreadOnly from query strings', async () => {
    const { dto, errors } = await parse({ page: '2', pageSize: '50', unreadOnly: 'true' });
    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({ page: 2, pageSize: 50, unreadOnly: true });
    expect((await parse({ unreadOnly: 'false' })).dto.unreadOnly).toBe(false);
  });

  it.each<Record<string, string>>([
    { page: '0' },
    { page: 'x' },
    { pageSize: '0' },
    { pageSize: '101' },
    { unreadOnly: 'yes' },
    { unreadOnly: '1' },
  ])('rejects %o', async (query) => {
    expect((await parse(query)).errors.length).toBeGreaterThan(0);
  });
});
