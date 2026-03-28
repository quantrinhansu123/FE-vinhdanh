/**
 * Kênh & nội dung — bảng marketing_channels + marketing_channel_details (chi tiết / link nhóm)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, ExternalLink, Plus, Eye, Trash2 } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { formatVnd } from '../../utils/dashboardAdminUtils';
import type { MarketingChannelRow, MarketingChannelDetailRow } from '../../types';

const TABLE = import.meta.env.VITE_SUPABASE_MARKETING_CHANNELS_TABLE?.trim() || 'marketing_channels';
const DETAILS_TABLE =
  import.meta.env.VITE_SUPABASE_MARKETING_CHANNEL_DETAILS_TABLE?.trim() || 'marketing_channel_details';


type DetailLine = {
  id: string;
  content_link: string;
  image_link: string;
  groups: string[];
  ghi_chu: string;
};

function num(v: number | null | undefined): number {
  return v == null || Number.isNaN(Number(v)) ? 0 : Number(v);
}

function formatDigitsDisplay(digitsRaw: string): string {
  const d = digitsRaw.replace(/\D/g, '');
  if (!d) return '';
  return Number(d).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}

function parseDigitsToInt(digitsRaw: string): number {
  return parseInt(digitsRaw.replace(/\D/g, ''), 10) || 0;
}

function normalizeLinkNhom(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return [];
  return [];
}

function mapDetailToLine(d: MarketingChannelDetailRow): DetailLine {
  return {
    id: d.id,
    content_link: d.content_link?.trim() || '',
    image_link: d.image_link?.trim() || '',
    groups: normalizeLinkNhom(d.link_nhom).length ? normalizeLinkNhom(d.link_nhom) : [''],
    ghi_chu: d.ghi_chu?.trim() || '',
  };
}

export function MarketingChannelsPage() {
  const [rows, setRows] = useState<MarketingChannelRow[]>([]);
  const [detailCounts, setDetailCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fLoai, setFLoai] = useState('');
  const [fLink, setFLink] = useState('');
  const [fNoiDung, setFNoiDung] = useState('');
  const [fChiPhi, setFChiPhi] = useState('');
  const [fLead, setFLead] = useState('');
  const [fDon, setFDon] = useState('');

  const [detailModalChannel, setDetailModalChannel] = useState<MarketingChannelRow | null>(null);
  const [detailLines, setDetailLines] = useState<DetailLine[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSavingId, setDetailSavingId] = useState<string | null>(null);

  const fetchDetailCounts = useCallback(async () => {
    const { data, error: err } = await supabase.from(DETAILS_TABLE).select('channel_id');
    if (err) {
      console.error(err);
      return;
    }
    const m: Record<string, number> = {};
    for (const r of data || []) {
      const id = (r as { channel_id: string }).channel_id;
      m[id] = (m[id] || 0) + 1;
    }
    setDetailCounts(m);
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from(TABLE)
      .select('id, loai_kenh, link_kenh, noi_dung, chi_phi, so_lead, so_don')
      .order('loai_kenh', { ascending: true });
    if (err) {
      console.error(err);
      setError(err.message || 'Không tải được danh sách kênh');
      setRows([]);
    } else {
      setRows((data || []) as MarketingChannelRow[]);
    }
    setLoading(false);
    await fetchDetailCounts();
  }, [fetchDetailCounts]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const loadDetailsForChannel = useCallback(async (channelId: string) => {
    setDetailLoading(true);
    const { data, error: err } = await supabase
      .from(DETAILS_TABLE)
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true });
    setDetailLoading(false);
    if (err) {
      console.error(err);
      alert(err.message || 'Không tải chi tiết');
      setDetailLines([]);
      return;
    }
    const list = (data || []) as MarketingChannelDetailRow[];
    setDetailLines(list.length ? list.map(mapDetailToLine) : []);
  }, []);

  useEffect(() => {
    if (!detailModalChannel) {
      setDetailLines([]);
      return;
    }
    loadDetailsForChannel(detailModalChannel.id);
  }, [detailModalChannel, loadDetailsForChannel]);

  function resetForm() {
    setFLoai('');
    setFLink('');
    setFNoiDung('');
    setFChiPhi('');
    setFLead('');
    setFDon('');
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const loai = fLoai.trim();
    if (!loai) {
      alert('Nhập loại kênh');
      return;
    }
    setSaving(true);
    const chiPhi = Math.max(0, parseDigitsToInt(fChiPhi));
    const { error: err } = await supabase.from(TABLE).insert({
      loai_kenh: loai,
      link_kenh: fLink.trim() || null,
      noi_dung: fNoiDung.trim() || null,
      chi_phi: chiPhi,
      so_lead: Math.max(0, parseInt(fLead.replace(/\D/g, ''), 10) || 0),
      so_don: Math.max(0, parseInt(fDon.replace(/\D/g, ''), 10) || 0),
    });
    setSaving(false);
    if (err) {
      alert(err.message || 'Không thêm được');
      return;
    }
    setCreateOpen(false);
    resetForm();
    fetchRows();
  }

  async function handleAddDetailRow() {
    if (!detailModalChannel) return;
    setSaving(true);
    const { error: err } = await supabase.from(DETAILS_TABLE).insert({
      channel_id: detailModalChannel.id,
      content_link: null,
      image_link: null,
      link_nhom: [],
      ghi_chu: null,
    });
    setSaving(false);
    if (err) {
      alert(err.message || 'Không thêm dòng chi tiết. Chạy SQL create_marketing_channel_details.sql trên Supabase.');
      return;
    }
    await loadDetailsForChannel(detailModalChannel.id);
    await fetchDetailCounts();
  }

  async function saveDetailLine(line: DetailLine) {
    if (!detailModalChannel) return;
    const groups = line.groups.map((g) => g.trim()).filter(Boolean);
    setDetailSavingId(line.id);
    const { error: err } = await supabase
      .from(DETAILS_TABLE)
      .update({
        content_link: line.content_link.trim() || null,
        image_link: line.image_link.trim() || null,
        link_nhom: groups,
        ghi_chu: line.ghi_chu.trim() || null,
      })
      .eq('id', line.id);
    setDetailSavingId(null);
    if (err) {
      alert(err.message || 'Không lưu được');
      return;
    }
    await fetchDetailCounts();
  }

  async function deleteDetailLine(id: string) {
    if (!confirm('Xóa dòng chi tiết này?')) return;
    setDetailSavingId(id);
    const { error: err } = await supabase.from(DETAILS_TABLE).delete().eq('id', id);
    setDetailSavingId(null);
    if (err) {
      alert(err.message || 'Không xóa được');
      return;
    }
    setDetailLines((prev) => prev.filter((l) => l.id !== id));
    await fetchDetailCounts();
  }

  function updateLine(id: string, patch: Partial<DetailLine>) {
    setDetailLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function addGroupSlot(lineId: string) {
    setDetailLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, groups: [...l.groups, ''] } : l))
    );
  }

  function setGroup(lineId: string, index: number, value: string) {
    setDetailLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const g = [...l.groups];
        g[index] = value;
        return { ...l, groups: g };
      })
    );
  }

  function removeGroup(lineId: string, index: number) {
    setDetailLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const g = l.groups.filter((_, i) => i !== index);
        return { ...l, groups: g.length ? g : [''] };
      })
    );
  }

  const modalTitle = useMemo(
    () => (detailModalChannel ? `Chi tiết nội dung — ${detailModalChannel.loai_kenh}` : ''),
    [detailModalChannel]
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-0 sm:px-1">
      <div id="crm-marketing-channels" className="crm-glass-card rounded-2xl overflow-hidden border border-crm-outline/30">
        <div className="px-5 sm:px-8 py-5 border-b border-crm-outline/30 bg-crm-surface-accent/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold text-crm-on-surface tracking-tight">Kênh & nội dung</h2>
            <p className="text-xs text-crm-on-surface-variant mt-1">
              Bảng: <code className="text-crm-primary">{TABLE}</code> · Chi tiết:{' '}
              <code className="text-crm-primary">{DETAILS_TABLE}</code>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setCreateOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-crm-primary text-white text-xs font-bold uppercase tracking-wider shadow-[0_0_16px_rgba(34,197,94,0.25)] hover:bg-crm-primary/90 transition-colors"
            >
              <Plus size={16} />
              Thêm Kênh
            </button>
            <button
              type="button"
              onClick={() => fetchRows()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-crm-primary/15 hover:bg-crm-primary/25 text-crm-primary text-xs font-bold uppercase tracking-wider border border-crm-primary/30 transition-colors disabled:opacity-50"
            >
              <Loader2 className={loading ? 'animate-spin' : ''} size={16} />
              Làm mới
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 sm:mx-8 mt-4 px-4 py-3 rounded-xl border border-crm-error/50 bg-crm-error/10 text-sm text-crm-error">
            {error}
          </div>
        )}

        <div className="overflow-x-auto p-4 sm:p-6">
          {loading && rows.length === 0 ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-crm-primary w-10 h-10" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-crm-surface-accent/40 border-b border-crm-outline/40">
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider whitespace-nowrap w-12">
                    Chi tiết
                  </th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                    Loại kênh
                  </th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider min-w-[160px]">
                    Link kênh
                  </th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider min-w-[200px]">
                    Nội dung
                  </th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider text-right whitespace-nowrap">
                    Chi phí
                  </th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider text-right whitespace-nowrap">
                    Số lead
                  </th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider text-right whitespace-nowrap">
                    Số đơn
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-crm-outline/20">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-crm-on-surface-variant text-sm">
                      Chưa có dữ liệu. Chạy SQL <code className="text-crm-primary">supabase/create_marketing_channels.sql</code> trên Supabase.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const href = r.link_kenh?.trim();
                    const safeHref =
                      href && (href.startsWith('http://') || href.startsWith('https://'))
                        ? href
                        : href
                          ? `https://${href}`
                          : null;
                    const n = detailCounts[r.id] || 0;
                    return (
                      <tr key={r.id} className="hover:bg-crm-surface-accent/25 transition-colors align-top">
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => setDetailModalChannel(r)}
                            className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-crm-primary/30 bg-crm-primary/10 text-crm-primary hover:bg-crm-primary/20 transition-colors"
                            title="Xem / sửa nội dung chi tiết"
                          >
                            <Eye size={18} />
                            {n > 0 && (
                              <span className="text-[10px] font-bold tabular-nums min-w-[1rem]">{n}</span>
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-crm-on-surface whitespace-nowrap">{r.loai_kenh}</td>
                        <td className="px-3 py-3 text-sm">
                          {safeHref ? (
                            <a
                              href={safeHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-crm-primary hover:underline break-all max-w-[280px]"
                            >
                              <span className="truncate">{r.link_kenh}</span>
                              <ExternalLink size={14} className="shrink-0 opacity-70" />
                            </a>
                          ) : (
                            <span className="text-crm-on-surface-variant">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-crm-on-surface leading-relaxed max-w-[320px]">
                          {r.noi_dung || <span className="text-crm-on-surface-variant">—</span>}
                        </td>
                        <td className="px-3 py-3 text-sm text-crm-on-surface text-right tabular-nums whitespace-nowrap">
                          {formatVnd(num(r.chi_phi))}
                        </td>
                        <td className="px-3 py-3 text-sm text-crm-on-surface text-right tabular-nums">
                          {num(r.so_lead).toLocaleString('vi-VN')}
                        </td>
                        <td className="px-3 py-3 text-sm text-crm-on-surface text-right tabular-nums">
                          {num(r.so_don).toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {createOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog">
            <form
              onSubmit={handleCreate}
              className="crm-glass-card max-w-lg w-full rounded-2xl border border-crm-outline/40 p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
            >
              <h3 className="text-lg font-bold text-crm-on-surface mb-4">Thêm kênh marketing</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Loại kênh *</label>
                  <input
                    required
                    value={fLoai}
                    onChange={(e) => setFLoai(e.target.value)}
                    className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface"
                    placeholder="VD: Facebook Ads"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Link kênh</label>
                  <input
                    value={fLink}
                    onChange={(e) => setFLink(e.target.value)}
                    className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface"
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Nội dung</label>
                  <textarea
                    value={fNoiDung}
                    onChange={(e) => setFNoiDung(e.target.value)}
                    rows={3}
                    className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface resize-y min-h-[80px]"
                    placeholder="Mô tả / nội dung content"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Chi phí (VND)</label>
                  <input
                    value={formatDigitsDisplay(fChiPhi)}
                    onChange={(e) => setFChiPhi(e.target.value.replace(/\D/g, ''))}
                    className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface text-right tabular-nums"
                    placeholder="0"
                    inputMode="numeric"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Số lead</label>
                    <input
                      value={fLead}
                      onChange={(e) => setFLead(e.target.value.replace(/\D/g, ''))}
                      className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface text-right tabular-nums"
                      placeholder="0"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Số đơn</label>
                    <input
                      value={fDon}
                      onChange={(e) => setFDon(e.target.value.replace(/\D/g, ''))}
                      className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface text-right tabular-nums"
                      placeholder="0"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    resetForm();
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-crm-outline/50 text-crm-on-surface font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-crm-primary text-white font-bold disabled:opacity-50"
                >
                  {saving ? 'Đang lưu…' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        )}

        {detailModalChannel && (
          <div
            className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
            role="dialog"
            aria-labelledby="channel-detail-modal-title"
          >
            <div className="crm-glass-card w-full max-w-2xl rounded-2xl border border-crm-outline/40 p-6 sm:p-8 shadow-2xl my-8 max-h-[min(92vh,900px)] overflow-y-auto">
              <div className="flex items-start justify-between gap-4 mb-6">
                <h3 id="channel-detail-modal-title" className="text-lg sm:text-xl font-bold text-crm-on-surface pr-4">
                  {modalTitle}
                </h3>
                <button
                  type="button"
                  onClick={() => setDetailModalChannel(null)}
                  className="shrink-0 text-sm font-semibold text-crm-on-surface-variant hover:text-crm-on-surface"
                >
                  Đóng
                </button>
              </div>

              <p className="text-xs text-crm-on-surface-variant mb-4">
                Mỗi dòng là một bộ nội dung: link content, link ảnh, và <strong className="text-crm-on-surface">nhiều link nhóm</strong>{' '}
                (Facebook/Zalo/…).
              </p>

              {detailLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-crm-primary w-10 h-10" />
                </div>
              ) : (
                <div className="space-y-6">
                  {detailLines.length === 0 && !detailLoading && (
                    <p className="text-sm text-crm-on-surface-variant">Chưa có dòng chi tiết. Nhấn &quot;Thêm nội dung&quot; bên dưới.</p>
                  )}

                  {detailLines.map((line) => (
                    <div
                      key={line.id}
                      className="rounded-xl border border-crm-outline/35 bg-crm-surface-accent/25 p-4 space-y-3"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase text-crm-on-surface-variant tracking-wider">
                          Nội dung chi tiết
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteDetailLine(line.id)}
                          disabled={detailSavingId === line.id}
                          className="p-1.5 rounded-lg text-crm-error/80 hover:bg-crm-error/10 disabled:opacity-50"
                          title="Xóa dòng"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Content link</label>
                        <input
                          value={line.content_link}
                          onChange={(e) => updateLine(line.id, { content_link: e.target.value })}
                          className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-3 py-2 text-sm text-crm-on-surface"
                          placeholder="https://…"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Link ảnh</label>
                        <input
                          value={line.image_link}
                          onChange={(e) => updateLine(line.id, { image_link: e.target.value })}
                          className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-3 py-2 text-sm text-crm-on-surface"
                          placeholder="https://…"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Link nhóm</label>
                          <button
                            type="button"
                            onClick={() => addGroupSlot(line.id)}
                            className="text-[10px] font-bold text-crm-primary hover:underline"
                          >
                            + Thêm nhóm
                          </button>
                        </div>
                        <div className="space-y-2">
                          {line.groups.map((g, idx) => (
                            <div key={`${line.id}-g-${idx}`} className="flex gap-2">
                              <input
                                value={g}
                                onChange={(e) => setGroup(line.id, idx, e.target.value)}
                                className="flex-1 bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-3 py-2 text-sm text-crm-on-surface"
                                placeholder={`Link nhóm ${idx + 1}`}
                              />
                              {line.groups.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeGroup(line.id, idx)}
                                  className="shrink-0 px-2 text-crm-on-surface-variant hover:text-crm-error text-xs"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Ghi chú</label>
                        <input
                          value={line.ghi_chu}
                          onChange={(e) => updateLine(line.id, { ghi_chu: e.target.value })}
                          className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-3 py-2 text-sm text-crm-on-surface"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => saveDetailLine(line)}
                        disabled={detailSavingId === line.id}
                        className="w-full py-2.5 rounded-xl bg-crm-primary text-white text-sm font-bold disabled:opacity-50"
                      >
                        {detailSavingId === line.id ? 'Đang lưu…' : 'Lưu dòng này'}
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddDetailRow}
                    disabled={saving}
                    className="w-full py-3 rounded-xl border border-dashed border-crm-primary/40 text-crm-primary text-sm font-bold hover:bg-crm-primary/10 disabled:opacity-50"
                  >
                    {saving ? 'Đang thêm…' : '+ Thêm nội dung chi tiết'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
