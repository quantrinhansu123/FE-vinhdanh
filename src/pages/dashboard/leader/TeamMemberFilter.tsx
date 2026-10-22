import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Search, Users } from 'lucide-react';
import './teamMemberFilter.css';

type MemberOption = { id: string; name: string; code: string };

type Props = {
  options: MemberOption[];
  /** null means all members; an empty array explicitly selects nobody. */
  value: string[] | null;
  onChange: (ids: string[] | null) => void;
  disabled?: boolean;
};

function searchKey(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

export function TeamMemberFilter({ options, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selected = new Set(value ?? options.map((option) => option.id));
  const visibleOptions = options.filter((option) => searchKey(`${option.name} ${option.code}`).includes(searchKey(search)));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <div className="team-member-filter" ref={rootRef} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button ref={triggerRef} type="button" className={`team-member-filter-trigger${value !== null ? ' is-filtered' : ''}`} disabled={disabled}
        aria-expanded={open} aria-controls={panelId} aria-label="Lọc nhân viên" onClick={() => { setSearch(''); setOpen(!open); }}>
        <Users size={15} />
        <span>{value === null ? 'Tất cả nhân viên' : `Đã chọn ${value.length} nhân viên`}</span>
        <ChevronDown size={14} />
      </button>
      {open && !disabled ? (
        <div id={panelId} className="team-member-filter-panel" role="group" aria-label="Chọn nhân viên muốn xem">
          <div className="team-member-filter-search"><Search size={15} /><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên hoặc mã nhân viên…" aria-label="Tìm nhân viên" /></div>
          <div className="team-member-filter-actions">
            <button type="button" onClick={() => onChange(null)}>Chọn tất cả</button>
            <button type="button" onClick={() => onChange([])}>Bỏ chọn tất cả</button>
          </div>
          <div className="team-member-filter-options">
            {visibleOptions.map((option) => (
              <label key={option.id} className="team-member-filter-option">
                <input type="checkbox" checked={selected.has(option.id)} onChange={() => toggle(option.id)} />
                <span><strong>{option.name}</strong><small>{option.code || 'Chưa có mã nhân viên'}</small></span>
              </label>
            ))}
            {!visibleOptions.length ? <p className="team-member-filter-empty">Không tìm thấy nhân viên.</p> : null}
          </div>
          <div className="team-member-filter-footer"><span>{value === null ? options.length : value.length} nhân viên đã chọn</span><button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>Xong</button></div>
        </div>
      ) : null}
    </div>
  );
}
