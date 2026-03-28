import React from 'react';

const MS_BASE = { fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" as const };
const MS_FILL = { fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 24" as const };

export function MIcon({
  name,
  className = '',
  filled,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span className={`material-symbols-outlined ${className}`.trim()} style={filled ? MS_FILL : MS_BASE}>
      {name}
    </span>
  );
}
