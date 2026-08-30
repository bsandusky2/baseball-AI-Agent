'use client';

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useChatMenu } from '@/app/ui/dashboard/chat-menu-context';

export default function ChatMenuBanner() {
  const { isChatMenuOpen, closeChatMenu, addChat } = useChatMenu();
  const [value, setValue] = useState('');

  if (!isChatMenuOpen) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    addChat(trimmed);
    setValue('');
  };

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-blue-900">New Chat</p>
          <p className="text-sm text-blue-700">
            Ask a question about any player, matchup, or stat.
          </p>
        </div>
        <button
          onClick={closeChatMenu}
          aria-label="Close new chat"
          className="text-blue-400 hover:text-blue-600"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask about a player, matchup, or stat..."
          autoFocus
          className="mt-3 w-full rounded-lg border border-blue-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </form>
    </div>
  );
}
