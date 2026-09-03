"use client";

import { useMemo, useState } from "react";

import styles from "./horas.module.css";

type HorasResumoItem = { userId: string; name: string; horasTrabalhadas: number; horasTickets: number };

const CHART_HEIGHT = 260;
const BAR_WIDTH = 24;
const BAR_GAP = 20;
const LABEL_HEIGHT = 40;

// A rotated label doesn't just reach left of its pivot — it also reaches
// *down* past it (rotate(-35, ...) on a text-anchor="end" string moves
// its start point down-and-left, not just left). `.chartScroll`'s
// `overflow-x: auto` was added in a previous fix round to handle wide
// (many-employee) charts, but CSS forces `overflow-y` to compute as
// `auto` too whenever `overflow-x` isn't `visible` and `overflow-y` is
// (an unavoidable coupling per the CSS Overflow spec — you cannot have
// "auto" on one axis and "visible" on the other on the same element).
// That silently clips anything that bleeds below the box's fixed height,
// which is exactly what a long rotated label does. Fix: make the box
// tall (and wide) enough that nothing needs to overflow in the first
// place — an "auto" overflow that never triggers is visually identical
// to "visible".
//
// The reserved margins used to be fixed constants sized for this app's
// dev-seed names (longest: "Daniel Gomes de Oliveira", 24 chars). Real
// names vary a lot more, so both margins are now derived from the
// longest employee name actually present in `data`. We don't have a
// live DOM node to measure (no effects/two-pass render in this
// component), so width is estimated from character count at the
// label's font-size: 10px — AVG_CHAR_WIDTH_PX is a deliberate
// upper-bound average for that size/font, so we overestimate margin
// rather than clip. From that estimated pixel width, the same trig the
// old fixed constants implicitly modeled gives the rotated (-35°)
// reach: vertical reach (bottom margin) ≈ textWidthPx * sin(35°),
// horizontal reach (left margin, shared with the y-axis tick numbers'
// own offset) ≈ textWidthPx * cos(35°). Floors match the old fixed
// values so short-name rosters (e.g. this app's dev-seed) don't regress
// to a smaller, cramped chart.
const AVG_CHAR_WIDTH_PX = 6;
const ROTATION_RADIANS = (35 * Math.PI) / 180;
const MARGIN_BUFFER_PX = 16;
const MIN_AXIS_LABEL_WIDTH = 48;
const MIN_LABEL_BOTTOM_MARGIN = 70;

function computeLabelMargins(names: string[]): { axisLabelWidth: number; labelBottomMargin: number } {
  const maxNameLength = names.reduce((max, name) => Math.max(max, name.length), 0);
  const textWidthPx = maxNameLength * AVG_CHAR_WIDTH_PX;
  const reachHorizontal = textWidthPx * Math.cos(ROTATION_RADIANS);
  const reachVertical = textWidthPx * Math.sin(ROTATION_RADIANS);
  return {
    axisLabelWidth: Math.max(MIN_AXIS_LABEL_WIDTH, Math.ceil(reachHorizontal + MARGIN_BUFFER_PX)),
    labelBottomMargin: Math.max(MIN_LABEL_BOTTOM_MARGIN, Math.ceil(reachVertical + MARGIN_BUFFER_PX)),
  };
}

// Rounds only the top two corners of a bar (square baseline) — a plain
// `rx` on a <rect> would round all four, which reads wrong for a bar that
// grows from a shared baseline (mark spec: "4px rounded data-end, square
// at the baseline").
function roundedTopRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  if (height <= 0) return "";
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
}

