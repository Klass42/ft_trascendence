import { ExternalLink } from 'lucide-react';
import { parseVideoUrl } from '@/lib/video-embed';
import styles from './VideoPlayer.module.css';

interface VideoPlayerProps {
  url: string | null | undefined;
  /** Accessible title for the embedded player, usually the lesson title. */
  title: string;
}

/** Shows a lesson video: embedded provider, native player, or a link as fallback. */
export function VideoPlayer({ url, title }: VideoPlayerProps) {
  const source = parseVideoUrl(url);
  if (!source) return null;

  if (source.kind === 'iframe') {
    return (
      <div className={styles.frame}>
        <iframe
          className={styles.iframe}
          src={source.src}
          title={`Vídeo: ${title}`}
          allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          allowFullScreen
        />
      </div>
    );
  }

  if (source.kind === 'file') {
    return (
      <video className={styles.video} src={source.src} controls preload="metadata" aria-label={`Vídeo: ${title}`}>
        Tu navegador no puede reproducir este vídeo.
      </video>
    );
  }

  return (
    <a className={styles.link} href={source.href} target="_blank" rel="noopener noreferrer">
      <ExternalLink size={16} aria-hidden="true" />
      Abrir vídeo
    </a>
  );
}
