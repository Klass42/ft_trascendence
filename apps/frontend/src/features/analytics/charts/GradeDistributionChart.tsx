import { useState } from 'react';
import type { GradeBucketDTO } from '@/lib/api';
import styles from '../analytics.module.css';

const VW = 640;
const VH = 280;
const ML = 40;
const MR = 16;
const MT = 16;
const MB = 34;
const PLOT_W = VW - ML - MR;
const PLOT_H = VH - MT - MB;

interface Props {
  buckets: GradeBucketDTO[];
}

/**
 * Hand-rolled SVG bar chart of the grade histogram (normalised to maxScore, ten
 * 10-point bands). Interactive: hover/focus a bar to see its exact count.
 */
export function GradeDistributionChart({ buckets }: Props) {
  const [active, setActive] = useState<number | null>(null);

  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  if (total === 0) {
    return (
      <p className={styles.empty}>Todavía no hay entregas calificadas.</p>
    );
  }

  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const yMax = niceCeil(maxCount);
  const n = buckets.length;
  const slot = PLOT_W / n;
  const barW = slot * 0.66;

  const yAt = (count: number) => MT + PLOT_H * (1 - count / yMax);
  const xAt = (i: number) => ML + i * slot;

  const yTicks = [...new Set([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f)))];

  return (
    <div className={styles.chartWrap}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Distribución de notas sobre ${total} entregas calificadas.`}
        onMouseLeave={() => setActive(null)}
      >
        {yTicks.map((t) => {
          const y = yAt(t);
          return (
            <g key={t}>
              <line className={styles.gridLine} x1={ML} y1={y} x2={VW - MR} y2={y} />
              <text className={styles.axisLabel} x={ML - 8} y={y + 4} textAnchor="end">
                {t}
              </text>
            </g>
          );
        })}

        {buckets.map((b, i) => {
          const h = PLOT_H * (b.count / yMax);
          const x = xAt(i) + (slot - barW) / 2;
          const y = MT + PLOT_H - h;
          return (
            <g key={b.label}>
              <rect
                className={`${styles.bar} ${active === i ? styles.barActive : ''}`}
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={4}
              />
              <text
                className={styles.axisLabel}
                x={xAt(i) + slot / 2}
                y={VH - 12}
                textAnchor="middle"
              >
                {b.min}
              </text>
              {/* Full-height hit target for hover + keyboard focus. */}
              <rect
                className={styles.hit}
                x={xAt(i)}
                y={MT}
                width={slot}
                height={PLOT_H}
                tabIndex={0}
                role="button"
                aria-label={`${b.label}%: ${b.count} entregas`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            </g>
          );
        })}
      </svg>

      {active !== null && (
        <div
          className={styles.tooltip}
          style={{
            left: `${((xAt(active) + slot / 2) / VW) * 100}%`,
            top: `${(yAt(buckets[active].count) / VH) * 100}%`,
          }}
        >
          <div>{buckets[active].label}%</div>
          <div className={styles.tooltipValue}>
            {buckets[active].count}{' '}
            {buckets[active].count === 1 ? 'entrega' : 'entregas'}
          </div>
        </div>
      )}
    </div>
  );
}

/** Round up to a friendly axis maximum (1,2,5 × 10ⁿ). */
function niceCeil(n: number): number {
  if (n <= 5) return n;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const frac = n / pow;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * pow;
}
