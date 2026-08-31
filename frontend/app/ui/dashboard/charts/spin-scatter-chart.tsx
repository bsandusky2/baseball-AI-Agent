'use client';

import { useEffect, useState } from 'react';

type ScatterPoint = { spin_rate: number; whiff_rate: number };
type ChartData = { points: ScatterPoint[]; trend_line: ScatterPoint[] };

const WIDTH = 400;
const HEIGHT = 200;
const PAD_LEFT = 32;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;
const DOT_COLOR = 'rgba(227, 73, 72, 0.65)'; // dataviz skill categorical slot 8 (red)
const TREND_COLOR = '#c3c2b7';

export default function SpinScatterChart({ fetchUrl }: { fetchUrl: string }) {
  const [data, setData] = useState<ChartData | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch(fetchUrl)
      .then((res) => res.json())
      .then(setData)
      .catch((err) => console.error('Failed to load whiff rate by spin rate', err));
  }, [fetchUrl]);

  const points = data?.points ?? [];
  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
        <h3 className="text-sm font-semibold text-white">Whiff Rate by Spin Rate</h3>
        <p className="py-16 text-center text-xs text-gray-600">No data yet</p>
      </div>
    );
  }

  const spinRates = points.map((p) => p.spin_rate);
  const minSpin = Math.min(...spinRates);
  const maxSpin = Math.max(...spinRates);
  const maxWhiff = Math.max(0.2, Math.ceil(Math.max(...points.map((p) => p.whiff_rate)) / 0.2) * 0.2);

  const x = (v: number) =>
    PAD_LEFT + ((v - minSpin) / (maxSpin - minSpin || 1)) * (WIDTH - PAD_LEFT - PAD_RIGHT);
  const y = (v: number) => HEIGHT - PAD_BOTTOM - (v / maxWhiff) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

  const yTicks = [0, maxWhiff / 2, maxWhiff];
  const trend = data?.trend_line ?? [];

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-white">Whiff Rate by Spin Rate</h3>

      <div className="relative mt-4">
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
                {(t * 100).toFixed(0)}%
              </text>
            </g>
          ))}

          {trend.length === 2 && (
            <line
              x1={x(trend[0].spin_rate)}
              y1={y(trend[0].whiff_rate)}
              x2={x(trend[1].spin_rate)}
              y2={y(trend[1].whiff_rate)}
              stroke={TREND_COLOR}
              strokeWidth={1.5}
            />
          )}

          {points.map((p, i) => (
            <circle
              key={`${p.spin_rate}-${i}`}
              cx={x(p.spin_rate)}
              cy={y(p.whiff_rate)}
              r={hoverIndex === i ? 5 : 4}
              fill={DOT_COLOR}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              style={{ cursor: 'pointer' }}
            />
          ))}

          {[minSpin, (minSpin + maxSpin) / 2, maxSpin].map((v) => (
            <text key={v} x={x(v)} y={HEIGHT - 6} textAnchor="middle" fontSize={9} fill="#898781">
              {Math.round(v)}
            </text>
          ))}
        </svg>

        {hoverIndex !== null && (
          <div
            className="pointer-events-none absolute rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-[10px] text-gray-200 shadow-lg"
            style={{
              left: `${(x(points[hoverIndex].spin_rate) / WIDTH) * 100}%`,
              top: `${(y(points[hoverIndex].whiff_rate) / HEIGHT) * 100}%`,
              transform: 'translate(-50%, -130%)',
            }}
          >
            {points[hoverIndex].spin_rate} rpm &middot; {(points[hoverIndex].whiff_rate * 100).toFixed(1)}%
          </div>
        )}
      </div>

      <p className="mt-1 text-center text-[10px] uppercase tracking-wide text-gray-500">
        Spin Rate (rpm)
      </p>
    </div>
  );
}
