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

/** What a Publicar / Mover a… / Eliminar action acts on: one item or a batch. */
export interface Targets { resourceIds: string[]; folderIds: string[] }

export const countLabel = ({ resourceIds, folderIds }: Targets) => [
  resourceIds.length && `${resourceIds.length} recurso${resourceIds.length === 1 ? '' : 's'}`,
  folderIds.length && `${folderIds.length} carpeta${folderIds.length === 1 ? '' : 's'}`,
].filter(Boolean).join(' y ');

/**
 * Past-participle summary with agreement (#109): «Eliminado 1 recurso»,
 * «Eliminada 1 carpeta», «Eliminados 2 recursos», «Eliminados 1 recurso y 1 carpeta».
 * `stem` is the participle without its ending, e.g. «Eliminad».
 */
export function doneLabel(stem: string, targets: Targets) {
  const total = targets.resourceIds.length + targets.folderIds.length;
  const onlyFolders = targets.resourceIds.length === 0;
  const ending = total === 1 ? (onlyFolders ? 'a' : 'o') : (onlyFolders ? 'as' : 'os');
  return `${stem}${ending} ${countLabel(targets)}`;
}

/** Spanish validation for a resource's external URL (#109); null when valid. */
export function validateExternalUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return 'Introduce la URL del recurso.';
  let url: URL;
  try { url = new URL(value); } catch {
    return 'Introduce una URL completa, por ejemplo https://ejemplo.com/recurso.';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return 'Solo se admiten enlaces http:// o https:// (no javascript:, data:, etc.).';
  }
  if (!url.hostname) return 'La URL no tiene un dominio válido.';
  return null;
}
