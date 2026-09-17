'use client';

import { useEffect, useState } from 'react';
import HeatmapGridDisplay from './heatmap-grid-display';

type Cell = { row: number; col: number; value: number };
type HeatmapData = { scale_min: number; scale_max: number; cells: Cell[] };

type Props = {
  title: string;
  fetchUrl: string;
  legendLabel: string;
  formatValue: (value: number) => string;
};

export default function HeatmapCard({ title, fetchUrl, legendLabel, formatValue }: Props) {
  const [data, setData] = useState<HeatmapData | null>(null);

  useEffect(() => {
    setData(null);
    fetch(fetchUrl)
      .then((res) => res.json())
      .then(setData)
      .catch((err) => console.error(`Failed to load ${title}`, err));
  }, [fetchUrl, title]);

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-4">
        <HeatmapGridDisplay
          cells={data?.cells ?? []}
          scaleMin={data?.scale_min ?? 0}
          scaleMax={data?.scale_max ?? 1}
          legendLabel={legendLabel}
          formatValue={formatValue}
        />
      </div>
    </div>
  );
}
