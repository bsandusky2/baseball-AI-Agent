import HeatmapCard from './heatmap-card';
import VelocityLineChart from './velocity-line-chart';
import SpinScatterChart from './spin-scatter-chart';
import PitchArsenalChart from './pitch-arsenal-chart';
import SwingProfileChart from './swing-profile-chart';
import HomeRunChart from './home-run-chart';
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
      {role === 'pitcher' && (
        <div className="md:col-span-2 xl:col-span-4">
          <PitchArsenalChart fetchUrl={`${base}/pitch-arsenal?role=${role}`} />
        </div>
      )}
      {role === 'batter' && (
        <div className="md:col-span-2 xl:col-span-4">
          <SwingProfileChart fetchUrl={`${base}/bat-tracking?role=${role}`} />
        </div>
      )}
      {role === 'batter' && (
        <div className="md:col-span-2 xl:col-span-4">
          <HomeRunChart fetchUrl={`${base}/home-runs?role=${role}`} />
        </div>
      )}
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
