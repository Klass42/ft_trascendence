import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateResourceDto } from './create-resource.dto';
import { UpdateResourceDto } from './update-resource.dto';

/** #109: only http(s) links, with a Spanish message tied to externalUrl. */
describe('resource externalUrl validation', () => {
  const errorsFor = (cls: typeof CreateResourceDto | typeof UpdateResourceDto, externalUrl: unknown) =>
    validateSync(plainToInstance(cls, { title: 'T', type: 'LINK', externalUrl }) as object)
      .filter((e) => e.property === 'externalUrl');

  it.each(['javascript:alert(1)', 'data:text/html,hi', 'ftp://host/file', 'ejemplo.com/x'])('rejects %s', (url) => {
    for (const cls of [CreateResourceDto, UpdateResourceDto]) {
      const errors = errorsFor(cls, url);
      expect(errors).toHaveLength(1);
      expect(Object.values(errors[0].constraints ?? {})[0]).toMatch(/URL del enlace/);
    }
  });

  it.each(['https://ejemplo.com/recurso', 'http://intranet/doc'])('accepts %s', (url) => {
    expect(errorsFor(CreateResourceDto, url)).toHaveLength(0);
    expect(errorsFor(UpdateResourceDto, url)).toHaveLength(0);
  });
});
