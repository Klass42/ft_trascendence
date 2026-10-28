import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { MaxLength, MinLength } from 'class-validator';
import { SearchUsersDto } from '../../users/dto/search-users.dto';
import { RegisterDto } from '../../auth/dto/register.dto';
import { spanishValidationException } from '../pipes/validation-errors';

class SingleCharDto {
  @MinLength(1)
  title!: string;

  @MaxLength(1)
  name!: string;
}

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: spanishValidationException,
});

async function messagesFor(value: unknown, metatype: new () => object): Promise<string[]> {
  try {
    await pipe.transform(value, { type: 'body', metatype });
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return ((error as BadRequestException).getResponse() as { message: string[] }).message;
  }
  throw new Error('expected a validation error');
}

describe('spanishValidationException', () => {
  it('translates the default class-validator messages', async () => {
    const messages = await messagesFor({ q: 'a' }, SearchUsersDto);
    expect(messages).toEqual(['La búsqueda debe tener al menos 2 caracteres.']);
  });

  it('keeps the 400 shape and translates unknown fields', async () => {
    const messages = await messagesFor({ q: 'ab', extra: 1 }, SearchUsersDto);
    expect(messages).toEqual(['El campo «extra» no está permitido.']);
  });

  it('keeps messages set explicitly on the decorators', async () => {
    const messages = await messagesFor(
      { name: 'Ana', email: 'ana@example.com', password: 'alllowercase1', organizationSlug: 'Bad Slug' },
      RegisterDto,
    );
    expect(messages.join(' ')).toContain('El código de organización solo puede contener');
    expect(messages.join(' ')).toContain('La contraseña debe incluir al menos una mayúscula');
    expect(messages.every((message) => !/must|should/.test(message))).toBe(true);
  });

  it('singularises "carácter" when the limit is 1', async () => {
    const messages = await messagesFor({ title: '', name: 'ab' }, SingleCharDto);
    expect(messages).toEqual([
      'El título debe tener al menos 1 carácter.',
      'El nombre no puede superar 1 carácter.',
    ]);
  });
});
