'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { chatHistory as initialChatHistory } from '@/app/ui/dashboard/sidebar-mock-data';

export type Chat = {
  id: string;
  title: string;
  time: string;
  active: boolean;
  playerId?: number;
  playerName?: string;
};

export type SelectedPlayer = {
  id: number;
  name: string;
};

type ChatMenuContextType = {
  isChatMenuOpen: boolean;
  openChatMenu: () => void;
  closeChatMenu: () => void;
  chats: Chat[];
  addChat: (title: string) => void;
  selectedPlayer: SelectedPlayer | null;
  startPlayerChat: (player: SelectedPlayer) => void;
};

const ChatMenuContext = createContext<ChatMenuContextType | undefined>(undefined);

export function ChatMenuProvider({ children }: { children: ReactNode }) {
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>(initialChatHistory);
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(null);

  const addChat = (title: string) => {
    const newChat: Chat = { id: Date.now().toString(), title, time: 'Just now', active: true };
    setChats((prev) => [newChat, ...prev.map((chat) => ({ ...chat, active: false }))]);
  };

  const startPlayerChat = (player: SelectedPlayer) => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: `Chat with ${player.name}`,
      time: 'Just now',
      active: true,
      playerId: player.id,
      playerName: player.name,
    };
    setChats((prev) => [newChat, ...prev.map((chat) => ({ ...chat, active: false }))]);
    setSelectedPlayer(player);
    setIsChatMenuOpen(true);
  };

  return (
    <ChatMenuContext.Provider
      value={{
        isChatMenuOpen,
        openChatMenu: () => setIsChatMenuOpen(true),
        closeChatMenu: () => setIsChatMenuOpen(false),
        chats,
        addChat,
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
