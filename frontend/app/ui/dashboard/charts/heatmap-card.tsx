'use client';

import { useEffect, useState } from 'react';
import { divergingColor, textColorForValue } from './color-scale';

type Cell = { row: number; col: number; value: number };
type HeatmapData = { scale_min: number; scale_max: number; cells: Cell[] };

type Props = {
  title: string;
  fetchUrl: string;
  legendLabel: string;
  legendMax: string;
  legendMin: string;
  formatValue: (value: number) => string;
};

export default function HeatmapCard({
  title,
  fetchUrl,
  legendLabel,
  legendMax,
  legendMin,
  formatValue,
}: Props) {
  const [data, setData] = useState<HeatmapData | null>(null);

  useEffect(() => {
    setData(null);
    fetch(fetchUrl)
      .then((res) => res.json())
      .then(setData)
      .catch((err) => console.error(`Failed to load ${title}`, err));
  }, [fetchUrl, title]);

  const cellAt = (row: number, col: number) =>
    data?.cells.find((c) => c.row === row && c.col === col);

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-white">{title}</h3>

      <div className="mt-4 flex gap-3">
        <div className="flex flex-col justify-between py-1 text-[10px] font-medium uppercase text-gray-500">
          <span>High</span>
          <span>Low</span>
        </div>

        <table
          className="flex-1 overflow-hidden rounded-md"
          style={{ borderCollapse: 'collapse', borderSpacing: 0, tableLayout: 'fixed', width: '100%' }}
        >
          <tbody>
            {[0, 1, 2].map((row) => (
              <tr key={row}>
                {[0, 1, 2].map((col) => {
                  const cell = cellAt(row, col);
                  const bg =
                    data && cell
                      ? divergingColor(cell.value, data.scale_min, data.scale_max)
                      : '#26262a';
                  const fg =
                    data && cell
                      ? textColorForValue(cell.value, data.scale_min, data.scale_max)
                      : '#6b6b70';
                  return (
                    <td
                      key={`${row}-${col}`}
                      style={{ backgroundColor: bg, color: fg, padding: 0, height: '56px' }}
                      className="text-center text-[11px] font-semibold tabular-nums"
                    >
                      {cell ? formatValue(cell.value) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex w-12 shrink-0 flex-col items-start gap-1">
          <span className="text-[10px] font-medium text-gray-500">{legendLabel}</span>
          <div
            className="h-24 w-2.5 rounded-full"
            style={{
              background: 'linear-gradient(to top, #2a78d6, #f0efec, #e34948)',
            }}
          />
          <div className="flex h-24 flex-col justify-between text-[10px] text-gray-500">
            <span>{legendMax}</span>
            <span>{legendMin}</span>
          </div>
        </div>
      </div>

      <div className="mt-2 flex justify-between text-[10px] font-medium uppercase text-gray-500">
        <span>Away</span>
        <span>In</span>
      </div>
    </div>
  );
}
