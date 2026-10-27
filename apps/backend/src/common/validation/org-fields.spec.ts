import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateOrganizationDto } from '../../organizations/dto/update-organization.dto';
import { CreatePlatformOrganizationDto } from '../../platform/dto/create-platform-organization.dto';
import { UpdatePlatformOrganizationDto } from '../../platform/dto/update-platform-organization.dto';

const errs = (cls: any, body: object) =>
  validateSync(plainToInstance(cls, body) as object).flatMap((e) => Object.values(e.constraints ?? {}));

const base = { name: 'Acme', slug: 'acme', adminEmail: 'a@acme.test', adminName: 'Ana' };

describe('Organization field validation (#107)', () => {
  describe.each([
    ['UpdateOrganizationDto', UpdateOrganizationDto, {}],
    ['CreatePlatformOrganizationDto', CreatePlatformOrganizationDto, base],
    ['UpdatePlatformOrganizationDto', UpdatePlatformOrganizationDto, {}],
  ])('%s logoUrl', (_n, cls, b) => {
    it.each(['javascript:alert(1)', 'http://acme.test/logo.png', 'not a url', 'data:image/png;base64,AAA'])(
      'rejects %s', (logoUrl) => {
        expect(errs(cls, { ...b, logoUrl })).toContain('La URL del logo debe ser una dirección https válida.');
      });
    it.each(['https://cdn.acme.com/logo.png', '', null, undefined])('accepts %p', (logoUrl) => {
      expect(errs(cls, { ...b, logoUrl })).toEqual([]);
    });
  });

  describe.each([
    ['CreatePlatformOrganizationDto', CreatePlatformOrganizationDto, base],
    ['UpdatePlatformOrganizationDto', UpdatePlatformOrganizationDto, {}],
  ])('%s', (_n, cls, b) => {
    it.each(['red', '#12', '#12345g', '2563eb', '#2563eb1'])('rejects color %s', (primaryColor) => {
      expect(errs(cls, { ...b, primaryColor })).toContain('El color principal debe ser un color hexadecimal (#RGB o #RRGGBB).');
    });
    it.each(['#2563eb', '#FFF', '#AbCdEf'])('accepts color %s', (primaryColor) => {
      expect(errs(cls, { ...b, primaryColor })).toEqual([]);
    });
    it.each(['Mars/Olympus', 'madrid', 'GMT+99', ''])('rejects timezone %p', (timezone) => {
      expect(errs(cls, { ...b, timezone })).toContain('La zona horaria debe ser una zona IANA válida (p. ej. Europe/Madrid).');
    });
    it.each(['Europe/Madrid', 'America/New_York', 'Asia/Tokyo', 'UTC'])('accepts timezone %s', (timezone) => {
      expect(errs(cls, { ...b, timezone })).toEqual([]);
    });
    it.each(['fr', 'ES', 'english', ''])('rejects language %p', (defaultLanguage) => {
      expect(errs(cls, { ...b, defaultLanguage })).toContain('El idioma por defecto debe ser "es" o "en".');
    });
    it.each(['es', 'en'])('accepts language %s', (defaultLanguage) => {
      expect(errs(cls, { ...b, defaultLanguage })).toEqual([]);
    });
  });
});
