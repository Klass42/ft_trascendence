import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePostDto } from './create-post.dto';
import { CreateThreadDto } from './create-thread.dto';
import { UpdatePostDto } from './update-post.dto';
import { UpdateThreadDto } from './update-thread.dto';

async function messages<T extends object>(Dto: new () => T, plain: Record<string, unknown>) {
  const errors = await validate(plainToInstance(Dto, plain));
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('forum DTOs', () => {
  it.each([
    ['thread title', CreateThreadDto, { title: '   ' }, 'El título no puede estar vacío.'],
    ['thread opening message', CreateThreadDto, { title: 'Hola', body: '  \n ' }, 'El mensaje no puede estar vacío.'],
    ['thread rename', UpdateThreadDto, { title: '\t' }, 'El título no puede estar vacío.'],
    ['post body', CreatePostDto, { body: '   ' }, 'El mensaje no puede estar vacío.'],
    ['post edit', UpdatePostDto, { body: ' ' }, 'El mensaje no puede estar vacío.'],
  ])('rejects whitespace-only %s', async (_label, Dto, plain, message) => {
    expect(await messages(Dto as new () => object, plain)).toContain(message);
  });

  it('trims accepted values and keeps the opening message optional', async () => {
    const thread = plainToInstance(CreateThreadDto, { title: '  Duda  ' });
    expect(await validate(thread)).toHaveLength(0);
    expect(thread.title).toBe('Duda');
    expect(await messages(UpdatePostDto, { body: ' ok ' })).toEqual([]);
  });

  it('enforces 200 for titles and 5000 for bodies after trimming', async () => {
    expect(await messages(UpdateThreadDto, { title: 'a'.repeat(200) })).toEqual([]);
    expect(await messages(UpdateThreadDto, { title: 'a'.repeat(201) })).toHaveLength(1);
    expect(await messages(UpdatePostDto, { body: 'a'.repeat(5000) })).toEqual([]);
    expect(await messages(UpdatePostDto, { body: 'a'.repeat(5001) })).toHaveLength(1);
  });
});
