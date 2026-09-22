'use client';

import { useEffect, useState } from 'react';

type Metric = { value: number; league_avg: number };
type BatSpeed = Metric & { percentile_curve: { percentile: number; value: number }[] };
type ChartData = {
  swings: number;
  bat_speed: BatSpeed | null;
  attack_angle: Metric | null;
  attack_direction: Metric | null;
  swing_path_tilt: Metric | null;
};

const ACCENT = '#e34948'; // dataviz skill categorical slot 8 (red)

const CURVE_WIDTH = 320;
const CURVE_HEIGHT = 150;
const CURVE_PAD_LEFT = 32;
const CURVE_PAD_RIGHT = 8;
const CURVE_PAD_TOP = 8;
const CURVE_PAD_BOTTOM = 8;

function PercentileCurve({ curve, leagueAvg }: { curve: { percentile: number; value: number }[]; leagueAvg: number }) {
  const maxY = 90; // Statcast's own bat-speed gauge ceiling, kept fixed so the curve reads on a consistent scale across players
  const x = (p: number) => CURVE_PAD_LEFT + (p / 100) * (CURVE_WIDTH - CURVE_PAD_LEFT - CURVE_PAD_RIGHT);
  const y = (v: number) =>
    CURVE_HEIGHT - CURVE_PAD_BOTTOM - (v / maxY) * (CURVE_HEIGHT - CURVE_PAD_TOP - CURVE_PAD_BOTTOM);
  const path = curve.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.percentile)} ${y(p.value)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${CURVE_WIDTH} ${CURVE_HEIGHT}`} className="w-full">
      <line
        x1={CURVE_PAD_LEFT}
        x2={CURVE_WIDTH - CURVE_PAD_RIGHT}
        y1={y(leagueAvg)}
        y2={y(leagueAvg)}
        stroke="#898781"
        strokeWidth={1}
        strokeDasharray="3,3"
      />
      <text x={CURVE_PAD_LEFT - 4} y={y(leagueAvg) - 3} fontSize={8} fill="#898781" textAnchor="end">
        {leagueAvg.toFixed(0)}
      </text>
      <text x={CURVE_PAD_LEFT - 4} y={y(0) + 3} fontSize={8} fill="#898781" textAnchor="end">
        0
      </text>
      <text x={CURVE_PAD_LEFT - 4} y={y(maxY) + 3} fontSize={8} fill="#898781" textAnchor="end">
        {maxY}
      </text>
      <path d={path} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" />
      {curve.map((p) => (
        <circle key={p.percentile} cx={x(p.percentile)} cy={y(p.value)} r={2} fill={ACCENT} />
      ))}
    </svg>
  );
}

function MetricsTable({ rows }: { rows: { label: string; value: number; leagueAvg: number; unit: string }[] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-gray-500">
          <th className="pb-2 pr-4 font-medium">Metric</th>
          <th className="pb-2 pr-4 font-medium">Value</th>
          <th className="pb-2 font-medium">MLB Avg</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-t border-gray-800">
            <td className="py-2 pr-4 text-gray-300">{row.label}</td>
            <td className="py-2 pr-4 font-semibold text-white">
              {row.value.toFixed(0)}
              {row.unit}
            </td>
            <td className="py-2 text-gray-400">
              {row.leagueAvg.toFixed(0)}
              {row.unit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChartShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-white">Swing Profile</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function SwingProfileChart({ fetchUrl }: { fetchUrl: string }) {
  const [data, setData] = useState<ChartData | null>(null);

  useEffect(() => {
    setData(null);
    fetch(fetchUrl)
      .then((res) => res.json())
      .then(setData)
      .catch((err) => console.error('Failed to load swing profile', err));
  }, [fetchUrl]);

  if (!data) {
    return (
      <ChartShell>
        <p className="py-16 text-center text-xs text-gray-600">Loading…</p>
      </ChartShell>
    );
  }
  if (!data.bat_speed || !data.attack_angle || !data.attack_direction || !data.swing_path_tilt) {
    return (
      <ChartShell>
        <p className="py-16 text-center text-xs text-gray-600">No bat-tracking data yet</p>
      </ChartShell>
    );
  }

  const rows = [
    { label: 'Bat Speed', value: data.bat_speed.value, leagueAvg: data.bat_speed.league_avg, unit: ' mph' },
    { label: 'Attack Angle', value: data.attack_angle.value, leagueAvg: data.attack_angle.league_avg, unit: '°' },
    {
      label: 'Attack Direction',
      value: data.attack_direction.value,
      leagueAvg: data.attack_direction.league_avg,
      unit: '°',
    },
    {
      label: 'Swing Path Tilt',
      value: data.swing_path_tilt.value,
      leagueAvg: data.swing_path_tilt.league_avg,
      unit: '°',
    },
  ];

  return (
    <ChartShell>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <PercentileCurve curve={data.bat_speed.percentile_curve} leagueAvg={data.bat_speed.league_avg} />
          <p className="text-center text-[10px] uppercase tracking-wide text-gray-500">
            This player&apos;s swing speed, slowest to fastest
          </p>
        </div>
        <div className="flex flex-col justify-center">
          <MetricsTable rows={rows} />
        </div>
      </div>
      <p className="mt-3 text-[10px] text-gray-600">Based on {data.swings.toLocaleString()} tracked swings.</p>
    </ChartShell>
  );
}
