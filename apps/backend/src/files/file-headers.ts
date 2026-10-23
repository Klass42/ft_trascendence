export function contentDisposition(originalName: string): string {
  const safeName = originalName.replace(/[\r\n\0]/g, '_');
  const fallback = safeName.replace(/[^\x20-\x7e]/g, '_').replace(/[\\"]/g, '_');
  const encoded = encodeURIComponent(safeName).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
