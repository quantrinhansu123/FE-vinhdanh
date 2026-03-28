/**
 * Chiến dịch marketing — bảng marketing_campaigns + marketing_campaign_tkqc (gán TKQC)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { formatVnd } from '../../utils/dashboardAdminUtils';
import type { TkqcAccountRow, MarketingCampaignRow, CampaignTkqcLink } from '../../types';

const CAMPAIGNS_TABLE =
  import.meta.env.VITE_SUPABASE_MARKETING_CAMPAIGNS_TABLE?.trim() || 'marketing_campaigns';
const LINK_TABLE =
  import.meta.env.VITE_SUPABASE_MARKETING_CAMPAIGN_TKQC_TABLE?.trim() || 'marketing_campaign_tkqc';
const TKQC_TABLE = import.meta.env.VITE_SUPABASE_TKQC_ACCOUNTS_TABLE?.trim() || 'tkqc_accounts';


const TRANG_THAI_LABEL: Record<string, string> = {
  nhap: 'Nháp',
  dang_chay: 'Đang chạy',
  tam_dung: 'Tạm dừng',
  ket_thuc: 'Kết thúc',
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

export function MarketingCampaignsTable() {
  const [campaigns, setCampaigns] = useState<MarketingCampaignRow[]>([]);
  const [links, setLinks] = useState<CampaignTkqcLink[]>([]);
  const [tkqcAccounts, setTkqcAccounts] = useState<TkqcAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const [campaignModal, setCampaignModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fMa, setFMa] = useState('');
  const [fTen, setFTen] = useState('');
  const [fMoTa, setFMoTa] = useState('');
  const [fNenTang, setFNenTang] = useState('');
  const [fTu, setFTu] = useState('');
  const [fDen, setFDen] = useState('');
  const [fTrangThai, setFTrangThai] = useState('dang_chay');

  const [linkModalCampaignId, setLinkModalCampaignId] = useState<string | null>(null);
  const [fTkqcId, setFTkqcId] = useState('');
  const [fNsGan, setFNsGan] = useState('');
  const [fChiPhi, setFChiPhi] = useState('');
  const [fGhiChuLink, setFGhiChuLink] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [campRes, linkRes, tkqcRes] = await Promise.all([
      supabase.from(CAMPAIGNS_TABLE).select('*').order('created_at', { ascending: false }),
      supabase.from(LINK_TABLE).select(`
        id,
        campaign_id,
        tkqc_account_id,
        ngan_sach_gan,
        chi_phi_thuc_te,
        ghi_chu,
        tkqc_accounts ( tkqc, page, don_vi )
      `),
      supabase.from(TKQC_TABLE).select('id, tkqc, page, don_vi').order('tkqc', { ascending: true }),
    ]);

    if (campRes.error) {
      console.error(campRes.error);
      setError(campRes.error.message || 'Không tải được chiến dịch');
      setCampaigns([]);
    } else {
      setCampaigns((campRes.data || []) as MarketingCampaignRow[]);
    }

    if (linkRes.error) {
      console.error(linkRes.error);
      if (!campRes.error) setError(linkRes.error.message || 'Không tải được gán TKQC');
      setLinks([]);
    } else {
      setLinks((linkRes.data || []) as CampaignTkqcLink[]);
    }

    if (tkqcRes.error) {
      console.error(tkqcRes.error);
      setTkqcAccounts([]);
    } else {
      setTkqcAccounts((tkqcRes.data || []) as TkqcAccountRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const linksByCampaign = useMemo(() => {
    const m = new Map<string, CampaignTkqcLink[]>();
    for (const L of links) {
      const arr = m.get(L.campaign_id) || [];
      arr.push(L);
      m.set(L.campaign_id, arr);
    }
    return m;
  }, [links]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function resetCampaignForm() {
    setFMa('');
    setFTen('');
    setFMoTa('');
    setFNenTang('');
    setFTu('');
    setFDen('');
    setFTrangThai('dang_chay');
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    const ten = fTen.trim();
    if (!ten) {
      alert('Nhập tên chiến dịch');
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.from(CAMPAIGNS_TABLE).insert({
      ma_chien_dich: fMa.trim() || null,
      ten_chien_dich: ten,
      mo_ta: fMoTa.trim() || null,
      nen_tang: fNenTang.trim() || null,
      ngay_bat_dau: fTu || null,
      ngay_ket_thuc: fDen || null,
      trang_thai: fTrangThai,
    });
    setSaving(false);
    if (err) {
      alert(err.message || 'Không tạo được chiến dịch');
      return;
    }
    setCampaignModal(false);
    resetCampaignForm();
    fetchAll();
  }

  function resetLinkForm() {
    setFTkqcId('');
    setFNsGan('');
    setFChiPhi('');
    setFGhiChuLink('');
  }

  async function handleAddTkqc(e: React.FormEvent) {
    e.preventDefault();
    if (!linkModalCampaignId) return;
    if (!fTkqcId) {
      alert('Chọn TKQC');
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.from(LINK_TABLE).insert({
      campaign_id: linkModalCampaignId,
      tkqc_account_id: fTkqcId,
      ngan_sach_gan: Math.max(0, parseDigitsToInt(fNsGan)),
      chi_phi_thuc_te: Math.max(0, parseDigitsToInt(fChiPhi)),
      ghi_chu: fGhiChuLink.trim() || null,
    });
    setSaving(false);
    if (err) {
      alert(err.message || 'Không gán được TKQC (có thể đã gán rồi).');
      return;
    }
    setLinkModalCampaignId(null);
    resetLinkForm();
    fetchAll();
  }

  async function handleDeleteLink(linkId: string) {
    if (!confirm('Xóa gán TKQC khỏi chiến dịch?')) return;
    const { error: err } = await supabase.from(LINK_TABLE).delete().eq('id', linkId);
    if (err) {
      alert(err.message || 'Không xóa được');
      return;
    }
    fetchAll();
  }

  async function handleDeleteCampaign(id: string) {
    if (!confirm('Xóa chiến dịch và toàn bộ gán TKQC liên quan?')) return;
    const { error: err } = await supabase.from(CAMPAIGNS_TABLE).delete().eq('id', id);
    if (err) {
      alert(err.message || 'Không xóa được');
      return;
    }
    fetchAll();
  }

  return (
    <div id="crm-marketing-campaigns" className="w-full max-w-6xl mx-auto px-0 sm:px-1 space-y-6 pb-4">
      <div className="crm-glass-card rounded-2xl overflow-hidden border border-crm-outline/30">
        <div className="px-5 sm:px-8 py-5 border-b border-crm-outline/30 bg-crm-surface-accent/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-crm-on-surface tracking-tight">Chiến dịch &amp; TKQC</h2>
            <p className="text-xs text-crm-on-surface-variant mt-1">
              Bảng: <code className="text-crm-primary">{CAMPAIGNS_TABLE}</code> ·{' '}
              <code className="text-crm-primary">{LINK_TABLE}</code>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                resetCampaignForm();
                setCampaignModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-crm-primary text-white text-xs font-bold uppercase tracking-wider shadow-[0_0_16px_rgba(34,197,94,0.25)] hover:bg-crm-primary/90 transition-colors"
            >
              <Plus size={16} />
              Thêm chiến dịch
            </button>
            <button
              type="button"
              onClick={() => fetchAll()}
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

        <div className="p-4 sm:p-6">
          {loading && campaigns.length === 0 ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-crm-primary w-10 h-10" />
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-center text-crm-on-surface-variant text-sm py-12">
              Chưa có chiến dịch. Chạy SQL <code className="text-crm-primary">supabase/create_marketing_campaigns.sql</code> trên Supabase, rồi thêm chiến dịch.
            </p>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => {
                const sub = linksByCampaign.get(c.id) || [];
                const isOpen = expanded.has(c.id);
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-crm-outline/30 bg-crm-surface-accent/20 overflow-hidden"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-3 sm:px-4">
                      <button
                        type="button"
                        onClick={() => toggleExpand(c.id)}
                        className="flex items-center gap-2 min-w-0 text-left text-crm-on-surface flex-1"
                      >
                        {isOpen ? <ChevronDown size={18} className="shrink-0" /> : <ChevronRight size={18} className="shrink-0" />}
                        <span className="font-mono text-xs text-crm-primary shrink-0">{c.ma_chien_dich || '—'}</span>
                        <span className="font-semibold truncate">{c.ten_chien_dich}</span>
                        <span className="text-[10px] uppercase px-2 py-0.5 rounded-full border border-crm-outline/40 text-crm-on-surface-variant shrink-0">
                          {TRANG_THAI_LABEL[c.trang_thai] || c.trang_thai}
                        </span>
                      </button>
                      <div className="flex items-center gap-2 shrink-0 sm:ml-auto pl-7 sm:pl-0">
                        <button
                          type="button"
                          onClick={() => {
                            resetLinkForm();
                            setLinkModalCampaignId(c.id);
                          }}
                          className="text-xs font-bold text-crm-primary hover:underline"
                        >
                          + Gán TKQC
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCampaign(c.id)}
                          className="p-1.5 rounded-lg text-crm-error/80 hover:bg-crm-error/10"
                          title="Xóa chiến dịch"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="px-4 pb-2 text-xs text-crm-on-surface-variant flex flex-wrap gap-x-4 gap-y-1">
                      {c.nen_tang && <span>Nền tảng: {c.nen_tang}</span>}
                      {c.ngay_bat_dau && <span>Từ: {c.ngay_bat_dau}</span>}
                      {c.ngay_ket_thuc && <span>Đến: {c.ngay_ket_thuc}</span>}
                    </div>
                    {isOpen && (
                      <div className="border-t border-crm-outline/25 px-3 py-3 sm:px-4 bg-crm-surface/40">
                        {sub.length === 0 ? (
                          <p className="text-sm text-crm-on-surface-variant">Chưa gán TKQC nào.</p>
                        ) : (
                          <table className="w-full text-left text-sm min-w-[520px]">
                            <thead>
                              <tr className="text-[10px] uppercase text-crm-on-surface-variant border-b border-crm-outline/30">
                                <th className="py-2 pr-2">TKQC</th>
                                <th className="py-2 pr-2 hidden sm:table-cell">Page</th>
                                <th className="py-2 text-right">NS gán</th>
                                <th className="py-2 text-right">Chi phí</th>
                                <th className="py-2 w-10" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-crm-outline/15">
                              {sub.map((L) => {
                                const acc = L.tkqc_accounts;
                                return (
                                  <tr key={L.id}>
                                    <td className="py-2 font-medium text-crm-on-surface">{acc?.tkqc || L.tkqc_account_id.slice(0, 8)}</td>
                                    <td className="py-2 text-crm-on-surface-variant text-xs max-w-[160px] truncate hidden sm:table-cell">
                                      {acc?.page || '—'}
                                    </td>
                                    <td className="py-2 text-right tabular-nums">{formatVnd(num(L.ngan_sach_gan))}</td>
                                    <td className="py-2 text-right tabular-nums">{formatVnd(num(L.chi_phi_thuc_te))}</td>
                                    <td className="py-2">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteLink(L.id)}
                                        className="p-1 rounded text-crm-error/70 hover:bg-crm-error/10"
                                        title="Xóa gán"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {campaignModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog">
          <form
            onSubmit={handleCreateCampaign}
            className="crm-glass-card max-w-lg w-full rounded-2xl border border-crm-outline/40 p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <h3 className="text-lg font-bold text-crm-on-surface mb-4">Thêm chiến dịch</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Mã chiến dịch</label>
                <input
                  value={fMa}
                  onChange={(e) => setFMa(e.target.value)}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface"
                  placeholder="CD-2025-01"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Tên chiến dịch *</label>
                <input
                  required
                  value={fTen}
                  onChange={(e) => setFTen(e.target.value)}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Mô tả</label>
                <textarea
                  value={fMoTa}
                  onChange={(e) => setFMoTa(e.target.value)}
                  rows={2}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface resize-y"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Nền tảng</label>
                <input
                  value={fNenTang}
                  onChange={(e) => setFNenTang(e.target.value)}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface"
                  placeholder="Facebook, Google..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Từ ngày</label>
                  <input
                    type="date"
                    value={fTu}
                    onChange={(e) => setFTu(e.target.value)}
                    className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Đến ngày</label>
                  <input
                    type="date"
                    value={fDen}
                    onChange={(e) => setFDen(e.target.value)}
                    className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Trạng thái</label>
                <select
                  value={fTrangThai}
                  onChange={(e) => setFTrangThai(e.target.value)}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface"
                >
                  {Object.entries(TRANG_THAI_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCampaignModal(false);
                  resetCampaignForm();
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

      {linkModalCampaignId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog">
          <form
            onSubmit={handleAddTkqc}
            className="crm-glass-card max-w-md w-full rounded-2xl border border-crm-outline/40 p-6 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-crm-on-surface mb-4">Gán TKQC vào chiến dịch</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Tài khoản TKQC *</label>
                <select
                  required
                  value={fTkqcId}
                  onChange={(e) => setFTkqcId(e.target.value)}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface"
                >
                  <option value="">— Chọn —</option>
                  {tkqcAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.tkqc}
                      {a.page ? ` — ${a.page}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Ngân sách gán (VND)</label>
                <input
                  value={formatDigitsDisplay(fNsGan)}
                  onChange={(e) => setFNsGan(e.target.value.replace(/\D/g, ''))}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface text-right tabular-nums"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Chi phí thực tế (VND)</label>
                <input
                  value={formatDigitsDisplay(fChiPhi)}
                  onChange={(e) => setFChiPhi(e.target.value.replace(/\D/g, ''))}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface text-right tabular-nums"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Ghi chú</label>
                <input
                  value={fGhiChuLink}
                  onChange={(e) => setFGhiChuLink(e.target.value)}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setLinkModalCampaignId(null);
                  resetLinkForm();
                }}
                className="flex-1 py-2.5 rounded-xl border border-crm-outline/50 text-crm-on-surface font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving || tkqcAccounts.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-crm-primary text-white font-bold disabled:opacity-50"
              >
                {saving ? 'Đang lưu…' : 'Gán'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
