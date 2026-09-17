'use client';

import HeatmapGridDisplay from './heatmap-grid-display';
import type { ChartPayload } from '@/app/ui/dashboard/chat-menu-context';

const WIDTH = 400;
const HEIGHT = 220;
const PAD_LEFT = 40;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 28;
const ACCENT = '#e34948'; // dataviz skill categorical slot 8 (red)

function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / (magnitude / 2)) * (magnitude / 2);
}

// Zooms the axis to the data's actual range (+10% padding) instead of
// always anchoring at 0 — a line/scatter chart is about showing the shape
// of variation, and a wide value like 88-91 mph loses all visible detail
// on a 0-95 scale. (Bar charts are the opposite case: their length IS the
// magnitude encoding, so those stay zero-anchored — see BarChart below.)
function niceAxisRange(dataMin: number, dataMax: number): [number, number] {
  if (dataMin === dataMax) {
    const pad = Math.abs(dataMin) * 0.1 || 1;
    return [dataMin - pad, dataMax + pad];
  }
  const range = dataMax - dataMin;
  const padding = range * 0.1;
  const paddedMin = dataMin - padding;
  const paddedMax = dataMax + padding;

  const magnitude = 10 ** Math.floor(Math.log10(range));
  const step = magnitude / 2;

  return [Math.floor(paddedMin / step) * step, Math.ceil(paddedMax / step) * step];
}

function ChartFrame({ title, children }: { title?: string | null; children: React.ReactNode }) {
  return (
    <div className="mt-2 rounded-lg border border-gray-700 bg-gray-950 p-3">
      {title && <p className="mb-2 text-xs font-semibold text-gray-200">{title}</p>}
      {children}
    </div>
  );
}

