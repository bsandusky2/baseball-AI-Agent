'use client';

import { divergingColor, textColorForValue } from './color-scale';

type Cell = { row: number; col: number; value: number };

// Shared presentational core for every 3x3 strike-zone heatmap in the app —
// the player dashboard's HeatmapCard (fetches its own data) and the chat's
// ChatChartRenderer (receives data already embedded in a message) both
// render through this, so they can never visually drift from each other
// again. Legend min/max labels are derived from formatValue(scaleMin/Max)
// rather than passed in separately, so they always match the real data
// range instead of a stale hardcoded guess.
export default function HeatmapGridDisplay({
  cells,
  scaleMin,
  scaleMax,
  legendLabel,
  formatValue,
}: {
  cells: Cell[];
  scaleMin: number;
  scaleMax: number;
  legendLabel: string;
  formatValue: (value: number) => string;
}) {
  const cellAt = (row: number, col: number) => cells.find((c) => c.row === row && c.col === col);

  return (
    <>
      <div className="flex gap-3">
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
                  const bg = cell ? divergingColor(cell.value, scaleMin, scaleMax) : '#26262a';
                  const fg = cell ? textColorForValue(cell.value, scaleMin, scaleMax) : '#6b6b70';
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
            style={{ background: 'linear-gradient(to top, #2a78d6, #f0efec, #e34948)' }}
          />
          <div className="flex h-24 flex-col justify-between text-[10px] text-gray-500">
            <span>{formatValue(scaleMax)}</span>
            <span>{formatValue(scaleMin)}</span>
          </div>
        </div>
      </div>

      <div className="mt-2 flex justify-between text-[10px] font-medium uppercase text-gray-500">
        <span>Away</span>
        <span>In</span>
      </div>
    </>
  );
}
