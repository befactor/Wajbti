"use client";

import { useState } from "react";

export type BarDatum = { key: string; label: string; tooltipLabel: string; value: number };

const W = 320;
const H = 150;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;

// Single-series bar chart: one hue, 4px rounded tops anchored to the
// baseline, an optional dashed goal line, and tap/hover to read a value.
export function BarChart({
  data,
  color,
  goal,
  goalLabel,
  formatValue,
  highlightKey,
  rtl = false,
}: {
  data: BarDatum[];
  color: string;
  goal?: number;
  goalLabel?: string;
  formatValue: (v: number) => string;
  highlightKey?: string;
  rtl?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(goal ?? 0, ...data.map((d) => d.value), 1) * 1.08;
  const slot = W / data.length;
  const barW = Math.min(22, Math.max(4, slot - 4));
  const y = (v: number) => PAD_TOP + PLOT_H - (v / max) * PLOT_H;
  const baseline = PAD_TOP + PLOT_H;
  const shown = active != null ? data[active] : null;
  const labelEvery = data.length > 10 ? 5 : 1;

  return (
    <div className="chart">
      <p className="chart-readout">{shown ? `${shown.tooltipLabel} · ${formatValue(shown.value)}` : " "}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" onMouseLeave={() => setActive(null)} role="img">
        <line x1={0} x2={W} y1={baseline} y2={baseline} className="chart-axis" />
        {data.map((d, i) => {
          const pos = rtl ? data.length - 1 - i : i;
          const cx = slot * pos + slot / 2;
          const top = y(d.value);
          const h = Math.max(0, baseline - top);
          const r = Math.min(4, h, barW / 2);
          const x0 = cx - barW / 2;
          const isActive = active === i;
          const isHighlight = d.key === highlightKey;
          return (
            <g key={d.key}>
              <rect
                x={slot * pos}
                y={PAD_TOP}
                width={slot}
                height={PLOT_H + PAD_BOTTOM}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
                onClick={() => setActive(isActive ? null : i)}
              />
              {h > 0 ? (
                <path
                  d={`M${x0},${baseline} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${baseline} Z`}
                  fill={color}
                  opacity={active == null || isActive ? 1 : 0.45}
                  pointerEvents="none"
                />
              ) : (
                <rect x={x0} y={baseline - 3} width={barW} height={3} rx={1.5} className="chart-empty" pointerEvents="none" />
              )}
              {i % labelEvery === 0 && (
                <text x={cx} y={H - 6} textAnchor="middle" className={`chart-label ${isHighlight ? "strong" : ""}`}>
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
        {goal != null && goal > 0 && (
          <>
            <line x1={0} x2={W} y1={y(goal)} y2={y(goal)} className="chart-goal" pointerEvents="none" />
            {goalLabel && (
              <text x={rtl ? 2 : W - 2} y={y(goal) - 4} textAnchor={rtl ? "start" : "end"} className="chart-label" pointerEvents="none">
                {goalLabel}
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  );
}

export type LinePoint = { key: string; label: string; value: number };

// Weight trend: 2px line, 8px markers with a surface ring, 3 recessive
// gridlines, tap/hover a point to read it.
export function LineChart({
  points,
  color,
  formatValue,
  emptyLabel,
  rtl = false,
}: {
  points: LinePoint[];
  color: string;
  formatValue: (v: number) => string;
  emptyLabel: string;
  rtl?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) return <p className="chart-empty-text">{emptyLabel}</p>;

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = Math.max(2, rawMax - rawMin);
  const lo = Math.floor(rawMin - spread * 0.25);
  const hi = Math.ceil(rawMax + spread * 0.25);
  const AXIS = 30;
  const plotW = W - AXIS - 10;
  const plotStart = rtl ? 10 : AXIS;
  const frac = (i: number) => (points.length === 1 ? 0.5 : i / (points.length - 1));
  const x = (i: number) => plotStart + (rtl ? 1 - frac(i) : frac(i)) * plotW;
  const axisX = rtl ? W - AXIS + 6 : AXIS - 6;
  const y = (v: number) => PAD_TOP + PLOT_H - ((v - lo) / (hi - lo)) * PLOT_H;
  const grid = [lo, (lo + hi) / 2, hi];
  const shown = active != null ? points[active] : null;

  return (
    <div className="chart">
      <p className="chart-readout">{shown ? `${shown.label} · ${formatValue(shown.value)}` : " "}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" onMouseLeave={() => setActive(null)} role="img">
        {grid.map((g) => (
          <g key={g}>
            <line x1={plotStart} x2={plotStart + plotW} y1={y(g)} y2={y(g)} className="chart-grid" />
            <text x={axisX} y={y(g) + 3} textAnchor={rtl ? "start" : "end"} className="chart-label">
              {Math.round(g)}
            </text>
          </g>
        ))}
        {points.length > 1 && (
          <polyline
            points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((p, i) => (
          <g key={p.key}>
            <circle cx={x(i)} cy={y(p.value)} r={active === i ? 6 : 4} fill={color} stroke="#fff" strokeWidth={2} />
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={14}
              fill="transparent"
              onMouseEnter={() => setActive(i)}
              onClick={() => setActive(active === i ? null : i)}
            />
          </g>
        ))}
        <text x={x(0)} y={H - 6} textAnchor={rtl ? "end" : "start"} className="chart-label">
          {points[0].label}
        </text>
        {points.length > 1 && (
          <text x={x(points.length - 1)} y={H - 6} textAnchor={rtl ? "start" : "end"} className="chart-label">
            {points[points.length - 1].label}
          </text>
        )}
      </svg>
    </div>
  );
}
