import HeatmapCard from './heatmap-card';
import VelocityLineChart from './velocity-line-chart';
import SpinScatterChart from './spin-scatter-chart';

export default function PlayerChartGrid({ playerId }: { playerId: number }) {
  const base = `${process.env.NEXT_PUBLIC_API_URL}/kpi/${playerId}`;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <HeatmapCard
        title="Whiff Rate by Location"
        fetchUrl={`${base}/heatmap?metric=whiff_rate`}
        legendLabel="Whiff %"
        legendMax="60%"
        legendMin="0%"
        formatValue={(v) => `${Math.round(v * 100)}%`}
      />
      <HeatmapCard
        title="xwOBA by Location"
        fetchUrl={`${base}/heatmap?metric=xwoba`}
        legendLabel="xwOBA"
        legendMax=".500"
        legendMin=".000"
        formatValue={(v) => v.toFixed(3).replace(/^0/, '')}
      />
      <VelocityLineChart fetchUrl={`${base}/velocity`} />
      <SpinScatterChart fetchUrl={`${base}/spin-rate`} />
    </div>
  );
}
