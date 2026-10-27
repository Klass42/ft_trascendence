import { applyDecorators } from '@nestjs/common';
import { IsIn, IsOptional, IsUrl, Matches, ValidateIf, registerDecorator, ValidationOptions } from 'class-validator';

export const ORG_LANGUAGES = ['es', 'en'] as const;
export const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const TIMEZONES: Set<string> = new Set(
  (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [],
);

export function isValidTimeZone(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false;
  if (TIMEZONES.has(value) || value === 'UTC') return true;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value.includes('/') || value === 'UTC';
  } catch {
    return false;
  }
}

function IsIanaTimeZone(options?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) =>
    registerDecorator({
      name: 'isIanaTimeZone',
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      validator: { validate: (v: unknown) => isValidTimeZone(v) },
    });
}

/** Optional https logo URL. '' / null / undefined allowed (clears the logo). */
export const OrgLogoUrl = () =>
  applyDecorators(
    ValidateIf((_o, v) => v !== undefined && v !== null && v !== ''),
    IsUrl(
      { protocols: ['https'], require_protocol: true },
      { message: 'La URL del logo debe ser una dirección https válida.' },
    ),
  );

export const OrgPrimaryColor = () =>
  applyDecorators(
    IsOptional(),
    Matches(HEX_COLOR_REGEX, { message: 'El color principal debe ser un color hexadecimal (#RGB o #RRGGBB).' }),
  );

export const OrgTimezone = () =>
  applyDecorators(
    IsOptional(),
    IsIanaTimeZone({ message: 'La zona horaria debe ser una zona IANA válida (p. ej. Europe/Madrid).' }),
  );

export const OrgDefaultLanguage = () =>
  applyDecorators(
    IsOptional(),
    IsIn([...ORG_LANGUAGES], { message: 'El idioma por defecto debe ser "es" o "en".' }),
  );
