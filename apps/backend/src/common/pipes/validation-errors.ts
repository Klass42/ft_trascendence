import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/**
 * Spanish replacement for class-validator's default (English) messages.
 * Wired as the `exceptionFactory` of the global ValidationPipe, so every DTO
 * gets readable copy without annotating each decorator. A `message` set
 * explicitly on a decorator is kept as-is: defaults always start with the
 * property name (or "each value in"/"property"), custom ones do not.
 */

/** Label with its article; the article also decides the grammatical gender. */
const LABELS: Record<string, string> = {
  q: 'La búsqueda',
  search: 'La búsqueda',
  email: 'El correo electrónico',
  password: 'La contraseña',
  currentPassword: 'La contraseña actual',
  newPassword: 'La nueva contraseña',
  name: 'El nombre',
  title: 'El título',
  description: 'La descripción',
  bio: 'La descripción personal',
  body: 'El mensaje',
  content: 'El contenido',
  prompt: 'El enunciado',
  feedback: 'El comentario',
  role: 'El rol',
  status: 'El estado',
  type: 'El tipo',
  kind: 'El tipo de pregunta',
  points: 'La puntuación',
  maxScore: 'La puntuación máxima',
  score: 'La nota',
  awarded: 'La nota',
  openAt: 'La fecha de apertura',
  dueAt: 'La fecha de entrega',
  closeAt: 'La fecha de cierre',
  startsOn: 'La fecha de inicio',
  endsOn: 'La fecha de fin',
  academicYear: 'El curso académico',
  organizationSlug: 'El código de organización',
  slug: 'El código de organización',
  externalUrl: 'La URL',
  videoUrl: 'La URL del vídeo',
  imageUrl: 'La URL de la imagen',
  logoUrl: 'La URL del logo',
  tags: 'Las etiquetas',
  authors: 'Los autores',
  language: 'El idioma',
  license: 'La licencia',
  publisher: 'La editorial',
  isbn: 'El ISBN',
  page: 'La página',
  pageSize: 'El tamaño de página',
  attemptsAllowed: 'El número de intentos',
  timeLimitSec: 'El límite de tiempo',
};

function labelFor(property: string): string {
  return LABELS[property] ?? `El campo «${property}»`;
}

const isFeminine = (label: string) => /^las? /i.test(label);
const isPlural = (label: string) => /^(las|los) /i.test(label);

/** "vacío"/"vacía"/"vacíos"/"vacías" according to the label. */
function agree(label: string, stem: string): string {
  return `${stem}${isFeminine(label) ? 'a' : 'o'}${isPlural(label) ? 's' : ''}`;
}

const be = (label: string) => (isPlural(label) ? 'son' : 'es');
const must = (label: string) => (isPlural(label) ? 'deben' : 'debe');

function firstNumber(defaultMessage: string): string {
  return defaultMessage.match(/-?\d+(?:\.\d+)?/)?.[0] ?? '';
}

function translate(constraint: string, label: string, original: string): string {
  const n = firstNumber(original);
  switch (constraint) {
    case 'isNotEmpty':
    case 'isDefined':
      return `${label} ${be(label)} ${agree(label, 'obligatori')}.`;
    case 'isString':
      return `${label} ${must(label)} ser texto.`;
    case 'minLength':
      return `${label} ${must(label)} tener al menos ${n} caracteres.`;
    case 'maxLength':
      return `${label} no puede${isPlural(label) ? 'n' : ''} superar los ${n} caracteres.`;
    case 'length':
      return `${label} no tiene una longitud permitida.`;
    case 'isEmail':
      return 'Introduce un correo electrónico válido.';
    case 'isInt':
      return `${label} ${must(label)} ser un número entero.`;
    case 'isNumber':
      return `${label} ${must(label)} ser un número.`;
    case 'min':
      return `${label} ${must(label)} ser como mínimo ${n}.`;
    case 'max':
      return `${label} ${must(label)} ser como máximo ${n}.`;
    case 'isEnum':
    case 'isIn':
      return `${label} no tiene un valor permitido.`;
    case 'isDateString':
    case 'isISO8601':
      return `${label} ${must(label)} ser una fecha válida.`;
    case 'isArray':
      return `${label} ${must(label)} ser una lista.`;
    case 'arrayMaxSize':
      return `${label} admite${isPlural(label) ? 'n' : ''} como máximo ${n} elementos.`;
    case 'arrayMinSize':
    case 'arrayNotEmpty':
      return `${label} no puede${isPlural(label) ? 'n' : ''} estar ${agree(label, 'vací')}.`;
    case 'arrayUnique':
      return `${label} no puede${isPlural(label) ? 'n' : ''} tener elementos repetidos.`;
    case 'isBoolean':
      return `${label} ${must(label)} ser verdadero o falso.`;
    case 'isUrl':
      return `${label} ${must(label)} ser una dirección web válida.`;
    case 'isObject':
      return `${label} no tiene un formato válido.`;
    case 'matches':
      return `${label} no tiene un formato válido.`;
    case 'whitelistValidation':
      return `${label} no está permitido.`;
    default:
      return `${label} ${be(label)} ${agree(label, 'inválid')}.`;
  }
}

function isDefaultMessage(message: string, property: string): boolean {
  return (
    message.startsWith(`${property} `) ||
    message.startsWith('each value in ') ||
    message.startsWith('property ')
  );
}

function collect(errors: ValidationError[], out: string[]): void {
  for (const error of errors) {
    for (const [constraint, message] of Object.entries(error.constraints ?? {})) {
      out.push(
        isDefaultMessage(message, error.property)
          ? translate(constraint, labelFor(error.property), message)
          : message,
      );
    }
    if (error.children?.length) collect(error.children, out);
  }
}

/** `ValidationPipe({ exceptionFactory })`: same 400 shape as the default, in Spanish. */
export function spanishValidationException(errors: ValidationError[]): BadRequestException {
  const messages: string[] = [];
  collect(errors, messages);
  return new BadRequestException(messages);
}
