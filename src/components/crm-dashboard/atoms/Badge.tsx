import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  type?: 'G' | 'R' | 'Y' | 'B' | 'P' | 'default';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, type = 'default', className = '' }) => {
  const typeClasses = {
    G: 'bg-[var(--Gd)] text-[var(--G)]',
    R: 'bg-[var(--Rd)] text-[var(--R)]',
    Y: 'bg-[var(--Yd)] text-[var(--Y)]',
    B: 'bg-[var(--accent-d)] text-[var(--accent)]',
    P: 'bg-[var(--Pd)] text-[var(--P)]',
    default: 'bg-[var(--bg3)] text-[var(--text2)]',
  };

  return (
    <span className={`inline-flex items-center gap-[3px] p-[2px_7px] rounded-[4px] text-[9.5px] font-bold tracking-[0.2px] ${typeClasses[type]} ${className}`}>
      {children}
    </span>
  );
};
