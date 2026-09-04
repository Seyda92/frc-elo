"use client";

import { useId, useState } from "react";
import type { EloPoint } from "@/lib/format";

type Props = {
  points: EloPoint[];
  className?: string;
};

/** Wählt eine lesbare Teilmenge der Punktindizes für die X-Achsenlabels aus
 *  — immer erster und letzter Punkt, dazwischen so viele wie ohne
 *  Überlappung auf die Breite passen. */
function pickLabelIndices(count: number, maxLabels: number): number[] {
  if (count <= maxLabels) return Array.from({ length: count }, (_, i) => i);
  const step = (count - 1) / (maxLabels - 1);
  const indices = new Set<number>();
  for (let i = 0; i < maxLabels; i++) {
    indices.add(Math.round(i * step));
  }
  return [...indices].sort((a, b) => a - b);
}

export function EloSparkline({ points, className = "" }: Props) {
  const gradientId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (points.length < 2) return null;

  const values = points.map((p) => p.elo);
  const min = Math.min(...values) - 20;
  const max = Math.max(...values) + 20;
  const w = 320;
  const h = 140;
  const pad = 8;
  const axisLabelWidth = 30;
  const plotLeft = pad + axisLabelWidth;
  const plotTop = 10;
  const plotBottom = h - 24;

  const coords = values.map((v, i) => {
    const x =
      plotLeft + (i / (values.length - 1)) * (w - plotLeft - pad);
    const y =
      plotBottom - ((v - min) / (max - min)) * (plotBottom - plotTop);
    return { x, y, v, label: points[i].label };
  });

  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  const area = `${path} L ${coords[coords.length - 1].x} ${plotBottom} L ${coords[0].x} ${plotBottom} Z`;

  const maxLabels = Math.max(2, Math.floor((w - plotLeft) / 55));
  const labelIndices = new Set(pickLabelIndices(coords.length, maxLabels));

  const active = activeIndex != null ? coords[activeIndex] : null;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`h-auto w-full ${className}`}
      role="img"
      aria-label="ELO-Verlauf"
      onMouseLeave={() => setActiveIndex(null)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#17a2a0" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#17a2a0" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y-Achse: min/max als Beschriftung links */}
      <text x={pad} y={plotTop + 4} className="fill-foam-muted" style={{ fontSize: 9 }}>
        {Math.round(max)}
      </text>
      <text x={pad} y={plotBottom} className="fill-foam-muted" style={{ fontSize: 9 }}>
        {Math.round(min)}
      </text>
      <line
        x1={plotLeft}
        y1={plotTop}
        x2={plotLeft}
        y2={plotBottom}
        stroke="#2c3838"
        strokeWidth="1"
      />

      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={path}
        fill="none"
        stroke="#17a2a0"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {coords.map((c, i) => (
        <g key={i}>
          {labelIndices.has(i) ? (
            <text
              x={c.x}
              y={h - 6}
              textAnchor="middle"
              className="fill-foam-muted"
              style={{ fontSize: 9 }}
            >
              {c.label}
            </text>
          ) : null}
          <circle
            cx={c.x}
            cy={c.y}
            r="3.5"
            fill="#f3ead8"
            stroke="#17a2a0"
            strokeWidth="1.5"
          />
          {/* Größerer unsichtbarer Tap-/Hover-Bereich, damit die
              Interaktion auf einem Touch-Gerät zuverlässig trifft. */}
          <circle
            cx={c.x}
            cy={c.y}
            r="12"
            fill="transparent"
            onMouseEnter={() => setActiveIndex(i)}
            onClick={() => setActiveIndex(i === activeIndex ? null : i)}
          />
        </g>
      ))}

      {active ? (
        <EloTooltip point={active} chartWidth={w} />
      ) : null}
    </svg>
  );
}

function EloTooltip({
  point,
  chartWidth,
}: {
  point: { x: number; y: number; v: number; label: string };
  chartWidth: number;
}) {
  const text = `${point.label} · ${point.v}`;
  const boxWidth = 14 + text.length * 5.2;
  const boxHeight = 22;
  let boxX = point.x - boxWidth / 2;
  boxX = Math.max(2, Math.min(chartWidth - boxWidth - 2, boxX));
  const boxY = Math.max(2, point.y - boxHeight - 10);

  return (
    <g pointerEvents="none">
      <line
        x1={point.x}
        y1={point.y}
        x2={point.x}
        y2={boxY + boxHeight}
        stroke="#17a2a0"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <rect
        x={boxX}
        y={boxY}
        width={boxWidth}
        height={boxHeight}
        rx="3"
        fill="#182020"
        stroke="#17a2a0"
        strokeWidth="1"
      />
      <text
        x={boxX + boxWidth / 2}
        y={boxY + boxHeight / 2 + 4}
        textAnchor="middle"
        className="fill-foam"
        style={{ fontSize: 10, fontWeight: 600 }}
      >
        {text}
      </text>
    </g>
  );
}
