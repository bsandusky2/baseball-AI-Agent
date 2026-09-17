'use client';

import { useEffect, useState } from 'react';
import { PlayerRole } from '@/app/ui/dashboard/chat-menu-context';

type Tone = 'poor' | 'below_avg' | 'above_avg' | 'good' | 'neutral';

type Stat = {
  value: number | null;
  qualifier?: string | null;
  tone?: Tone | null;
};

type PlayerKPIResponse = {
  player_id: number;
  pitches_analyzed?: Stat;
  xwoba?: Stat;
  whiff_rate?: Stat;
  chase_rate?: Stat;
  avg_exit_velocity?: Stat;
  barrel_rate?: Stat;
  run_value?: Stat;
};

const TONE_COLOR: Record<Tone, string> = {
  poor: 'text-red-400',
  below_avg: 'text-blue-400',
  above_avg: 'text-emerald-400',
  good: 'text-emerald-400',
  neutral: 'text-gray-500',
};

function formatCount(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : value.toLocaleString();
}

function formatDecimal(value: number | null | undefined, digits = 3) {
  return value === null || value === undefined ? '—' : value.toFixed(digits);
}

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : `${(value * 100).toFixed(1)}%`;
}

function formatMph(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : value.toFixed(1);
}

function formatSigned(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

type TileConfig = {
  key: keyof Omit<PlayerKPIResponse, 'player_id'>;
  label: string;
  pitcherLabel?: string;
  format: (value: number | null | undefined) => string;
  unit?: string;
};

const TILES: TileConfig[] = [
  { key: 'pitches_analyzed', label: 'Pitches Analyzed', pitcherLabel: 'Pitches Thrown', format: formatCount },
  { key: 'xwoba', label: 'xwOBA', pitcherLabel: 'xwOBA Allowed', format: (v) => formatDecimal(v, 3) },
  { key: 'whiff_rate', label: 'Whiff Rate', pitcherLabel: 'Whiff Rate Induced', format: formatPercent },
  { key: 'chase_rate', label: 'Chase Rate', pitcherLabel: 'Chase Rate Induced', format: formatPercent },
  {
    key: 'avg_exit_velocity',
    label: 'Avg Exit Velo',
    pitcherLabel: 'Avg Exit Velo Allowed',
    format: formatMph,
    unit: 'mph',
  },
  { key: 'barrel_rate', label: 'Barrel Rate', pitcherLabel: 'Barrel Rate Allowed', format: formatPercent },
  { key: 'run_value', label: 'Run Value', format: (v) => formatSigned(v, 2) },
];

export default function PlayerKpiTiles({
  playerId,
  role = 'batter',
}: {
  playerId: number;
  role?: PlayerRole;
}) {
  const [data, setData] = useState<PlayerKPIResponse | null>(null);

  useEffect(() => {
    setData(null);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/kpi/${playerId}?role=${role}`)
      .then((res) => res.json())
      .then(setData)
      .catch((err) => console.error('Failed to load player KPIs', err));
  }, [playerId, role]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {TILES.map((tile) => {
        const stat = data?.[tile.key];
        return (
          <div key={tile.key} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {role === 'pitcher' && tile.pitcherLabel ? tile.pitcherLabel : tile.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {tile.format(stat?.value)}
              {tile.unit && stat?.value != null && (
                <span className="ml-1 text-sm font-normal text-gray-500">{tile.unit}</span>
              )}
            </p>
            {stat?.qualifier && (
              <p className={`mt-1 text-xs font-medium ${TONE_COLOR[stat.tone ?? 'neutral']}`}>
                {stat.qualifier}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
