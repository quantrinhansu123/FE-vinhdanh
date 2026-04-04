import React, { useEffect, useMemo } from 'react';

const L1_ROWS: { agency: string; nap: string; khaiBao: string; chenh: string; chenhTone: 'err' | 'ok' | 'mid' }[] = [
  { agency: 'Agency Alpha', nap: '500.000.000', khaiBao: '495.000.000', chenh: '-5.000.000', chenhTone: 'err' },
  { agency: 'Beta Media', nap: '320.000.000', khaiBao: '320.000.000', chenh: '0', chenhTone: 'ok' },
  { agency: 'Gamma Global', nap: '150.000.000', khaiBao: '152.500.000', chenh: '+2.500.000', chenhTone: 'mid' },
];

const L2_CARDS: {
  marketer: string;
  campaign: string;
  declared: string;
  api: string;
  diffLabel: string;
  diffTone: 'err' | 'ok' | 'warn';
  icon: 'error' | 'check' | 'warn';
}[] = [
  {
    marketer: 'Marketer: Jack N.',
    campaign: 'Facebook_Video_Ads',
    declared: '12.50M',
    api: '14.12M',
    diffLabel: '-12.9%',
    diffTone: 'err',
    icon: 'error',
  },
  {
    marketer: 'Marketer: Sarah P.',
    campaign: 'Google_Search_Branding',
    declared: '45.00M',
    api: '44.98M',
    diffLabel: '0.04%',
    diffTone: 'ok',
    icon: 'check',
  },
  {
    marketer: 'Marketer: Tran H.',
    campaign: 'Tiktok_Viral_04',
    declared: '8.20M',
    api: '7.80M',
    diffLabel: '-4.8%',
    diffTone: 'warn',
    icon: 'warn',
  },
  {
    marketer: 'Marketer: Minh V.',
    campaign: 'Zalo_Official_Care',
    declared: '3.45M',
    api: '3.45M',
    diffLabel: '0%',
    diffTone: 'ok',
    icon: 'check',
  },
];

function chenhClass(tone: 'err' | 'ok' | 'mid'): string {
  switch (tone) {
    case 'err':
      return 'text-[#ff716c]';
    case 'ok':
      return 'text-[#69f6b8]';
    default:
      return 'text-[#69f6b8]';
  }
}

function l2BorderHover(tone: 'err' | 'ok' | 'warn'): string {
  switch (tone) {
    case 'err':
      return 'hover:border-[#3bbffa]/40';
    case 'warn':
      return 'hover:border-[#ffb148]/40';
    default:
      return 'hover:border-[#69f6b8]/40';
  }
}

function l2DiffBadge(tone: 'err' | 'ok' | 'warn'): string {
  switch (tone) {
    case 'err':
      return 'bg-[#9f0519]/20 text-[#ff716c]';
    case 'warn':
      return 'bg-[#f8a010]/20 text-[#ffb148]';
    default:
      return 'bg-[#006c49]/20 text-[#69f6b8]';
  }
}

