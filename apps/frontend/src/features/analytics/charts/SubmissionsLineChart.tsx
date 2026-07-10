import { useState } from 'react';
import type { SubmissionsSeriesPointDTO } from '@/lib/api';
import styles from '../analytics.module.css';

// Fixed viewBox coordinate space; the SVG scales to the container width and the
// HTML tooltip is positioned as a % of these dimensions (uniform scaling).
const VW = 640;
const VH = 280;
const ML = 40;
const MR = 16;
const MT = 16;
const MB = 34;
const PLOT_W = VW - ML - MR;
const PLOT_H = VH - MT - MB;

interface Props {
  series: SubmissionsSeriesPointDTO[];
}

/**
 * Hand-rolled SVG line chart of daily submission counts. No chart dependency —
 * recharts still leans on `findDOMNode`, removed in React 19, so a small SVG is
 * both safer and lighter here. Interactive: hovering/focusing a day highlights
 * its point and shows a tooltip.
 */
export function SubmissionsLineChart({ series }: Props) {
  const [active, setActive] = useState<number | null>(null);

  if (series.length === 0) {
    return <p className={styles.empty}>No hay datos en este rango.</p>;
  }

  const maxCount = Math.max(1, ...series.map((p) => p.count));
  // Round the axis top up to a "nice" value so gridlines read cleanly.
  const yMax = niceCeil(maxCount);

  const n = series.length;
  const xAt = (i: number) =>
    n === 1 ? ML + PLOT_W / 2 : ML + (i / (n - 1)) * PLOT_W;
  const yAt = (count: number) => MT + PLOT_H * (1 - count / yMax);

  const linePoints = series.map((p, i) => `${xAt(i)},${yAt(p.count)}`).join(' ');
  const areaPoints = `${xAt(0)},${MT + PLOT_H} ${linePoints} ${xAt(n - 1)},${MT + PLOT_H}`;

  // Horizontal gridlines + y labels at 0/¼/½/¾/max.
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));
  const uniqueTicks = [...new Set(yTicks)];

  // Show at most ~6 x labels to avoid crowding on a 30-day range.
  const labelStep = Math.max(1, Math.ceil(n / 6));

  return (
    <div className={styles.chartWrap}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Entregas por día. Máximo ${maxCount} en un día.`}
        onMouseLeave={() => setActive(null)}
      >
        {uniqueTicks.map((t) => {
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

        <polygon className={styles.areaPath} points={areaPoints} />
        <polyline className={styles.linePath} points={linePoints} />

        {series.map((p, i) => (
          <circle
            key={p.date}
            className={`${styles.point} ${active === i ? styles.pointActive : ''}`}
            cx={xAt(i)}
            cy={yAt(p.count)}
            r={active === i ? 5 : 3}
          />
        ))}

        {series.map((p, i) =>
          i % labelStep === 0 || i === n - 1 ? (
            <text
              key={`lbl-${p.date}`}
              className={styles.axisLabel}
              x={xAt(i)}
              y={VH - 12}
              textAnchor="middle"
            >
              {shortDate(p.date)}
            </text>
          ) : null,
        )}

        {/* Invisible hit targets: one per day, full plot height, for hover + keyboard focus. */}
        {series.map((p, i) => {
          const w = n === 1 ? PLOT_W : PLOT_W / n;
          const x = n === 1 ? ML : Math.max(ML, xAt(i) - w / 2);
          return (
            <rect
              key={`hit-${p.date}`}
              className={styles.hit}
              x={x}
              y={MT}
              width={w}
              height={PLOT_H}
              tabIndex={0}
              role="button"
              aria-label={`${p.date}: ${p.count} entregas`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            />
          );
        })}
      </svg>

      {active !== null && (
        <div
          className={styles.tooltip}
          style={{
            left: `${(xAt(active) / VW) * 100}%`,
            top: `${(yAt(series[active].count) / VH) * 100}%`,
          }}
        >
          <div>{shortDate(series[active].date)}</div>
          <div className={styles.tooltipValue}>
            {series[active].count}{' '}
            {series[active].count === 1 ? 'entrega' : 'entregas'}
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

/** `2026-07-10` → `10 jul`. */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  const months = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
  ];
  return `${Number(d)} ${months[Number(m) - 1] ?? ''}`;
}
