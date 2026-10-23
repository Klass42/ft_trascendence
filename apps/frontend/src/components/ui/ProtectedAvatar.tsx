import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

const FILE_CONTENT_PATH = /(?:\/api)?\/files\/([^/?#]+)\/content(?:[?#]|$)/;

function legacyObjectKey(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.pathname.startsWith('/uploads/')) {
      return decodeURIComponent(parsed.pathname.slice('/uploads/'.length));
    }
    if (parsed.searchParams.has('X-Amz-Signature')) {
      const parts = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      if (parts.length >= 3) return parts.slice(-2).join('/');
    }
  } catch {
    return null;
  }
  return null;
}

interface ProtectedAvatarProps {
  url: string | null | undefined;
  fallback: string;
  alt?: string;
}

/** Refreshes app file URLs through the authenticated API before using them in an img. */
export function ProtectedAvatar({ url, fallback, alt = '' }: ProtectedAvatarProps) {
  const fileId = url?.match(FILE_CONTENT_PATH)?.[1];
  const objectKey = url ? legacyObjectKey(url) : null;
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!url) {
      setImageUrl(null);
      return () => { active = false; };
    }
    if (!fileId && !objectKey) {
      setImageUrl(url);
      return () => { active = false; };
    }

    setImageUrl(null);
    const refresh = fileId
      ? apiClient.get<{ url: string }>(`/files/${encodeURIComponent(fileId)}/url`)
      : apiClient.get<{ url: string }>(`/files/resolve-url?objectKey=${encodeURIComponent(objectKey!)}`);
    void refresh
      .then((access) => {
        if (active) setImageUrl(access.url);
      })
      .catch(() => {
        if (active) setImageUrl(null);
      });

    return () => { active = false; };
  }, [url, fileId, objectKey]);

  if (!imageUrl) return <>{fallback}</>;
  return <img src={imageUrl} alt={alt} onError={() => setImageUrl(null)} />;
}
