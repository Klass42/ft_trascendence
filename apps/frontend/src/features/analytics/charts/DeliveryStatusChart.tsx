import { useState } from 'react';
import { plural } from '@/lib/format';
import styles from '../analytics.module.css';

const SIZE = 240;
const CENTER = SIZE / 2;
const OUTER = 108;
const INNER = 66;
// A single slice covering everything cannot be drawn as one arc (start = end).
const MAX_SWEEP = Math.PI * 2 - 0.001;

interface Props {
  /** Delivered pairs with a grade. */
  graded: number;
  /** Delivered pairs still awaiting manual grading. */
  pending: number;
  /** (student, activity) pairs with no delivery. */
  undelivered: number;
}

interface Slice {
  key: 'graded' | 'pending' | 'undelivered';
  label: string;
  count: number;
  className: string;
  swatchClassName: string;
}

/**
 * Hand-rolled SVG donut of the delivery status over (student, activity) pairs:
 * graded / awaiting grading / not delivered. Same interaction model as the other
 * charts: hover or focus a slice (or its legend row) to see its exact count.
 */
export function DeliveryStatusChart({ graded, pending, undelivered }: Props) {
  const [active, setActive] = useState<Slice['key'] | null>(null);

  const total = graded + pending + undelivered;
  if (total === 0) {
    return <p className={styles.empty}>Todavía no hay entregas esperadas.</p>;
  }

  const slices: Slice[] = [
    { key: 'graded', label: 'Calificadas', count: graded, className: styles.sliceGraded, swatchClassName: styles.swatchGraded },
    { key: 'pending', label: 'Por calificar', count: pending, className: styles.slicePending, swatchClassName: styles.swatchPending },
    { key: 'undelivered', label: 'Sin entregar', count: undelivered, className: styles.sliceUndelivered, swatchClassName: styles.swatchUndelivered },
  ];

  let angle = -Math.PI / 2;
  const arcs = slices.map((slice) => {
    const sweep = Math.min(MAX_SWEEP, (slice.count / total) * Math.PI * 2);
    const start = angle;
    angle += sweep;
    return { slice, start, end: start + sweep, mid: start + sweep / 2 };
  });

  const activeArc = arcs.find((arc) => arc.slice.key === active);
  // Tooltip anchored on the middle of the active ring segment.
  const anchor = activeArc && {
    left: ((CENTER + ((OUTER + INNER) / 2) * Math.cos(activeArc.mid)) / SIZE) * 100,
    top: ((CENTER + ((OUTER + INNER) / 2) * Math.sin(activeArc.mid)) / SIZE) * 100,
  };

  const describe = (slice: Slice) =>
    `${slice.label}: ${plural(slice.count, 'entrega', 'entregas')} (${percent(slice.count, total)})`;

  return (
    <div className={styles.donutLayout}>
      <div className={styles.donutWrap}>
        <svg
          className={styles.donut}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="group"
          aria-label={`Estado de entregas sobre ${plural(total, 'entrega esperada', 'entregas esperadas')}.`}
          onMouseLeave={() => setActive(null)}
        >
          {arcs.map(({ slice, start, end }) =>
            slice.count > 0 ? (
              <path
                key={slice.key}
                className={`${styles.slice} ${slice.className} ${active === slice.key ? styles.sliceActive : ''}`}
                d={ringPath(start, end)}
                tabIndex={0}
                role="img"
                aria-label={describe(slice)}
                onMouseEnter={() => setActive(slice.key)}
                onFocus={() => setActive(slice.key)}
                onBlur={() => setActive(null)}
              />
            ) : null,
          )}
          <text className={styles.donutTotal} x={CENTER} y={CENTER + 4} textAnchor="middle">
            {total}
          </text>
          <text className={styles.axisLabel} x={CENTER} y={CENTER + 22} textAnchor="middle">
            {total === 1 ? 'entrega' : 'entregas'}
          </text>
        </svg>

        {activeArc && anchor && (
          <div className={styles.tooltip} style={{ left: `${anchor.left}%`, top: `${anchor.top}%` }}>
            <div>{activeArc.slice.label}</div>
            <div className={styles.tooltipValue}>
              {activeArc.slice.count} · {percent(activeArc.slice.count, total)}
            </div>
          </div>
        )}
      </div>

      <ul className={styles.legend}>
        {slices.map((slice) => (
          <li
            key={slice.key}
            className={`${styles.legendItem} ${active === slice.key ? styles.legendItemActive : ''}`}
            onMouseEnter={() => setActive(slice.key)}
            onMouseLeave={() => setActive(null)}
          >
            <span className={`${styles.swatch} ${slice.swatchClassName}`} aria-hidden="true" />
            <span className={styles.legendLabel}>{slice.label}</span>
            <span className={styles.legendValue}>
              {slice.count} · {percent(slice.count, total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ring segment between two angles (radians, 0 = 3 o'clock, clockwise). */
function ringPath(start: number, end: number): string {
  const large = end - start > Math.PI ? 1 : 0;
  const point = (radius: number, a: number) =>
    `${(CENTER + radius * Math.cos(a)).toFixed(2)} ${(CENTER + radius * Math.sin(a)).toFixed(2)}`;
  return [
    `M ${point(OUTER, start)}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${point(OUTER, end)}`,
    `L ${point(INNER, end)}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${point(INNER, start)}`,
    'Z',
  ].join(' ');
}

function percent(count: number, total: number): string {
  return `${Math.round((count / total) * 100)}%`;
}
