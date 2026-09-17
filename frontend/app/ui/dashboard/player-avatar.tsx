'use client';

import { useState } from 'react';

function initialsFor(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function PlayerAvatar({
  id,
  name,
  size = 32,
}: {
  id: number;
  name: string;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-full bg-gray-700 text-xs font-semibold text-gray-200"
      >
        {initialsFor(name)}
      </div>
    );
  }

  return (
    // MLB's public headshot CDN, keyed by the same MLBAM player_id our data
    // already uses — no backend involvement needed for this.
    <img
      src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_100/v1/people/${id}/headshot/67/current`}
      alt={name}
      width={size}
      height={size}
      onError={() => setImgFailed(true)}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full bg-gray-700 object-cover"
    />
  );
}
