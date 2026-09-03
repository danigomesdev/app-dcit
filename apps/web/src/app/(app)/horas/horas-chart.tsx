"use client";

import { useMemo, useState } from "react";

import styles from "./horas.module.css";

type HorasResumoItem = { userId: string; name: string; horasTrabalhadas: number; horasTickets: number };

const CHART_HEIGHT = 260;
const BAR_WIDTH = 24;
const BAR_GAP = 20;
const LABEL_HEIGHT = 40;
const AXIS_LABEL_WIDTH = 32;

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
  const totalHeight = CHART_HEIGHT + 20;

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
