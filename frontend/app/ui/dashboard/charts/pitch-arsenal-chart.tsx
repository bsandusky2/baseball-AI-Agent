'use client';

import { useEffect, useState } from 'react';

type PitchStat = {
  pitch_type: string;
  pitch_name: string;
  count: number;
  pct: number;
  avg_speed: number;
  speed_stddev: number;
  avg_break_x: number;
  break_x_stddev: number;
  avg_drop: number;
  drop_stddev: number;
};
type ChartData = { pitches: PitchStat[] };

const WIDTH = 320;
const HEIGHT = 260;
const PAD_LEFT = 44;
const PAD_RIGHT = 14;
const PAD_TOP = 14;
const PAD_BOTTOM = 50;

const SPEED_WIDTH = 110;
const SPEED_HEIGHT = 20;

// Fixed pitch-type -> categorical slot, per the dataviz skill's "color
// follows the entity, never its rank" rule — a given pitch type keeps its
// color across every pitcher's card instead of being reassigned by how many
// pitch types that pitcher happens to throw. Slots are the dark-surface
// steps (this app is dark-only), reused from color-scale.ts's palette.
// Rare/exotic pitch types that essentially never co-occur with their
// same-family pitch share a slot; the truly odd ones (knuckleball, eephus,
// screwball, pitch-outs, unclassified) fold into a muted "other" color
// rather than spending a distinct hue on a handful of pitches.
const PITCH_COLORS: Record<string, string> = {
  FF: '#e66767', // red — four-seam
  SI: '#d95926', // orange — sinker
  FC: '#3987e5', // blue — cutter
  SL: '#c98500', // yellow — slider
  ST: '#d55181', // magenta — sweeper
  CH: '#199e70', // aqua — changeup
  FS: '#199e70', // aqua — splitter (offspeed/sinking family with changeup)
  FO: '#199e70', // aqua — forkball
  CU: '#9085e9', // violet — curveball
  SV: '#9085e9', // violet — slurve (curve family)
  KC: '#008300', // green — knuckle curve
};
const OTHER_COLOR = '#898781';

function colorFor(pitchType: string) {
  return PITCH_COLORS[pitchType] ?? OTHER_COLOR;
}

function ChartShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-white">Pitch Arsenal</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function PitchArsenalChart({ fetchUrl }: { fetchUrl: string }) {
  const [data, setData] = useState<ChartData | null>(null);

  useEffect(() => {
    setData(null);
    fetch(fetchUrl)
      .then((res) => res.json())
      .then(setData)
      .catch((err) => console.error('Failed to load pitch arsenal', err));
  }, [fetchUrl]);

  const pitches = data?.pitches ?? [];
  if (data && pitches.length === 0) {
    return (
      <ChartShell>
        <p className="py-16 text-center text-xs text-gray-600">No data yet</p>
      </ChartShell>
    );
  }
  if (!data) {
    return (
      <ChartShell>
        <p className="py-16 text-center text-xs text-gray-600">Loading…</p>
      </ChartShell>
    );
  }

  const maxPct = Math.max(...pitches.map((p) => p.pct));

  const speeds = pitches.flatMap((p) => [p.avg_speed - p.speed_stddev, p.avg_speed + p.speed_stddev]);
  const speedMin = Math.floor((Math.min(...speeds) - 2) / 5) * 5;
  const speedMax = Math.ceil((Math.max(...speeds) + 2) / 5) * 5;
  const speedX = (v: number) =>
    (Math.max(speedMin, Math.min(speedMax, v)) - speedMin) / (speedMax - speedMin || 1) * SPEED_WIDTH;

  const maxBreakX = Math.max(4, ...pitches.map((p) => Math.abs(p.avg_break_x) + p.break_x_stddev));
  const breakXDomain = Math.ceil((maxBreakX + 2) / 6) * 6;
  const maxDrop = Math.max(10, ...pitches.map((p) => p.avg_drop + p.drop_stddev));
  const dropDomain = Math.ceil((maxDrop + 4) / 10) * 10;

  const mx = (v: number) => PAD_LEFT + ((v + breakXDomain) / (breakXDomain * 2)) * (WIDTH - PAD_LEFT - PAD_RIGHT);
  const my = (v: number) => PAD_TOP + (v / dropDomain) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
  // Ellipse radii are in the same inches unit as the axes, so scale them by
  // each axis's own pixels-per-inch rather than sharing one scale factor.
  const pxPerInchX = (WIDTH - PAD_LEFT - PAD_RIGHT) / (breakXDomain * 2);
  const pxPerInchY = (HEIGHT - PAD_TOP - PAD_BOTTOM) / dropDomain;

  const breakXTicks = [];
  for (let t = -breakXDomain; t <= breakXDomain; t += breakXDomain / 3) breakXTicks.push(Math.round(t));
  const dropTicks = [];
  for (let t = 0; t <= dropDomain; t += dropDomain / 4) dropTicks.push(Math.round(t));

  return (
    <ChartShell>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Frequency + speed */}
        <div className="flex flex-col justify-center gap-3">
          {pitches.map((p) => {
            const color = colorFor(p.pitch_type);
            return (
              <div key={p.pitch_type} className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-gray-950"
                  style={{ backgroundColor: color }}
                >
                  {p.pitch_type}
                </span>
                <div className="w-28 shrink-0">
                  <p className="text-xs font-semibold leading-tight text-white">{p.pitch_name}</p>
                  <p className="text-[10px] text-gray-500">{(p.pct * 100).toFixed(1)}%</p>
                </div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(p.pct / maxPct) * 100}%`, backgroundColor: color }}
                  />
                </div>
                <div className="shrink-0">
                  <svg width={SPEED_WIDTH} height={SPEED_HEIGHT} viewBox={`0 0 ${SPEED_WIDTH} ${SPEED_HEIGHT}`}>
                    <line
                      x1={speedX(p.avg_speed - p.speed_stddev)}
                      x2={speedX(p.avg_speed + p.speed_stddev)}
                      y1={SPEED_HEIGHT / 2}
                      y2={SPEED_HEIGHT / 2}
                      stroke={color}
                      strokeOpacity={0.45}
                      strokeWidth={4}
                      strokeLinecap="round"
                    />
                    <circle cx={speedX(p.avg_speed)} cy={SPEED_HEIGHT / 2} r={4} fill={color} />
                  </svg>
                  <p className="text-center text-[10px] text-gray-500">{p.avg_speed.toFixed(1)} mph</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Movement plot */}
        <div>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
            <rect
              x={PAD_LEFT}
              y={PAD_TOP}
              width={WIDTH - PAD_LEFT - PAD_RIGHT}
              height={HEIGHT - PAD_TOP - PAD_BOTTOM}
              fill="#141413"
            />
            {dropTicks.map((t) => (
              <g key={`y-${t}`}>
                <line
                  x1={PAD_LEFT}
                  x2={WIDTH - PAD_RIGHT}
                  y1={my(t)}
                  y2={my(t)}
                  stroke="#2c2c2a"
                  strokeWidth={1}
                />
                <text x={PAD_LEFT - 6} y={my(t) + 3} textAnchor="end" fontSize={8} fill="#898781">
                  {t}&quot;
                </text>
              </g>
            ))}
            {breakXTicks.map((t) => (
              <line
                key={`x-${t}`}
                x1={mx(t)}
                x2={mx(t)}
                y1={PAD_TOP}
                y2={HEIGHT - PAD_BOTTOM}
                stroke={t === 0 ? '#52514e' : '#2c2c2a'}
                strokeWidth={t === 0 ? 1.5 : 1}
              />
            ))}
            {breakXTicks.map((t) => (
              <text key={`xl-${t}`} x={mx(t)} y={HEIGHT - PAD_BOTTOM + 12} textAnchor="middle" fontSize={8} fill="#898781">
                {Math.abs(t)}&quot;
              </text>
            ))}

            {pitches.map((p) => {
              const color = colorFor(p.pitch_type);
              const rx = Math.max(3, p.break_x_stddev * pxPerInchX);
              const ry = Math.max(3, p.drop_stddev * pxPerInchY);
              return (
                <g key={p.pitch_type}>
                  <ellipse
                    cx={mx(p.avg_break_x)}
                    cy={my(p.avg_drop)}
                    rx={rx}
                    ry={ry}
                    fill={color}
                    fillOpacity={0.35}
                    stroke={color}
                    strokeWidth={1.5}
                  />
                  <circle cx={mx(p.avg_break_x)} cy={my(p.avg_drop)} r={2.5} fill={color} />
                  <text
                    x={mx(p.avg_break_x)}
                    y={my(p.avg_drop) + 3}
                    textAnchor="middle"
                    fontSize={8}
                    fontWeight={700}
                    fill="#0b0b0b"
                    stroke="#fcfcfb"
                    strokeWidth={2}
                    paintOrder="stroke"
                  >
                    {p.pitch_type}
                  </text>
                </g>
              );
            })}
          </svg>

          <p className="mt-1 text-center text-[10px] uppercase tracking-wide text-gray-500">
            Horizontal Break · Downward Vertical Break
          </p>
          <div className="mt-0.5 flex justify-between text-[9px] italic text-gray-600">
            <span>Moves toward third base side</span>
            <span>Moves toward first base side</span>
          </div>
        </div>
      </div>
    </ChartShell>
  );
}