export function HorasChart({ data }: { data: HorasResumoItem[] }) {
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);

  const maxValue = useMemo(() => {
    const allValues = data.flatMap((item) => [item.horasTrabalhadas, item.horasTickets]);
    const max = Math.max(0, ...allValues);
    return max === 0 ? 10 : Math.ceil(max / 10) * 10;
  }, [data]);

  const { axisLabelWidth: AXIS_LABEL_WIDTH, labelBottomMargin: LABEL_BOTTOM_MARGIN } = useMemo(
    () => computeLabelMargins(data.map((item) => item.name)),
    [data],
  );

  if (data.length === 0) {
    return <p className={styles.empty}>Nenhum colaborador ativo.</p>;
  }

  const chartWidth = data.length * (BAR_WIDTH + BAR_GAP) + BAR_GAP;
  const plotHeight = CHART_HEIGHT - LABEL_HEIGHT;

  function scaleY(value: number): number {
    return plotHeight - (value / maxValue) * plotHeight;
  }

  const linePoints = data.map((item, index) => ({
    x: BAR_GAP + index * (BAR_WIDTH + BAR_GAP) + BAR_WIDTH / 2,
    y: scaleY(item.horasTickets),
    item,
  }));
  const linePath = linePoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");

  const yTicks = [0, maxValue / 2, maxValue];

  // Explicit pixel width/height (matching the viewBox 1:1) instead of the
  // CSS `width: 100%; height: auto` stretch this replaced: without an
  // intrinsic size, a viewBox-only <svg> stretched to a wide container
  // computes its height from the viewBox's aspect ratio, which — for a
  // narrow chart (few employees) — blows the height up to several times
  // the intended ~260px. Fixing the pixel size keeps height constant
  // regardless of employee count; the scrollable wrapper handles the
  // opposite edge (many employees making the chart wider than its card).
  const totalWidth = chartWidth + AXIS_LABEL_WIDTH;
  const totalHeight = CHART_HEIGHT + 20 + LABEL_BOTTOM_MARGIN;

  return (
    <div className={styles.chartWrapper}>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendSwatchTrabalhadas}`} />
          Horas Trabalhadas
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendSwatchTickets}`} />
          Horas em Tickets
        </span>
      </div>
      <div className={styles.chartScroll}>
        <svg
          viewBox={`0 -20 ${totalWidth} ${totalHeight}`}
          width={totalWidth}
          height={totalHeight}
          className={styles.chartSvg}
          role="img"
          aria-label="Gráfico de horas trabalhadas e horas lançadas em tickets por colaborador"
        >
          <g transform={`translate(${AXIS_LABEL_WIDTH}, 0)`}>
            {yTicks.map((tick) => (
              <g key={tick}>
                <line x1={0} x2={chartWidth} y1={scaleY(tick)} y2={scaleY(tick)} className={styles.gridline} />
                <text x={-8} y={scaleY(tick)} textAnchor="end" dominantBaseline="middle" className={styles.axisLabel}>
                  {tick}
                </text>
              </g>
            ))}

            {data.map((item, index) => {
              const x = BAR_GAP + index * (BAR_WIDTH + BAR_GAP);
              const barY = scaleY(item.horasTrabalhadas);
              const barHeight = plotHeight - barY;
              const isHovered = hoveredUserId === item.userId;
              return (
                <g
                  key={item.userId}
                  onMouseEnter={() => setHoveredUserId(item.userId)}
                  onMouseLeave={() => setHoveredUserId((current) => (current === item.userId ? null : current))}
                >
                  <rect x={x} y={0} width={BAR_WIDTH} height={plotHeight} fill="transparent" />
                  <path d={roundedTopRectPath(x, barY, BAR_WIDTH, barHeight, 4)} className={styles.bar} />
                  <text x={x + BAR_WIDTH / 2} y={barY - 6} textAnchor="middle" className={styles.barValueLabel}>
                    {item.horasTrabalhadas}
                  </text>
                  <text
                    x={x + BAR_WIDTH / 2}
                    y={plotHeight + 16}
                    textAnchor="end"
                    className={styles.employeeLabel}
                    transform={`rotate(-35, ${x + BAR_WIDTH / 2}, ${plotHeight + 16})`}
                  >
                    {item.name}
                  </text>
                  {isHovered ? (
                    <text x={x + BAR_WIDTH / 2} y={plotHeight + 30} textAnchor="middle" className={styles.tooltip}>
                      {item.horasTrabalhadas}h trabalhadas · {item.horasTickets}h em tickets
                    </text>
                  ) : null}
                </g>
              );
            })}

            <path d={linePath} className={styles.line} fill="none" />
            {linePoints.map((point) => (
              <circle key={point.item.userId} cx={point.x} cy={point.y} r={5} className={styles.marker} />
            ))}
            {linePoints.map((point) => (
              <text key={point.item.userId} x={point.x} y={point.y - 10} textAnchor="middle" className={styles.lineValueLabel}>
                {point.item.horasTickets}
              </text>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
