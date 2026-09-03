import type { LearningResourceStatus, LearningResourceType } from '@/lib/api';

export const RESOURCE_TYPES: { value: LearningResourceType; label: string }[] = [
  { value: 'BOOK', label: 'Libro' },
  { value: 'DOCUMENT', label: 'Documento' },
  { value: 'LINK', label: 'Enlace' },
  { value: 'VIDEO', label: 'Vídeo' },
  { value: 'AUDIO', label: 'Audio' },
];

export const RESOURCE_STATUSES: { value: LearningResourceStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'PUBLISHED', label: 'Publicado' },
  { value: 'ARCHIVED', label: 'Archivado' },
];

export function resourceTypeLabel(type: LearningResourceType) {
  return RESOURCE_TYPES.find((item) => item.value === type)?.label ?? type;
}

export function resourceStatusLabel(status: LearningResourceStatus) {
  return RESOURCE_STATUSES.find((item) => item.value === status)?.label ?? status;
}

export function splitList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}