function LineChart({ payload }: { payload: Extract<ChartPayload, { chart_type: 'line' }> }) {
  const { x_label, y_label } = payload.data;
  if (payload.data.points.length === 0) return <p className="text-xs text-gray-500">No data.</p>;

  // The agent's SQL doesn't always ORDER BY the x-axis — sort defensively
  // rather than plot a zigzag. Numeric or ISO-date-formatted x values sort
  // correctly this way; other strings fall back to alphabetical, which is
  // at least deterministic even when it's not otherwise meaningful.
  const points = [...payload.data.points].sort((a, b) => {
    if (typeof a.x === 'number' && typeof b.x === 'number') return a.x - b.x;
    return String(a.x).localeCompare(String(b.x));
  });

  const [minY, maxY] = niceAxisRange(Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y)));
  const x = (i: number) =>
    PAD_LEFT + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (WIDTH - PAD_LEFT - PAD_RIGHT));
  const y = (v: number) =>
    HEIGHT - PAD_BOTTOM - ((v - minY) / (maxY - minY || 1)) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.y)}`).join(' ');
  const yTicks = [minY, (minY + maxY) / 2, maxY];
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <ChartFrame title={payload.title}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y(t)} y2={y(t)} stroke="#2c2c2a" strokeWidth={1} />
            <text x={PAD_LEFT - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="#898781">
              {Math.round(t * 100) / 100}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.y)} r={3} fill={ACCENT} stroke="#0d0d0d" strokeWidth={1} />
        ))}
        {points.map(
          (p, i) =>
            i % labelEvery === 0 && (
              <text key={`x-${i}`} x={x(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={8} fill="#898781">
                {String(p.x)}
              </text>
            ),
        )}
      </svg>
      <p className="mt-1 text-center text-[10px] uppercase tracking-wide text-gray-500">
        {x_label} · {y_label}
      </p>
    </ChartFrame>
  );
}

function BarChart({ payload }: { payload: Extract<ChartPayload, { chart_type: 'bar' }> }) {
  const { bars, x_label, y_label } = payload.data;
  if (bars.length === 0) return <p className="text-xs text-gray-500">No data.</p>;

  const maxY = niceMax(Math.max(...bars.map((b) => b.value)));
  const barWidth = (WIDTH - PAD_LEFT - PAD_RIGHT) / bars.length;
  const y = (v: number) => HEIGHT - PAD_BOTTOM - (v / maxY) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

  return (
    <ChartFrame title={payload.title}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
        <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y(0)} y2={y(0)} stroke="#383835" strokeWidth={1} />
        {bars.map((b, i) => {
          const bx = PAD_LEFT + i * barWidth;
          const barH = HEIGHT - PAD_BOTTOM - y(b.value);
          return (
            <g key={b.label}>
              <rect
                x={bx + barWidth * 0.15}
                y={y(b.value)}
                width={barWidth * 0.7}
                height={Math.max(0, barH)}
                fill={ACCENT}
                rx={2}
              />
              <text x={bx + barWidth / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={8} fill="#898781">
                {b.label.length > 8 ? `${b.label.slice(0, 8)}…` : b.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-[10px] uppercase tracking-wide text-gray-500">
        {x_label} · {y_label}
      </p>
    </ChartFrame>
  );
}

function ScatterChart({ payload }: { payload: Extract<ChartPayload, { chart_type: 'scatter' }> }) {
  const { points, x_label, y_label } = payload.data;
  if (points.length === 0) return <p className="text-xs text-gray-500">No data.</p>;

  const xs = points.map((p) => Number(p.x));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const [minY, maxY] = niceAxisRange(Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y)));
  const x = (v: number) => PAD_LEFT + ((v - minX) / (maxX - minX || 1)) * (WIDTH - PAD_LEFT - PAD_RIGHT);
  const y = (v: number) =>
    HEIGHT - PAD_BOTTOM - ((v - minY) / (maxY - minY || 1)) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
  const yTicks = [minY, (minY + maxY) / 2, maxY];

  return (
    <ChartFrame title={payload.title}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y(t)} y2={y(t)} stroke="#2c2c2a" strokeWidth={1} />
            <text x={PAD_LEFT - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="#898781">
              {Math.round(t * 100) / 100}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <circle key={i} cx={x(Number(p.x))} cy={y(p.y)} r={4} fill="rgba(227, 73, 72, 0.65)" />
        ))}
      </svg>
      <p className="mt-1 text-center text-[10px] uppercase tracking-wide text-gray-500">
        {x_label} · {y_label}
      </p>
    </ChartFrame>
  );
}

function HeatmapGrid({ payload }: { payload: Extract<ChartPayload, { chart_type: 'heatmap_grid' }> }) {
  const { cells, legend_label } = payload.data;
  const values = cells.map((c) => c.value);
  const scaleMin = values.length ? Math.min(...values) : 0;
  const scaleMax = values.length ? Math.max(...values) : 1;
  // render_chart's heatmap_grid data doesn't carry an explicit format hint,
  // so infer it from the label the same way the two known cases read: a
  // "%" in the label means a rate, otherwise it's a decimal stat like
  // xwOBA/batting average (no leading zero, matching Statcast convention).
  const isPercent = legend_label.includes('%');
  const formatValue = (v: number) => (isPercent ? `${Math.round(v * 100)}%` : v.toFixed(3).replace(/^0/, ''));

  return (
    <ChartFrame title={payload.title}>
      <HeatmapGridDisplay
        cells={cells}
        scaleMin={scaleMin}
        scaleMax={scaleMax}
        legendLabel={legend_label}
        formatValue={formatValue}
      />
    </ChartFrame>
  );
}

function SprayChart({ payload }: { payload: Extract<ChartPayload, { chart_type: 'spray_chart' }> }) {
  const { points } = payload.data;
  if (points.length === 0) return <p className="text-xs text-gray-500">No data.</p>;

  // Statcast hc_x/hc_y are diagram pixel coordinates (not feet), roughly
  // 0-250 with home plate near (125, 205). Good enough for a relative
  // spray shape without needing the exact foot-conversion formula.
  const xs = points.map((p) => p.hc_x);
  const ys = points.map((p) => p.hc_y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 250);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 250);
  const x = (v: number) => PAD_LEFT + ((v - minX) / (maxX - minX || 1)) * (WIDTH - PAD_LEFT - PAD_RIGHT);
  const y = (v: number) => PAD_TOP + ((v - minY) / (maxY - minY || 1)) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

  return (
    <ChartFrame title={payload.title}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
        <path
          d={`M ${x(minX)} ${y(minY)} A ${WIDTH / 2} ${HEIGHT / 2} 0 0 1 ${x(maxX)} ${y(minY)} L ${x((minX + maxX) / 2)} ${y(maxY)} Z`}
          fill="#1a1a19"
          stroke="#383835"
          strokeWidth={1}
        />
        {points.map((p, i) => (
          <circle key={i} cx={x(p.hc_x)} cy={y(p.hc_y)} r={4} fill="rgba(227, 73, 72, 0.7)" />
        ))}
      </svg>
      <p className="mt-1 text-center text-[10px] uppercase tracking-wide text-gray-500">Batted-ball locations</p>
    </ChartFrame>
  );
}

function formatStatValue(value: number, format?: string) {
  switch (format) {
    case 'percent':
      return `${(value * 100).toFixed(1)}%`;
    case 'decimal':
      return value.toFixed(3).replace(/^0/, '');
    case 'mph':
      return `${value.toFixed(1)} mph`;
    case 'signed':
      return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
    default:
      return value.toLocaleString();
  }
}

function StatRow({ payload }: { payload: Extract<ChartPayload, { chart_type: 'stat_row' }> }) {
  const { stats } = payload.data;
  if (stats.length === 0) return <p className="text-xs text-gray-500">No data.</p>;

  return (
    <ChartFrame title={payload.title}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md border border-gray-800 bg-gray-900 p-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{stat.label}</p>
            <p className="mt-0.5 text-base font-semibold text-white">
              {formatStatValue(stat.value, stat.format)}
            </p>
          </div>
        ))}
      </div>
    </ChartFrame>
  );
}

export default function ChatChartRenderer({ payload }: { payload: ChartPayload }) {
  switch (payload.chart_type) {
    case 'line':
      return <LineChart payload={payload} />;
    case 'bar':
      return <BarChart payload={payload} />;
    case 'scatter':
      return <ScatterChart payload={payload} />;
    case 'stat_row':
      return <StatRow payload={payload} />;
    case 'heatmap_grid':
      return <HeatmapGrid payload={payload} />;
    case 'spray_chart':
      return <SprayChart payload={payload} />;
    case 'trajectory':
      return (
        <ChartFrame title={payload.title}>
          <p className="text-xs text-gray-500">
            Trajectory view isn&apos;t built yet — {payload.data.pitches.length} pitch(es) of data received.
          </p>
        </ChartFrame>
      );
    default:
      return null;
  }
}
