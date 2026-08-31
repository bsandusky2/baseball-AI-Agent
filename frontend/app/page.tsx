'use client';

import ChatMenuBanner from '@/app/ui/dashboard/chat-menu-banner';
import PlayerKpiTiles from '@/app/ui/dashboard/player-kpi-tiles';
import PlayerChartGrid from '@/app/ui/dashboard/charts/player-chart-grid';
import { useChatMenu } from '@/app/ui/dashboard/chat-menu-context';

export default function Page() {
  const { selectedPlayer } = useChatMenu();

  return (
    <div className="flex flex-col gap-6">
      {selectedPlayer && <PlayerKpiTiles playerId={selectedPlayer.id} />}
      {selectedPlayer && <PlayerChartGrid playerId={selectedPlayer.id} />}
      <ChatMenuBanner />
      {!selectedPlayer && <p>Dashboard Page</p>}
    </div>
  );
}
