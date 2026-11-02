import type { svg2pdf as Svg2pdf } from 'svg2pdf.js';
import type { AnalyticsOverviewDTO } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { buildKpiTiles } from './KpiTiles';

/** `data-pdf-chart` ids of the chart cards the report picks up from the page. */
type PdfChartId = 'submissions' | 'grades' | 'status';

export interface AnalyticsPdfInput {
  /** The element that contains the rendered chart cards (`[data-pdf-chart]`). */
  container: HTMLElement;
  overview: AnalyticsOverviewDTO;
  /** Human descriptions of the active filters, printed under the title. */
  rangeLabel: string;
  typeLabel: string;
  /** What the range means for the figures (printed in small print). */
  rangeNote: string;
}

const PAGE_MARGIN = 15;
// Width in mm of each chart on the A4 page (the height follows its aspect ratio).
const CHARTS: Array<{ id: PdfChartId; title: string; width: number }> = [
  { id: 'submissions', title: 'Entregas en el tiempo', width: 180 },
  { id: 'grades', title: 'Distribución de notas', width: 180 },
  { id: 'status', title: 'Estado de entregas', width: 70 },
];
// Presentation properties copied from the live (CSS-styled) chart onto its clone.
const INLINED_STYLES = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linejoin',
  'stroke-linecap',
  'opacity',
  'font-size',
  'font-weight',
  'text-anchor',
] as const;

/**
 * Build the analytics report as a real PDF and download it. Everything runs in
 * the browser (no server, no CDN): jsPDF draws the text and svg2pdf.js turns the
 * very SVG charts shown on screen into vector graphics. Both libraries are
 * loaded on demand so they stay out of the main bundle.
 */
export async function downloadAnalyticsPdf(input: AnalyticsPdfInput): Promise<void> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const { container, overview } = input;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - PAGE_MARGIN * 2;
  const ink = token('--color-text-primary');
  const muted = token('--color-text-muted');
  const rule = token('--color-border-secondary');
  let y = PAGE_MARGIN;

  const ensure = (height: number) => {
    if (y + height > pageH - PAGE_MARGIN) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
  };
  /** Write one line of text at the cursor (or at `at`, leaving the cursor alone). */
  const write = (
    value: string,
    x: number,
    size: number,
    options: { bold?: boolean; color?: string; align?: 'left' | 'right'; at?: number } = {},
  ) => {
    doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(options.color ?? ink);
    doc.text(value, x, options.at ?? y, { align: options.align ?? 'left' });
  };

  // --- Header -----------------------------------------------------------
  y += 6;
  write('Informe de analíticas', PAGE_MARGIN, 18, { bold: true });
  y += 8;
  write(overview.course.title, PAGE_MARGIN, 12, { bold: true });
  y += 6;
  write(`Generado el ${formatDateTime(new Date())}`, PAGE_MARGIN, 9, { color: muted });
  y += 6;
  write(`Rango: ${input.rangeLabel}`, PAGE_MARGIN, 10);
  y += 5;
  write(`Tipo de actividad: ${input.typeLabel}`, PAGE_MARGIN, 10);
  y += 5;
  doc.setFontSize(8);
  for (const row of doc.splitTextToSize(input.rangeNote, contentW) as string[]) {
    write(row, PAGE_MARGIN, 8, { color: muted });
    y += 4;
  }
  doc.setDrawColor(rule);
  doc.line(PAGE_MARGIN, y, pageW - PAGE_MARGIN, y);
  y += 6;

  // --- KPIs: three tiles per row ---------------------------------------
  const tiles = buildKpiTiles(overview);
  const columns = 3;
  const gap = 4;
  const tileW = (contentW - gap * (columns - 1)) / columns;
  const tileH = 20;
  tiles.forEach((tile, index) => {
    const column = index % columns;
    if (column === 0) ensure(tileH + gap);
    const x = PAGE_MARGIN + column * (tileW + gap);
    doc.setDrawColor(rule);
    doc.roundedRect(x, y, tileW, tileH, 2, 2);
    write(tile.label.toUpperCase(), x + 3, 7, { bold: true, color: muted, at: y + 5 });
    write(tile.value, x + 3, 15, { bold: true, at: y + 12 });
    if (tile.hint) write(tile.hint, x + 3, 8, { color: muted, at: y + 17 });
    if (column === columns - 1 || index === tiles.length - 1) y += tileH + gap;
  });
  y += 2;

  // --- Charts -----------------------------------------------------------
  for (const chart of CHARTS) {
    const card = container.querySelector<HTMLElement>(`[data-pdf-chart="${chart.id}"]`);
    const svg = card?.querySelector('svg') ?? null;
    const height = svg ? chart.width / aspectRatio(svg) : 8;

    ensure(height + 12);
    write(chart.title, PAGE_MARGIN, 12, { bold: true });
    y += 4;
    if (!svg) {
      y += 4;
      write(card?.querySelector('p')?.textContent ?? 'Sin datos.', PAGE_MARGIN, 10, { color: muted });
      y += 8;
      continue;
    }

    await drawSvg(svg2pdf, doc, svg, PAGE_MARGIN, y, chart.width, height);
    if (chart.id === 'status') {
      // The donut's legend is read from the on-screen list so both always agree.
      const rows = [...(card?.querySelectorAll('li') ?? [])];
      const legendX = PAGE_MARGIN + chart.width + 10;
      const legendTop = y + height / 2 - (rows.length * 8) / 2 + 5;
      rows.forEach((row, index) => {
        const [swatch, label, value] = [...row.children];
        const rowY = legendTop + index * 8;
        doc.setFillColor(getComputedStyle(swatch).backgroundColor);
        doc.rect(legendX, rowY - 3.2, 3.5, 3.5, 'F');
        write(`${label.textContent}: ${value.textContent}`, legendX + 6, 10, { at: rowY });
      });
    }
    y += height + 8;
  }

  // --- Footer on every page --------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    write(`Klass · ${overview.course.title}`, PAGE_MARGIN, 8, { color: muted, at: pageH - 8 });
    write(`Página ${page} de ${pages}`, pageW - PAGE_MARGIN, 8, {
      color: muted,
      align: 'right',
      at: pageH - 8,
    });
  }

  doc.save(pdfFilename(overview.course.title));
}

