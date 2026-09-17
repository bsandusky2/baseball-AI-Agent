'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { chatHistory as initialChatHistory } from '@/app/ui/dashboard/sidebar-mock-data';

export type ChartPoint = { x: number | string; y: number };
export type ChartBar = { label: string; value: number };
export type HeatmapCell = { row: number; col: number; value: number };
export type SprayPoint = { hc_x: number; hc_y: number; label?: string };
export type TrajectoryPitch = {
  pitch_type: string;
  release_pos_x: number;
  release_pos_y: number;
  release_pos_z: number;
  vx0: number;
  vy0: number;
  vz0: number;
  ax: number;
  ay: number;
  az: number;
};

export type StatTile = {
  label: string;
  value: number;
  format?: 'percent' | 'decimal' | 'mph' | 'number' | 'signed';
};

export type ChartPayload =
  | { chart_type: 'line'; title?: string | null; data: { x_label: string; y_label: string; points: ChartPoint[] } }
  | { chart_type: 'bar'; title?: string | null; data: { x_label: string; y_label: string; bars: ChartBar[] } }
  | { chart_type: 'scatter'; title?: string | null; data: { x_label: string; y_label: string; points: ChartPoint[] } }
  | { chart_type: 'heatmap_grid'; title?: string | null; data: { legend_label: string; cells: HeatmapCell[] } }
  | { chart_type: 'spray_chart'; title?: string | null; data: { points: SprayPoint[] } }
  | { chart_type: 'trajectory'; title?: string | null; data: { pitches: TrajectoryPitch[] } }
  | { chart_type: 'stat_row'; title?: string | null; data: { stats: StatTile[] } };

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  chart?: ChartPayload;
  charts?: ChartPayload[];
};

export type PlayerRole = 'batter' | 'pitcher';

export type Chat = {
  id: string;
  title: string;
  time: string;
  active: boolean;
  playerId?: number;
  playerName?: string;
  playerRole?: PlayerRole;
  messages: ChatMessage[];
};

export type SelectedPlayer = {
  id: number;
  name: string;
  role: PlayerRole;
};

type ChatMenuContextType = {
  isChatMenuOpen: boolean;
  openChatMenu: () => void;
  closeChatMenu: () => void;
  chats: Chat[];
  activeChat: Chat | undefined;
  isSending: boolean;
  sendMessage: (text: string) => void;
  setActiveChat: (chatId: string) => void;
  selectedPlayer: SelectedPlayer | null;
  startPlayerChat: (player: SelectedPlayer) => void;
};

const ChatMenuContext = createContext<ChatMenuContextType | undefined>(undefined);

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString() + Math.random().toString(36).slice(2);
}

export function ChatMenuProvider({ children }: { children: ReactNode }) {
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>(initialChatHistory);
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(null);
  const [isSending, setIsSending] = useState(false);

  const activeChat = chats.find((chat) => chat.active);

  const startPlayerChat = (player: SelectedPlayer) => {
    const newChat: Chat = {
      id: newId(),
      title: `Chat with ${player.name}`,
      time: 'Just now',
      active: true,
      playerId: player.id,
      playerName: player.name,
      playerRole: player.role,
      messages: [],
    };
    setChats((prev) => [newChat, ...prev.map((chat) => ({ ...chat, active: false }))]);
    setSelectedPlayer(player);
    setIsChatMenuOpen(true);
  };

  const setActiveChatId = (chatId: string) => {
    const target = chats.find((chat) => chat.id === chatId);
    setChats((prev) => prev.map((chat) => ({ ...chat, active: chat.id === chatId })));
    setSelectedPlayer(
      target?.playerId && target?.playerName
        ? { id: target.playerId, name: target.playerName, role: target.playerRole ?? 'batter' }
        : null,
    );
    setIsChatMenuOpen(true);
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const existing = activeChat;
    const chatId = existing ? existing.id : newId();
    const userMessage: ChatMessage = { id: newId(), role: 'user', text: trimmed };

    if (existing) {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId ? { ...chat, messages: [...chat.messages, userMessage] } : chat,
        ),
      );
    } else {
      const newChat: Chat = {
        id: chatId,
        title: trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed,
        time: 'Just now',
        active: true,
        messages: [userMessage],
      };
      setChats((prev) => [newChat, ...prev.map((chat) => ({ ...chat, active: false }))]);
    }

    // The chat's own player context (if any) isn't otherwise visible to the
    // agent — without this, "his"/"he" in a follow-up has no referent.
    const messageForAgent = existing?.playerName
      ? `Regarding ${existing.playerName} (player_id ${existing.playerId}): ${trimmed}`
      : trimmed;

    setIsSending(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message: messageForAgent }),
      });
      const data = await res.json();
      const assistantMessage: ChatMessage = {
        id: newId(),
        role: 'assistant',
        text: data.answer ?? 'No answer returned.',
        chart: data.chart,
        charts: data.charts,
      };
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId ? { ...chat, messages: [...chat.messages, assistantMessage] } : chat,
        ),
      );
    } catch (err) {
      console.error('Failed to send message', err);
      const errorMessage: ChatMessage = {
        id: newId(),
        role: 'assistant',
        text: 'Something went wrong reaching the agent — please try again.',
      };
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId ? { ...chat, messages: [...chat.messages, errorMessage] } : chat,
        ),
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ChatMenuContext.Provider
      value={{
        isChatMenuOpen,
        openChatMenu: () => {
          setChats((prev) => prev.map((chat) => ({ ...chat, active: false })));
          setSelectedPlayer(null);
          setIsChatMenuOpen(true);
        },
        closeChatMenu: () => setIsChatMenuOpen(false),
        chats,
        activeChat,
        isSending,
        sendMessage,
        setActiveChat: setActiveChatId,
        selectedPlayer,
        startPlayerChat,
      }}
    >
      {children}
    </ChatMenuContext.Provider>
  );
}

export function useChatMenu() {
  const context = useContext(ChatMenuContext);
  if (!context) {
    throw new Error('useChatMenu must be used within a ChatMenuProvider');
  }
  return context;
}
