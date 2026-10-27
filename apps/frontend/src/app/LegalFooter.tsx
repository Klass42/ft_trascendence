import { Link } from 'react-router-dom';
import { LEGAL_INFO } from '@/features/legal/legalInfo';
import styles from './LegalFooter.module.css';

/**
 * Discreet footer with the legal links (the subject requires Privacy and Terms
 * to be easy to reach). Shared by the tenant layout, the platform layout and
 * the standalone 404 page.
 */
export function LegalFooter() {
  return (
    <footer className={styles.footer}>
      <nav className={styles.links} aria-label="Legal">
        <Link to="/privacy">Privacidad</Link>
        <Link to="/terms">Términos</Link>
      </nav>
      <small className={styles.copy}>
        © {new Date().getFullYear()} {LEGAL_INFO.productName}
      </small>
    </footer>
  );
}
