'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useChatMenu } from '@/app/ui/dashboard/chat-menu-context';
import ChatChartRenderer from '@/app/ui/dashboard/charts/chat-chart-renderer';

export default function ChatMenuBanner() {
  const { isChatMenuOpen, closeChatMenu, activeChat, isSending, sendMessage } = useChatMenu();
  const [value, setValue] = useState('');

  if (!isChatMenuOpen) {
    return null;
  }

  const messages = activeChat?.messages ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isSending) return;
    setValue('');
    sendMessage(trimmed);
  };

  return (
    <div className="mb-6 flex max-h-[32rem] flex-col rounded-lg border border-gray-800 bg-gray-900">
      <div className="flex items-start justify-between gap-4 border-b border-gray-800 p-4">
        <div>
          <p className="font-medium text-white">{activeChat?.title ?? 'New Chat'}</p>
          {messages.length === 0 && (
            <p className="text-sm text-gray-500">Ask a question about any player, matchup, or stat.</p>
          )}
        </div>
        <button
          onClick={closeChatMenu}
          aria-label="Close chat"
          className="text-gray-500 hover:text-gray-300"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {messages.length > 0 && (
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((message) =>
            message.charts && message.charts.length > 0 ? (
              <div key={message.id} className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-100">
                {message.text}
                <div className="mt-1 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {message.charts.map((chart, i) => (
                    <ChatChartRenderer key={i} payload={chart} />
                  ))}
                </div>
              </div>
            ) : (
              <div
                key={message.id}
                className={clsx('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={clsx(
                    'rounded-lg px-3 py-2 text-sm',
                    message.chart ? 'w-full max-w-[26rem]' : 'max-w-[80%]',
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-100',
                  )}
                >
                  {message.text}
                  {message.chart && <ChatChartRenderer payload={message.chart} />}
                </div>
              </div>
            ),
          )}
          {isSending && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-400">
                Thinking…
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 pt-3">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask about a player, matchup, or stat..."
          autoFocus
          disabled={isSending}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
      </form>
    </div>
  );
}
