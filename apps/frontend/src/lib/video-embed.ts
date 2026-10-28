/**
 * Lesson video URL parsing. The backend only checks that the value is an
 * https URL; deciding how to show it (embed, native player, plain link) is
 * done here, and only for shapes we can verify strictly.
 */

export const VIDEO_URL_MAX_LENGTH = 2000;

export type VideoSource =
  | { kind: 'iframe'; provider: 'youtube' | 'vimeo'; src: string }
  | { kind: 'file'; src: string }
  | { kind: 'link'; href: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d+$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com']);
const FILE_EXTENSION = /\.(mp4|webm|ogg)$/i;

function parseHttps(raw: string): URL | null {
  const value = raw.trim();
  if (!value || value.length > VIDEO_URL_MAX_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !url.hostname.includes('.')) return null;
  if (url.username || url.password) return null;
  return url;
}

/** Path segments without empty parts: "/a//b/" -> ["a", "b"]. */
function segments(url: URL): string[] {
  return url.pathname.split('/').filter(Boolean);
}

function youtubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const parts = segments(url);
  let id: string | undefined;

  if (host === 'youtu.be') {
    if (parts.length === 1) id = parts[0];
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (parts.length === 1 && parts[0] === 'watch') id = url.searchParams.get('v') ?? undefined;
    else if (parts.length === 2 && (parts[0] === 'shorts' || parts[0] === 'embed')) id = parts[1];
  } else if (host === 'www.youtube-nocookie.com' || host === 'youtube-nocookie.com') {
    if (parts.length === 2 && parts[0] === 'embed') id = parts[1];
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

function vimeoId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const parts = segments(url);
  let id: string | undefined;

  if (VIMEO_HOSTS.has(host)) {
    if (parts.length === 1) id = parts[0];
  } else if (host === 'player.vimeo.com') {
    if (parts.length === 2 && parts[0] === 'video') id = parts[1];
  }
  return id && VIMEO_ID.test(id) ? id : null;
}

/**
 * Returns how to show a lesson video, or null when the value is empty or not
 * an https URL. Unrecognised https pages come back as a link, never as a
 * player, so a broken embed is not possible.
 */
export function parseVideoUrl(raw: string | null | undefined): VideoSource | null {
  if (!raw) return null;
  const url = parseHttps(raw);
  if (!url) return null;

  const youtube = youtubeId(url);
  if (youtube) {
    return { kind: 'iframe', provider: 'youtube', src: `https://www.youtube-nocookie.com/embed/${youtube}` };
  }
  const vimeo = vimeoId(url);
  if (vimeo) {
    return { kind: 'iframe', provider: 'vimeo', src: `https://player.vimeo.com/video/${vimeo}` };
  }
  if (FILE_EXTENSION.test(url.pathname)) {
    return { kind: 'file', src: url.href };
  }
  return { kind: 'link', href: url.href };
}

/** Form validation: Spanish error for the editor, or null when valid or empty. */
export function validateVideoUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.length > VIDEO_URL_MAX_LENGTH) {
    return `La URL no puede superar los ${VIDEO_URL_MAX_LENGTH} caracteres.`;
  }
  return parseHttps(value) ? null : 'Introduce una URL válida que empiece por https://';
}
