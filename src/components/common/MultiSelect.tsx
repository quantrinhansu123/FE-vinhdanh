/**
 * MultiSelect — Dropdown chọn nhiều giá trị
 * Phong cách: Obsidian / leader-dash (leader-dash-obsidian theme)
 *
 * Props:
 *   options      — danh sách lựa chọn { value, label }
 *   value        — mảng value đã chọn
 *   onChange     — callback khi thay đổi
 *   placeholder  — text hiển thị khi chưa chọn gì
 *   label        — nhãn hiển thị trong chip trigger (tuỳ chọn)
 *   icon         — material-symbols-outlined icon name (tuỳ chọn)
 *   maxDisplay   — số lượng item hiển thị trước khi thu gọn thành "+N"
 *   disabled     — vô hiệu hoá
 *   className    — class bổ sung cho wrapper trigger
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface MultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
  icon?: string;
  maxDisplay?: number;
  disabled?: boolean;
  className?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Tất cả',
  label,
  icon = 'filter_alt',
  maxDisplay = 2,
  disabled = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /* Đóng khi click ngoài */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        !triggerRef.current?.contains(t) &&
        !dropdownRef.current?.contains(t)
      ) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /* Focus ô search khi mở */
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  /* Tính vị trí dropdown */
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const dropdownH = Math.min(320, options.length * 40 + 100);
    const openUp = spaceBelow < dropdownH && rect.top > dropdownH;
    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 240),
      zIndex: 9999,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, [options.length]);

  const handleOpen = () => {
    if (disabled) return;
    calcPosition();
    setOpen((v) => !v);
  };

  const toggle = (val: string) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const selectAll = () => onChange(options.map((o) => o.value));
  const clearAll = () => onChange([]);

  const filtered = search.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          (o.sublabel?.toLowerCase().includes(search.toLowerCase()) ?? false)
      )
    : options;

  /* Hiển thị chip trigger */
  const renderTriggerContent = () => {
    if (value.length === 0) {
      return (
        <span className="text-[var(--ld-on-surface-variant)] leader-dash-label text-sm truncate">
          {placeholder}
        </span>
      );
    }
    const selected = options.filter((o) => value.includes(o.value));
    const shown = selected.slice(0, maxDisplay);
    const extra = selected.length - shown.length;
    return (
      <span className="flex items-center gap-1 flex-wrap">
        {shown.map((o) => (
          <span
            key={o.value}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[color-mix(in_srgb,var(--ld-primary)_15%,transparent)] text-[var(--ld-primary)] border border-[var(--ld-primary)]/20 leading-none"
          >
            {o.label}
          </span>
        ))}
        {extra > 0 && (
          <span className="text-[10px] font-bold text-[var(--ld-primary)]">
            +{extra}
          </span>
        )}
      </span>
    );
  };

  const allSelected = value.length === options.length;

  return (
    <>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className={[
          'ld-glass-chip ld-ghost-border rounded-lg px-4 py-2 flex items-center gap-3 min-w-[min(100%,240px)] text-left transition-all',
          open
            ? 'outline outline-1 outline-[var(--ld-primary)]/40'
            : 'hover:outline hover:outline-1 hover:outline-[var(--ld-primary)]/20',
          disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
          className,
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className="material-symbols-outlined text-[var(--ld-primary)] text-sm shrink-0"
          style={{ fontSize: '18px' }}
        >
          {icon}
        </span>
        <span className="flex-1 min-w-0 overflow-hidden">
          {label && (
            <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--ld-on-surface-variant)] leader-dash-label mb-0.5">
              {label}
            </span>
          )}
          <span className="block leading-tight">{renderTriggerContent()}</span>
        </span>
        {value.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clearAll();
            }}
            className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center bg-[var(--ld-outline-variant)]/30 hover:bg-[var(--ld-error)]/20 text-[var(--ld-on-surface-variant)] hover:text-[var(--ld-error)] transition-colors"
            title="Xoá bộ lọc"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
              close
            </span>
          </button>
        )}
        <span
          className={[
            'material-symbols-outlined text-[var(--ld-on-surface-variant)] shrink-0 transition-transform duration-200',
            open ? 'rotate-180' : '',
          ].join(' ')}
          style={{ fontSize: '16px' }}
        >
          expand_more
        </span>
      </button>

      {/* Dropdown portal */}
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="leader-dash-obsidian"
          >
            <div className="bg-[var(--ld-surface-container-high)] rounded-xl border border-[var(--ld-outline-variant)]/25 shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
              {/* Search */}
              <div className="px-3 pt-3 pb-2 border-b border-[var(--ld-outline-variant)]/10">
                <div className="relative">
                  <span
                    className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ld-on-surface-variant)] pointer-events-none"
                    style={{ fontSize: '14px' }}
                  >
                    search
                  </span>
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm kiếm…"
                    className="w-full bg-[var(--ld-surface-container)] border border-[var(--ld-outline-variant)]/15 rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--ld-on-surface)] placeholder:text-[var(--ld-on-surface-variant)]/50 outline-none focus:border-[var(--ld-primary)]/40 transition-colors leader-dash-label"
                  />
                </div>
              </div>

              {/* Toolbar: Select all / Clear */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ld-outline-variant)]/10">
                <button
                  type="button"
                  onClick={allSelected ? clearAll : selectAll}
                  className="text-[9px] font-bold uppercase tracking-wider text-[var(--ld-primary)] hover:text-[var(--ld-primary-container)] transition-colors leader-dash-label"
                >
                  {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
                <span className="text-[9px] text-[var(--ld-on-surface-variant)] leader-dash-label">
                  {value.length}/{options.length} đã chọn
                </span>
              </div>

              {/* Options list */}
              <div
                className="overflow-y-auto leader-obsidian-scrollbar"
                style={{ maxHeight: '240px' }}
                role="listbox"
                aria-multiselectable="true"
              >
                {filtered.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-[var(--ld-on-surface-variant)] leader-dash-label italic">
                    Không tìm thấy kết quả
                  </div>
                ) : (
                  filtered.map((opt) => {
                    const checked = value.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={checked}
                        onClick={() => toggle(opt.value)}
                        className={[
                          'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors group',
                          checked
                            ? 'bg-[color-mix(in_srgb,var(--ld-primary)_8%,transparent)]'
                            : 'hover:bg-[var(--ld-surface-container)]',
                        ].join(' ')}
                      >
                        {/* Checkbox custom */}
                        <span
                          className={[
                            'shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all',
                            checked
                              ? 'bg-[var(--ld-primary)] border-[var(--ld-primary)]'
                              : 'border-[var(--ld-outline-variant)] group-hover:border-[var(--ld-primary)]/50',
                          ].join(' ')}
                        >
                          {checked && (
                            <span
                              className="material-symbols-outlined text-[var(--ld-on-primary)]"
                              style={{ fontSize: '11px', fontVariationSettings: "'FILL' 1, 'wght' 700" }}
                            >
                              check
                            </span>
                          )}
                        </span>

                        <span className="flex-1 min-w-0">
                          <span
                            className={[
                              'block text-sm truncate leader-dash-label',
                              checked
                                ? 'text-[var(--ld-primary)] font-semibold'
                                : 'text-[var(--ld-on-surface)]',
                            ].join(' ')}
                          >
                            {opt.label}
                          </span>
                          {opt.sublabel && (
                            <span className="block text-[10px] text-[var(--ld-on-surface-variant)] truncate leader-dash-label">
                              {opt.sublabel}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
