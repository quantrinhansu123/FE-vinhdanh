import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TableHTMLAttributes } from 'react';
import '../../styles/stitchSystem.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet'; size?: 'default' | 'small' };
export function StitchButton({ variant = 'primary', size = 'default', className = '', ...props }: ButtonProps) {
  return <button className={`stitch-button stitch-button--${variant} stitch-button--${size} ${className}`} {...props} />;
}

export function StitchInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`stitch-field ${className}`} {...props} />;
}

export function StitchSelect({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`stitch-field stitch-select ${className}`} {...props} />;
}

type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: 'success' | 'warning' | 'danger' | 'neutral' };
export function StitchBadge({ tone = 'neutral', className = '', ...props }: BadgeProps) {
  return <span className={`stitch-badge stitch-badge--${tone} ${className}`} {...props} />;
}

export function StitchCard({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`stitch-card ${className}`} {...props} />;
}

export function StitchTable({ className = '', ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={`stitch-table ${className}`} {...props} />;
}

type StateProps = HTMLAttributes<HTMLDivElement> & { tone?: 'loading' | 'empty' | 'warning' | 'error' };
export function StitchState({ tone = 'empty', className = '', ...props }: StateProps) {
  return <div className={`stitch-state stitch-state--${tone} ${className}`} {...props} />;
}

export function StitchDataView({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`stitch-data-page ${className}`} {...props} />;
}

export const STITCH_PORTAL_CLASS = 'stitch-system stitch-legacy-modal';

type ModalFrameProps = { labelledBy: string; onClose: () => void; children: ReactNode };
export function StitchModalFrame({ labelledBy, onClose, children }: ModalFrameProps) {
  return (
    <div className="stitch-system stitch-modal-root">
      <div className="stitch-modal-backdrop" aria-hidden onMouseDown={onClose} />
      <div className="pointer-events-none relative z-[1] flex w-full items-center justify-center">
        <div className="stitch-modal-panel pointer-events-auto" role="dialog" aria-modal="true" aria-labelledby={labelledBy} onMouseDown={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </div>
  );
}