export const ReconcileView: React.FC = () => {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Đối chiếu 3 Lớp - Obsidian CRM';
    return () => {
      document.title = prev;
    };
  }, []);

  const lastSync = useMemo(() => {
    const d = new Date();
    const w = d.toLocaleDateString('vi-VN', { weekday: 'short' });
    const rest = d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return `${w} ${rest}`;
  }, []);

  return (
    <div className="relative isolate -m-3 min-h-[calc(100vh-5.5rem)] overflow-x-hidden bg-[#070d1f] font-[Inter,sans-serif] text-[#dfe4fe] antialiased ag-prism-scroll">
      <div className="pointer-events-none absolute -right-32 -top-32 h-[600px] w-[600px] rounded-full bg-[#3bbffa]/5 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-32 h-[400px] w-[400px] rounded-full bg-[#69f6b8]/5 blur-[100px]" />

      <div className="relative z-10 px-6 pb-12 pt-4 sm:px-10">
        <header className="mb-8 flex flex-col gap-4 border-b border-[#41475b]/15 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-6 lg:gap-8">
            <span className="text-xl font-black text-[#dfe4fe]">Data Heatmap</span>
            <nav className="flex gap-4 sm:gap-6">
              <span className="cursor-default font-[Manrope,sans-serif] text-xs font-semibold text-[#a5aac2] hover:text-[#dfe4fe]">
                Overview
              </span>
              <span className="border-b-2 border-[#3bbffa] pb-2 font-[Manrope,sans-serif] text-xs font-semibold text-[#3bbffa]">
                Analysis
              </span>
              <span className="cursor-default font-[Manrope,sans-serif] text-xs font-semibold text-[#a5aac2] hover:text-[#dfe4fe]">
                Reports
              </span>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-[#a5aac2]">
            <button
              type="button"
              className="rounded-lg p-2 opacity-80 transition-all hover:bg-[#1c253e]/50 active:opacity-100"
              title="Thông báo"
            >
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button
              type="button"
              className="rounded-lg p-2 opacity-80 transition-all hover:bg-[#1c253e]/50 active:opacity-100"
              title="Lịch sử"
            >
              <span className="material-symbols-outlined">history</span>
            </button>
          </div>
        </header>

        <div className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h2 className="mb-1 font-[Inter,sans-serif] text-3xl font-bold tracking-tight text-[#dfe4fe]">
              Đối chiếu 3 Lớp
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 rounded-full bg-[#69f6b8]/15 px-3 py-1 font-[Manrope,sans-serif] text-xs font-bold uppercase tracking-wider text-[#69f6b8]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#69f6b8]" />
                Live
              </span>
              <span className="font-[Manrope,sans-serif] text-xs font-medium text-[#a5aac2]">
                Last sync: {lastSync}
              </span>
            </div>
          </div>
          <div className="flex max-w-md items-center gap-3 rounded-xl border border-[#f8a010]/30 bg-[#f8a010]/10 px-5 py-3">
            <span className="material-symbols-outlined shrink-0 text-[#ffb148]">warning</span>
            <p className="font-[Manrope,sans-serif] text-sm font-semibold leading-tight text-[#ffb148]">
              Marketing không được sửa tay — CRM trả về trực tiếp
            </p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <section className="relative col-span-12 overflow-hidden rounded-xl bg-[#0c1326] p-6 shadow-sm lg:col-span-7">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-[Inter,sans-serif] text-lg font-bold text-[#dfe4fe]">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3bbffa]/10 text-sm font-black text-[#3bbffa]">
                  L1
                </span>
                Lớp 1 - Nạp vs Khai báo
              </h3>
              <span className="material-symbols-outlined text-[#a5aac2]/50">more_horiz</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-2 text-left">
                <thead>
                  <tr className="font-[Manrope,sans-serif] text-xs uppercase tracking-widest text-[#a5aac2]">
                    <th className="px-4 pb-2">Agency</th>
                    <th className="px-4 pb-2">Nạp</th>
                    <th className="px-4 pb-2">Khai báo</th>
                    <th className="px-4 pb-2 text-right">Chênh</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium">
                  {L1_ROWS.map((row) => (
                    <tr
                      key={row.agency}
                      className="bg-[#11192e] transition-colors hover:bg-[#171f36]"
                    >
                      <td className="rounded-l-lg px-4 py-4 font-[Inter,sans-serif]">{row.agency}</td>
                      <td className="px-4 py-4 tabular-nums">{row.nap}</td>
                      <td className="px-4 py-4 tabular-nums">{row.khaiBao}</td>
                      <td className={`rounded-r-lg px-4 py-4 text-right tabular-nums ${chenhClass(row.chenhTone)}`}>
                        {row.chenh}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="col-span-12 flex flex-col justify-between rounded-xl bg-[#0c1326] p-6 lg:col-span-5">
            <div>
              <h3 className="mb-6 flex items-center gap-2 font-[Inter,sans-serif] text-lg font-bold text-[#dfe4fe]">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#69f6b8]/10 text-sm font-black text-[#69f6b8]">
                  L3
                </span>
                Lớp 3 - Lead / Đơn / DT (CRM API)
              </h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between font-[Manrope,sans-serif] text-xs font-bold uppercase tracking-tighter text-[#a5aac2]">
                    <span>Lead tổng</span>
                    <span className="text-[#dfe4fe]">1.245 / 1.500</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-black">
                    <div className="h-full w-[83%] rounded-full bg-[#3bbffa]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between font-[Manrope,sans-serif] text-xs font-bold uppercase tracking-tighter text-[#a5aac2]">
                    <span>Đơn chốt</span>
                    <span className="text-[#dfe4fe]">458 / 800</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-black">
                    <div className="h-full w-[57%] rounded-full bg-[#69f6b8]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between font-[Manrope,sans-serif] text-xs font-bold uppercase tracking-tighter text-[#a5aac2]">
                    <span>Chưa chốt</span>
                    <span className="text-[#dfe4fe]">787</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-black">
                    <div className="h-full w-[43%] rounded-full bg-[#ff716c] opacity-60" />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-[#41475b]/10 pt-6">
              <div>
                <p className="mb-1 font-[Manrope,sans-serif] text-xs font-bold uppercase text-[#a5aac2]">DT Tổng</p>
                <p className="font-[Inter,sans-serif] text-2xl font-black text-[#3bbffa]">
                  2.458.000.000 <span className="text-xs">VNĐ</span>
                </p>
              </div>
              <div className="text-right">
                <p className="mb-1 font-[Manrope,sans-serif] text-xs font-bold uppercase text-[#a5aac2]">ROI</p>
                <p className="font-[Inter,sans-serif] text-2xl font-black text-[#69f6b8]">4.2x</p>
              </div>
            </div>
          </section>

          <section className="col-span-12 rounded-xl bg-[#0c1326] p-6 sm:p-8">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <h3 className="flex items-center gap-2 font-[Inter,sans-serif] text-lg font-bold text-[#dfe4fe]">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ffb148]/10 text-sm font-black text-[#ffb148]">
                  L2
                </span>
                Lớp 2 - Khai báo vs API
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-[#11192e] px-4 py-2 font-[Manrope,sans-serif] text-xs font-bold transition-all hover:bg-[#1c253e]"
                >
                  Export Report
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[#3bbffa]/10 px-4 py-2 font-[Manrope,sans-serif] text-xs font-bold text-[#3bbffa] transition-all hover:bg-[#3bbffa]/20"
                >
                  Resync All
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {L2_CARDS.map((c) => (
                <div
                  key={c.campaign}
                  className={`group rounded-xl border border-[#41475b]/10 bg-black p-5 transition-all ${l2BorderHover(c.diffTone)}`}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <span className="font-[Manrope,sans-serif] text-xs font-bold text-[#a5aac2]">{c.marketer}</span>
                    {c.icon === 'error' ? (
                      <span className="material-symbols-outlined text-lg text-[#9f0519]">error</span>
                    ) : c.icon === 'warn' ? (
                      <span className="material-symbols-outlined text-lg text-[#f8a010]">warning</span>
                    ) : (
                      <span
                        className="material-symbols-outlined text-lg text-[#006c49]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                    )}
                  </div>
                  <h4 className="mb-4 font-[Inter,sans-serif] text-base font-bold text-[#dfe4fe]">{c.campaign}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase text-[#a5aac2]">Khai báo</p>
                      <p className="text-sm font-bold tabular-nums">{c.declared}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-[#a5aac2]">API</p>
                      <p className="text-sm font-bold tabular-nums">{c.api}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-[#41475b]/10 pt-4">
                    <span className="font-[Manrope,sans-serif] text-xs text-[#a5aac2]">Sai lệch</span>
                    <span className={`rounded px-2 py-0.5 font-[Inter,sans-serif] text-xs font-black ${l2DiffBadge(c.diffTone)}`}>
                      {c.diffLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

      </div>
    </div>
  );
};
