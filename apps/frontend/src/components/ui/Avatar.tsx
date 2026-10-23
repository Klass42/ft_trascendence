import { useEffect, useState } from 'react';
import styles from './Avatar.module.css';
import { useProtectedImageUrl } from './useProtectedImageUrl';

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ src, alt = '', size = 'md', className }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [src]);
  const imageUrl = useProtectedImageUrl(src);
  const showImage = Boolean(imageUrl) && !imageFailed;

  return (
    <span
      className={[styles.avatar, styles[size], className].filter(Boolean).join(' ')}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      {showImage ? (
        <img src={imageUrl!} alt="" onError={() => setImageFailed(true)} />
      ) : (
        <svg viewBox="0 0 40 40" focusable="false" aria-hidden="true">
          <circle cx="20" cy="20" r="20" className={styles.background} />
          <circle cx="20" cy="15" r="7" className={styles.figure} />
          <path d="M7.5 36c.8-7.2 5.7-11 12.5-11s11.7 3.8 12.5 11" className={styles.figure} />
        </svg>
      )}
    </span>
  );
}

Avatar.displayName = 'Avatar';
