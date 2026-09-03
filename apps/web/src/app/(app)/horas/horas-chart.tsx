"use client";

import { useMemo, useState } from "react";

import styles from "./horas.module.css";

type HorasResumoItem = { userId: string; name: string; horasTrabalhadas: number; horasTickets: number };

const CHART_HEIGHT = 260;
const BAR_WIDTH = 24;
const BAR_GAP = 20;
const LABEL_HEIGHT = 40;
// Reserves room to the left of the first bar for the y-axis tick numbers,
// plus a small buffer so the first employee's rotated name label
// (text-anchor="end" + rotate(-35, ...) extends leftward from its bar)
// doesn't shave its first character or two against local x=0. This is a
// minor effect (~2-3px for this app's actual dev-seed names) — the much
// bigger effect is vertical, handled by LABEL_BOTTOM_MARGIN below.
const AXIS_LABEL_WIDTH = 48;
// A rotated label doesn't just reach left of its pivot — it also reaches
// *down* past it (rotate(-35, ...) on a text-anchor="end" string moves
// its start point down-and-left, not just left). `.chartScroll`'s
// `overflow-x: auto` was added in the previous fix round to handle wide
// (many-employee) charts, but CSS forces `overflow-y` to compute as
// `auto` too whenever `overflow-x` isn't `visible` and `overflow-y` is
// (an unavoidable coupling per the CSS Overflow spec — you cannot have
// "auto" on one axis and "visible" on the other on the same element).
// That silently clips anything that bleeds below the box's fixed height,
// which is exactly what a long rotated label does. This was the *actual*
// cause of the label clipping bug reported in review — not primarily the
// horizontal reach AXIS_LABEL_WIDTH addresses above, which was the
// initial hypothesis but didn't hold up under measurement (increasing it
// from 32 to 400 barely changed what was visible). Verified by computing
// each label's downward reach — pivotY(236) + sin(35°)*textLength — for
// this app's real dev-seed names: only "Carla RH" (8 chars) stayed under
// the old bottom edge (local y=260); "Ana Colaboradora", "Bruno Gestor",
// and "Daniel Gomes de Oliveira" all exceeded it, worst-to-least exactly
// matching the clipping severity seen in screenshots. Fix: make the box
// tall enough that nothing needs to overflow in the first place — an
// "auto" overflow that never triggers is visually identical to "visible".
const LABEL_BOTTOM_MARGIN = 70;

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
