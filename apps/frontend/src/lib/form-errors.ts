export interface MappedValidationErrors {
  fields: Record<string, string>;
  form?: string;
}

const FIELD_LABELS: Record<string, string> = {
  organization: 'el código de organización',
  email: 'el correo electrónico',
  name: 'el nombre',
  title: 'el título',
  password: 'la contraseña',
  bio: 'la descripción personal',
};

function fieldForMessage(message: string): string | undefined {
  const lower = message.toLowerCase();
  if (lower.includes('organizationslug') || lower.includes('organization')) return 'organization';
  if (lower.includes('email')) return 'email';
  if (lower.includes('name')) return 'name';
  if (lower.includes('title')) return 'title';
  if (lower.includes('password')) return 'password';
  if (lower.includes('bio')) return 'bio';
  return undefined;
}

function messageForField(field: string, source: string): string {
  const lower = source.toLowerCase();
  if (field === 'organization') {
    return 'El código solo puede contener letras minúsculas, números y guiones.';
  }
  if (lower.includes('must be shorter') || lower.includes('longer than')) {
    return `${FIELD_LABELS[field] ?? 'Este campo'} supera la longitud permitida.`;
  }
  if (lower.includes('must be longer')) {
    return `${FIELD_LABELS[field] ?? 'Este campo'} es demasiado corto.`;
  }
  if (field === 'email' && (lower.includes('email') || lower.includes('mail'))) {
    return 'Introduce un correo electrónico válido.';
  }
  if (lower.includes('should not be empty')) return 'Este campo es obligatorio.';
  return `Revisa ${FIELD_LABELS[field] ?? 'este campo'} e inténtalo de nuevo.`;
}

/** Convert class-validator messages into concise, field-level Spanish copy. */
export function mapApiValidationErrors(messages: string[]): MappedValidationErrors {
  const fields: Record<string, string> = {};
  let form: string | undefined;

  for (const message of messages) {
    const field = fieldForMessage(message);
    if (field) fields[field] = messageForField(field, message);
    else form = 'Revisa los datos e inténtalo de nuevo.';
  }

  return { fields, form };
}