/** Resolved value of a design token (`--color-…`), e.g. `#0f172a`. */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function aspectRatio(svg: SVGSVGElement): number {
  const box = svg.viewBox.baseVal;
  return box.width > 0 && box.height > 0 ? box.width / box.height : 1;
}

/**
 * Render a live chart into the PDF. svg2pdf cannot resolve CSS variables or
 * CSS-module classes, so the computed presentation properties are copied onto a
 * detached clone as plain attributes; interactive hit targets are dropped.
 */
async function drawSvg(
  render: typeof Svg2pdf,
  doc: Parameters<typeof Svg2pdf>[1],
  svg: SVGSVGElement,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<void> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const live = [svg, ...svg.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];
  const hidden: Element[] = [];

  live.forEach((source, index) => {
    const target = copies[index];
    if (source.getAttribute('role') === 'img' && source.tagName.toLowerCase() === 'rect') {
      hidden.push(target); // transparent hover/focus targets of the bar and line charts
      return;
    }
    const computed = getComputedStyle(source);
    for (const property of INLINED_STYLES) {
      target.setAttribute(property, pdfValue(property, computed.getPropertyValue(property)));
    }
    target.setAttribute('font-family', 'helvetica');
    for (const attribute of ['class', 'style', 'tabindex', 'role', 'aria-label']) {
      target.removeAttribute(attribute);
    }
  });
  hidden.forEach((node) => node.remove());

  // svg2pdf measures the element, so it must live in the document while rendering.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:640px;visibility:hidden';
  host.appendChild(clone);
  document.body.appendChild(host);
  try {
    await render(clone, doc, { x, y, width, height });
  } finally {
    host.remove();
  }
}

/** svg2pdf only knows `bold`/`normal` weights and unitless font sizes. */
function pdfValue(property: (typeof INLINED_STYLES)[number], value: string): string {
  if (property === 'font-size') return String(parseFloat(value));
  if (property === 'font-weight') return Number(value) >= 600 || value === 'bold' ? 'bold' : 'normal';
  return value;
}

function pdfFilename(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `analiticas-${slug || 'asignatura'}-${new Date().toISOString().slice(0, 10)}.pdf`;
}
