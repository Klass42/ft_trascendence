/**
 * Single source of truth for who is behind Klass and how to reach them.
 * Used by the Privacy and Terms pages. Change the values here only; do not
 * hard-code them in the page copy.
 */
export const LEGAL_INFO = {
  productName: 'Klass',
  /** Data controller, as it reads inside a sentence. */
  controller: 'el equipo de Klass (proyecto ft_transcendence de 42)',
  /** Public channel of the project team (the repository issues page). */
  contactUrl: 'https://github.com/Klass42/ft_trascendence/issues',
  contactLabel: 'la página de incidencias del repositorio del proyecto',
  /** Who handles organization data (courses, grades, accounts). */
  organizationContact: 'el administrador de tu organización',
  /** Shown as "Última actualización: …". Update it when the copy changes. */
  lastUpdated: '27 de octubre de 2026',
} as const;
