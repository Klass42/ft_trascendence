import { test, expect } from '@playwright/test';
import { parseVideoUrl, validateVideoUrl } from '../src/lib/video-embed';

// Pure logic: no browser or backend needed.
const YT = 'dQw4w9WgXcQ';
const YT_EMBED = `https://www.youtube-nocookie.com/embed/${YT}`;

test.describe('parseVideoUrl', () => {
  for (const url of [
    `https://www.youtube.com/watch?v=${YT}`,
    `https://youtube.com/watch?v=${YT}&t=10s`,
    `https://m.youtube.com/watch?v=${YT}`,
    `https://youtu.be/${YT}`,
    `https://youtu.be/${YT}?si=abc`,
    `https://www.youtube.com/shorts/${YT}`,
    `https://www.youtube.com/embed/${YT}`,
    YT_EMBED,
  ]) {
    test(`embeds YouTube ${url}`, () => {
      expect(parseVideoUrl(url)).toEqual({ kind: 'iframe', provider: 'youtube', src: YT_EMBED });
    });
  }

  for (const url of ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871']) {
    test(`embeds Vimeo ${url}`, () => {
      expect(parseVideoUrl(url)).toEqual({
        kind: 'iframe',
        provider: 'vimeo',
        src: 'https://player.vimeo.com/video/76979871',
      });
    });
  }

  for (const url of [
    'https://cdn.example.com/clip.mp4',
    'https://cdn.example.com/clip.WEBM?token=1',
    'https://cdn.example.com/a/b.ogg',
  ]) {
    test(`plays direct file ${url}`, () => {
      expect(parseVideoUrl(url)).toMatchObject({ kind: 'file' });
    });
  }

  for (const url of [
    'https://www.youtube.com/watch?v=test', // id is not 11 chars
    `https://www.youtube.com/watch?v=${YT}x`,
    'https://www.youtube.com/watch?v=dQw4w9WgXc!',
    'https://www.youtube.com/channel/abc',
    'https://vimeo.com/channels/staffpicks',
    'https://vimeo.com/76979871/abcdef1234',
    'https://player.vimeo.com/video/abc',
    'https://evil-youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
    'https://example.com/lesson',
  ]) {
    test(`falls back to a link for ${url}`, () => {
      expect(parseVideoUrl(url)).toMatchObject({ kind: 'link' });
    });
  }

  for (const url of [
    '',
    '   ',
    null,
    undefined,
    'no-es-url',
    'http://example.com/a.mp4',
    'javascript:alert(1)',
    '//example.com/a.mp4',
    'https://user:pass@example.com/a.mp4',
    'https://localhost/a.mp4',
  ]) {
    test(`returns null for ${JSON.stringify(url)}`, () => {
      expect(parseVideoUrl(url)).toBeNull();
    });
  }
});

test.describe('validateVideoUrl', () => {
  test('accepts empty values and https URLs', () => {
    expect(validateVideoUrl('')).toBeNull();
    expect(validateVideoUrl('  ')).toBeNull();
    expect(validateVideoUrl(`https://youtu.be/${YT}`)).toBeNull();
    expect(validateVideoUrl('https://example.com/page')).toBeNull();
  });

  test('rejects non-https and malformed values with a Spanish message', () => {
    expect(validateVideoUrl('no-es-url')).toMatch(/https/);
    expect(validateVideoUrl('http://example.com/a.mp4')).toMatch(/https/);
  });

  test('rejects values over 2000 characters', () => {
    expect(validateVideoUrl(`https://example.com/${'a'.repeat(2000)}`)).toMatch(/2000/);
  });
});
