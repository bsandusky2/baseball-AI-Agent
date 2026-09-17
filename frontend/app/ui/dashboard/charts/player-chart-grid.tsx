import HeatmapCard from './heatmap-card';
import VelocityLineChart from './velocity-line-chart';
import SpinScatterChart from './spin-scatter-chart';
import { PlayerRole } from '@/app/ui/dashboard/chat-menu-context';

export default function PlayerChartGrid({
  playerId,
  role = 'batter',
}: {
  playerId: number;
  role?: PlayerRole;
}) {
  const base = `${process.env.NEXT_PUBLIC_API_URL}/kpi/${playerId}`;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <HeatmapCard
        title="Whiff Rate by Location"
        fetchUrl={`${base}/heatmap?metric=whiff_rate&role=${role}`}
        legendLabel="Whiff %"
        formatValue={(v) => `${Math.round(v * 100)}%`}
      />
      <HeatmapCard
        title="xwOBA by Location"
        fetchUrl={`${base}/heatmap?metric=xwoba&role=${role}`}
        legendLabel="xwOBA"
        formatValue={(v) => v.toFixed(3).replace(/^0/, '')}
      />
      <VelocityLineChart fetchUrl={`${base}/velocity?role=${role}`} />
      <SpinScatterChart fetchUrl={`${base}/spin-rate?role=${role}`} />
    </div>
  );
}
