import type { Player } from "@/data/dummy";

type Props = {
  points: Player["eloHistory"];
  className?: string;
};

export function EloSparkline({ points, className = "" }: Props) {
  if (points.length < 2) return null;

  const values = points.map((p) => p.elo);
  const min = Math.min(...values) - 20;
  const max = Math.max(...values) + 20;
  const w = 320;
  const h = 120;
  const pad = 8;

  const coords = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
    return { x, y, v, label: points[i].label };
  });

  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  const area = `${path} L ${coords[coords.length - 1].x} ${h} L ${coords[0].x} ${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`h-auto w-full ${className}`}
      role="img"
      aria-label="ELO-Verlauf"
    >
      <defs>
        <linearGradient id="eloFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e6a423" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#e6a423" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#eloFill)" />
      <path
        d={path}
        fill="none"
        stroke="#e6a423"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {coords.map((c) => (
        <g key={c.label}>
          <circle cx={c.x} cy={c.y} r="3.5" fill="#f3ead8" stroke="#e6a423" strokeWidth="1.5" />
          <text
            x={c.x}
            y={h - 1}
            textAnchor="middle"
            className="fill-foam-muted"
            style={{ fontSize: 9 }}
          >
            {c.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
