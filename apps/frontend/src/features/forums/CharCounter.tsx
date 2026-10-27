import styles from './ForumsPage.module.css';

interface CharCounterProps {
  length: number;
  max: number;
}

/** "123 / 5000" counter shown under a limited field; warns near the limit. */
export function CharCounter({ length, max }: CharCounterProps) {
  const near = length >= max * 0.9;
  return (
    <span
      className={`${styles.counter} ${near ? styles.counterNear : ''}`}
      aria-live="off"
    >
      {length} / {max}
    </span>
  );
}
