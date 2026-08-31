'use client';

import Link from 'next/link';
import clsx from 'clsx';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  BuildingLibraryIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  StarIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import { useChatMenu } from '@/app/ui/dashboard/chat-menu-context';
import { useEffect, useState } from 'react';

type Player = {
  id: number;
  name: string;
};

const DEFAULT_PLAYERS: Player[] = [
  { id: 660271, name: 'Shohei Ohtani' },
  { id: 670541, name: 'Yordan Álvarez' },
  { id: 694973, name: 'Paul Skenes' },
  { id: 547180, name: 'Bryce Harper' },
  { id: 608070, name: 'José Ramírez' },
];

const bottomLinks = [
  { name: 'Dashboard', href: '/', icon: BuildingLibraryIcon },
  { name: 'Explore', href: '/', icon: ChatBubbleLeftRightIcon },
  { name: 'Reports', href: '/', icon: DocumentTextIcon },
  { name: 'Saved', href: '/', icon: StarIcon },
  { name: 'Settings', href: '/', icon: Cog6ToothIcon },
  { name: 'Help & Docs', href: '/', icon: QuestionMarkCircleIcon },
];

export default function SideNav() {
  const { openChatMenu, chats, startPlayerChat } = useChatMenu();
  const [playerSearch, setPlayerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const players = playerSearch.trim() ? searchResults : DEFAULT_PLAYERS;

  useEffect(() => {
    const query = playerSearch.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/players?search=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then(setSearchResults)
        .catch((err) => console.error('Failed to search players', err));
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [playerSearch]);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gray-950 text-gray-100">
      <div className="flex items-center gap-3 border-b border-gray-800 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500 text-lg">
          ⚾
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">Baseball Agent</span>
            <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] font-semibold text-gray-200">
              BETA
            </span>
          </div>
          <p className="text-xs text-gray-400">Powered by Statcast</p>
        </div>
      </div>

      <div className="p-4">
        <button
          onClick={openChatMenu}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          <PlusIcon className="h-4 w-4" />
          New Chat
        </button>
      </div>

      <div className="px-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Chat History
        </p>
        <div className="space-y-1">
          {chats.slice(0, 5).map((chat) => (
            <button
              key={chat.id}
              className={clsx(
                'w-full rounded-lg px-3 py-2 text-left transition-colors',
                chat.active ? 'bg-blue-600' : 'hover:bg-gray-800',
              )}
            >
              <p
                className={clsx(
                  'text-sm font-medium',
                  chat.active ? 'text-white' : 'text-gray-200',
                )}
              >
                {chat.title}
              </p>
              <p className={clsx('text-xs', chat.active ? 'text-blue-100' : 'text-gray-500')}>
                {chat.time}
              </p>
            </button>
          ))}
        </div>
        <button className="mt-2 text-xs font-medium text-blue-400 hover:text-blue-300">
          View all
        </button>
      </div>

      <div className="mt-6 px-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Players
        </p>
        <div className="relative mb-2">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={playerSearch}
            onChange={(e) => setPlayerSearch(e.target.value)}
            placeholder="Search players..."
            className="w-full rounded-lg bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1">
          {players.map((player) => (
            <button
              key={player.id}
              onClick={() => startPlayerChat(player)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-800"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-700 text-xs font-semibold text-gray-200">
                {player.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <p className="text-sm text-gray-100">{player.name}</p>
            </button>
          ))}
        </div>
        <button className="mt-2 text-xs font-medium text-blue-400 hover:text-blue-300">
          View all players
        </button>
      </div>

      <div className="mt-6 space-y-0.5 border-t border-gray-800 px-2 py-3">
        {bottomLinks.map((link) => {
          const LinkIcon = link.icon;
          return (
            <Link
              key={link.name}
              href={link.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              <LinkIcon className="h-5 w-5" />
              {link.name}
            </Link>
          );
        })}
      </div>

      <div className="border-t border-gray-800 px-4 py-3 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Data as of May 24, 2024
        </div>
        <p className="mt-0.5">v0.9.4</p>
      </div>
    </div>
  );
}
