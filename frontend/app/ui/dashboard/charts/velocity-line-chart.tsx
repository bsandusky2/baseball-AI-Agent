'use client';

import { useEffect, useState } from 'react';

type Point = { velocity: number; xwoba: number; low: number; high: number };
type ChartData = { points: Point[] };

const WIDTH = 400;
const HEIGHT = 200;
const PAD_LEFT = 36;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;
const LINE_COLOR = '#e34948'; // dataviz skill categorical slot 8 (red)
const BAND_COLOR = 'rgba(227, 73, 72, 0.18)';

function niceMax(value: number) {
  return Math.max(0.2, Math.ceil(value / 0.2) * 0.2);
}

export default function VelocityLineChart({ fetchUrl }: { fetchUrl: string }) {
  const [data, setData] = useState<ChartData | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch(fetchUrl)
      .then((res) => res.json())
      .then(setData)
      .catch((err) => console.error('Failed to load xwOBA by velocity', err));
  }, [fetchUrl]);

  const points = data?.points ?? [];
  if (points.length === 0) {
    return (
      <ChartShell title="xwOBA by Velocity">
        <p className="py-16 text-center text-xs text-gray-600">No data yet</p>
      </ChartShell>
    );
  }

  const velocities = points.map((p) => p.velocity);
  const minV = Math.min(...velocities);
  const maxV = Math.max(...velocities);
  const maxY = niceMax(Math.max(...points.map((p) => p.high)));

  const x = (v: number) =>
    PAD_LEFT + ((v - minV) / (maxV - minV || 1)) * (WIDTH - PAD_LEFT - PAD_RIGHT);
  const y = (v: number) => HEIGHT - PAD_BOTTOM - (v / maxY) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.velocity)} ${y(p.xwoba)}`).join(' ');
  const bandPath =
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.velocity)} ${y(p.high)}`).join(' ') +
    ' ' +
    points
      .slice()
      .reverse()
      .map((p) => `L ${x(p.velocity)} ${y(p.low)}`)
      .join(' ') +
    ' Z';

  const yTicks = [0, maxY / 3, (maxY / 3) * 2, maxY];

  return (
    <ChartShell title="xwOBA by Velocity">
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={y(t)}
                y2={y(t)}
                stroke="#2c2c2a"
                strokeWidth={1}
              />
              <text x={PAD_LEFT - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="#898781">
                {t.toFixed(3)}
              </text>
            </g>
          ))}

          <path d={bandPath} fill={BAND_COLOR} stroke="none" />
          <path d={linePath} fill="none" stroke={LINE_COLOR} strokeWidth={2} strokeLinecap="round" />

          {points.map((p, i) => (
            <circle
              key={p.velocity}
              cx={x(p.velocity)}
              cy={y(p.xwoba)}
              r={hoverIndex === i ? 5 : 4}
              fill={LINE_COLOR}
              stroke="#1a1a19"
              strokeWidth={1.5}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              style={{ cursor: 'pointer' }}
            />
          ))}

          {points.map((p) => (
            <text
              key={`x-${p.velocity}`}
              x={x(p.velocity)}
              y={HEIGHT - 6}
              textAnchor="middle"
              fontSize={9}
              fill="#898781"
            >
              {p.velocity}
            </text>
          ))}
        </svg>

        {hoverIndex !== null && (
          <div
            className="pointer-events-none absolute rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-[10px] text-gray-200 shadow-lg"
            style={{
              left: `${(x(points[hoverIndex].velocity) / WIDTH) * 100}%`,
              top: `${(y(points[hoverIndex].xwoba) / HEIGHT) * 100}%`,
              transform: 'translate(-50%, -130%)',
            }}
          >
            {points[hoverIndex].velocity} mph &middot; {points[hoverIndex].xwoba.toFixed(3)} xwOBA
          </div>
        )}
      </div>

      <p className="mt-1 text-center text-[10px] uppercase tracking-wide text-gray-500">
        Velocity (mph)
      </p>
    </ChartShell>
  );
}

function ChartShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}
