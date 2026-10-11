import React, { useEffect, useRef, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import { getMetaQcAccounts, fetchMetaQc, loginMetaQc, MetaQcError, type MetaQcResult } from '../../../api/metaQc';

type Props = { since: string; until: string; onClose: () => void; onLoaded: (result: MetaQcResult) => void };

export function MetaQcImportModal({ since, until, onClose, onLoaded }: Props) {
  const [accounts, setAccounts] = useState<string[]>([]);
  const [selected, setSelected] = useState('all');
  const [email, setEmail] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fe_vinhdanh_auth_user') || '{}').email || ''; } catch { return ''; }
  });
  const [password, setPassword] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
    let active = true;
    getMetaQcAccounts().then(data => { if (active) setAccounts(data.accounts); }).catch(error => {
      if (!active) return;
      if (error instanceof MetaQcError && error.status === 401) setNeedsLogin(true);
      else setError(error instanceof Error ? error.message : 'Không tải được danh sách tài khoản Meta.');
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await loginMetaQc(email, password);
      setAccounts(result.accounts); setNeedsLogin(false); setPassword('');
    } catch (error) { setError(error instanceof Error ? error.message : 'Không xác thực được tài khoản.'); }
    finally { setBusy(false); }
  };

  const runImport = async () => {
    if (busy || !accounts.length || since > until || !since || !until) return;
    setBusy(true); setError(''); setProgress('');
    const ids = selected === 'all' ? accounts : [selected];
    let loaded = 0; let successful = 0; let missing = 0;
    const failures: string[] = [];
    try {
      for (const [index, id] of ids.entries()) {
        setProgress(`Đang lấy tài khoản ${id} (${index + 1}/${ids.length})…`);
        try {
          const result = await fetchMetaQc(id, since, until);
          onLoaded(result);
          loaded += result.rows.length; successful++; missing += result.missing_employee_code;
        } catch (error) {
          failures.push(`${id}: ${error instanceof Error ? error.message : 'Không lấy được dữ liệu.'}`);
          if (error instanceof MetaQcError && error.status === 401) { setNeedsLogin(true); break; }
          if (error instanceof MetaQcError && [403, 503].includes(error.status)) break;
        }
      }
      const message = `Đã tải ${loaded} dòng QC từ ${successful}/${ids.length} tài khoản Meta (${since} → ${until}).` +
        (missing ? ` ${missing} dòng chưa có Mã NV trong tên chiến dịch.` : '');
      setProgress(message);
      if (failures.length) setError(failures.join('\n'));
      else setDone(true);
    } catch (error) { setError(error instanceof Error ? error.message : 'Không làm mới được dữ liệu QC.'); }
    finally { setBusy(false); }
  };

  return (
    <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      aria-labelledby="meta-import-title"
      className="m-auto w-[min(480px,calc(100vw-32px))] rounded-xl border border-[var(--border)] bg-[var(--bg2)] p-0 text-[var(--text)] shadow-2xl backdrop:bg-black/60">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <h2 id="meta-import-title" className="text-sm font-bold">Lấy dữ liệu trực tiếp từ Meta</h2>
        <button type="button" aria-label="Đóng" disabled={busy} onClick={onClose} className="rounded p-1 text-[var(--text3)] hover:bg-white/10 disabled:opacity-40"><X size={18} /></button>
      </div>
      <div className="space-y-4 p-5 text-sm">
        <p className="text-xs text-[var(--text3)]">Khoảng ngày: <strong className="text-[var(--text)]">{since} → {until}</strong></p>
        {needsLogin ? (
          <form onSubmit={event => void authenticate(event)} className="space-y-3">
            <p className="text-xs text-[var(--text2)]">Xác nhận tài khoản CRM để xem dữ liệu quảng cáo.</p>
            <label className="block text-xs">Email<input autoComplete="username" type="email" required value={email} disabled={busy} onChange={event => setEmail(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--bg3)] p-2" /></label>
            <label className="block text-xs">Mật khẩu<input autoComplete="current-password" type="password" required value={password} disabled={busy} onChange={event => setPassword(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--bg3)] p-2" /></label>
            <button disabled={busy} type="submit" className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />}Xác nhận tài khoản</button>
          </form>
        ) : accounts.length > 0 && !done ? (
          <>
            <label className="block text-xs">Tài khoản quảng cáo<select value={selected} disabled={busy} onChange={event => setSelected(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--bg3)] p-2"><option value="all">Tất cả tài khoản ({accounts.length})</option>{accounts.map(id => <option key={id} value={id}>{id}</option>)}</select></label>
            <p className="text-xs leading-relaxed text-[var(--text3)]">Xem trực tiếp theo ngày và chiến dịch. Dữ liệu chỉ hiển thị trong phiên xem này; tải lại trang cần lấy lại dữ liệu.</p>
            <button type="button" disabled={busy || !since || !until || since > until} onClick={() => void runImport()} className="flex items-center gap-2 rounded-lg bg-[#1877f2] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}{busy ? 'Đang lấy dữ liệu…' : 'Lấy dữ liệu'}</button>
          </>
        ) : busy ? <p className="flex items-center gap-2 text-xs"><Loader2 size={14} className="animate-spin" />Đang tải tài khoản…</p> : null}
        {progress && <p role="status" aria-live="polite" className="rounded-lg bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-500">{progress}</p>}
        {error && <p role="alert" className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-lg bg-red-500/10 p-3 text-xs leading-relaxed text-red-500">{error}</p>}
        {!busy && <button type="button" onClick={onClose} className="text-xs text-[var(--text3)] underline">{done ? 'Hoàn tất' : 'Đóng'}</button>}
      </div>
    </dialog>
  );
}
