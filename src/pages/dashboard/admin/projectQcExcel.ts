import * as XLSX from 'xlsx';

export const QC_EXCEL_TABLE =
  import.meta.env.VITE_SUPABASE_DU_AN_QC_EXCEL_TABLE?.trim() || 'du_an_qc_excel_rows';

export const QC_EXCEL_TEMPLATE_FILENAME = 'mau-du-lieu-qc-du-an.xlsx';

/**
 * Mẫu tải xuống: tên cột như export Meta (VN). Khi đọc file thật, parser **map theo tên tiêu đề cột**
 * (chuẩn hóa, không phụ thuộc thứ tự A,B,C…).
 */
/** Mẫu tải về: tối thiểu. File export Meta đầy đủ vẫn import được (đọc theo tên cột). */
export const QC_EXCEL_HEADERS = [
  'Tên tài khoản',
  'Tên quảng cáo',
  'Ngày',
  'Đơn vị tiền tệ',
  'Số tiền đã chi tiêu',
  'Lượt bắt đầu cuộc trò chuyện qua tin nhắn',
] as const;

export type QcExcelDbRow = {
  du_an_id: string | null;
  ten_tai_khoan: string | null;
  ten_quang_cao: string | null;
  ngay: string | null;
  don_vi_tien_te: string | null;
  so_tien_chi_tieu_vnd: number | null;
  chi_phi_mua: number | null;
  cpm: number | null;
  ctr_tat_ca: string | null;
  luot_tro_chuyen_tin_nhan: number | null;
  cpc: number | null;
  bao_cao_tu: string | null;
  bao_cao_den: string | null;
  source_file: string | null;
};

/** Hai dòng mẫu: [mã] trong tên quảng cáo; dòng All + dòng theo ngày */
const EXAMPLE_ROWS: (string | number)[][] = [
  ['FBC 7', 'FABICO - 122120954511034419 [VD-QC-01]', 'All', 'VND', 1707762, 1],
  ['', '', '2026-03-31', 'VND', 120000, 0],
];

function excelSerialToYyyyMmDd(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const whole = Math.floor(serial);
  if (whole < 20000 || whole > 100000) return null;
  const utcMs = (whole - 25569) * 86400 * 1000;
  const u = new Date(utcMs);
  const y = u.getUTCFullYear();
  const m = String(u.getUTCMonth() + 1).padStart(2, '0');
  const d = String(u.getUTCDate()).padStart(2, '0');
  if (y < 1990 || y > 2100) return null;
  return `${y}-${m}-${d}`;
}

function excelSerialToIsoDateTime(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const utcMs = (serial - 25569) * 86400 * 1000;
  const u = new Date(utcMs);
  if (Number.isNaN(u.getTime())) return null;
  return u.toISOString();
}

/** Meta: dòng tổng hợp theo quảng cáo dùng nhãn «All» / «Tất cả» — không map sang kiểu date. */
function isSummaryNgayCell(val: unknown): boolean {
  if (val == null || val === '') return false;
  const s = String(val).trim().toLowerCase();
  return s === 'all' || s === 'tất cả' || s === 'tat ca';
}

function parseNgayCell(val: unknown): string | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return excelSerialToYyyyMmDd(val);
  const s = String(val).trim().split(/\s|T/)[0];
  if (isSummaryNgayCell(s)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function parseDateTimeCell(val: unknown): string | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return excelSerialToIsoDateTime(val);
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (m) {
    const d = new Date(
      Number(m[3]),
      Number(m[2]) - 1,
      Number(m[1]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6])
    );
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function cellStr(val: unknown): string {
  if (val == null || val === '') return '';
  if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  return String(val).trim();
}

/** Số VN: 1.234,56 hoặc 1234 */
function parseMoney(val: unknown): number | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  let t = cellStr(val).replace(/\s/g, '');
  if (!t) return null;
  if (t.includes(',') && t.includes('.')) {
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (t.includes(',')) {
    const parts = t.split(',');
    if (parts.length === 2 && parts[1].length <= 2) t = parts[0].replace(/\./g, '') + '.' + parts[1];
    else t = t.replace(/,/g, '');
  } else {
    t = t.replace(/\./g, '');
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function parseMetric(val: unknown): number | null {
  const n = parseMoney(val);
  return n;
}

/** Chuẩn hoá tiêu đề: lower, đ→d, bỏ dấu — để khớp «Số đơn», «Sản phẩm»… */
function normalizeHeaderVi(s: string): string {
  return cellStr(s)
    .toLowerCase()
    .replace(/\u0110/g, 'd')
    .replace(/\u0111/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type QcField =
  | 'ten_tai_khoan'
  | 'ten_quang_cao'
  | 'ngay'
  | 'don_vi_tien_te'
  | 'so_tien_chi_tieu_vnd'
  | 'chi_phi_mua'
  | 'cpm'
  | 'ctr_tat_ca'
  | 'luot_tro_chuyen_tin_nhan'
  | 'cpc'
  | 'bao_cao_tu'
  | 'bao_cao_den';

/** Gán cột theo tên header: rule trước ưu tiên (tránh nhầm «Ngày» vs «Bắt đầu báo cáo»). */
const QC_HEADER_RULES: { field: QcField; match: (n: string) => boolean }[] = [
  {
    field: 'bao_cao_tu',
    match: (n) =>
      (n.includes('bat dau') && n.includes('bao cao')) ||
      n.includes('reporting period start') ||
      (n.includes('period') && n.includes('start') && !n.includes('end')) ||
      /^start(\s+date)?$/i.test(n.trim()),
  },
  {
    field: 'bao_cao_den',
    match: (n) =>
      (n.includes('ket thuc') && n.includes('bao cao')) ||
      n.includes('reporting period end') ||
      (n.includes('period') && n.includes('end')) ||
      /^end(\s+date)?$/i.test(n.trim()),
  },
  { field: 'ten_tai_khoan', match: (n) => n.includes('ten tai khoan') || n.includes('account name') },
  { field: 'ten_quang_cao', match: (n) => n.includes('ten quang cao') || n.includes('ad name') || n.includes('tieu de quang cao') },
  { field: 'don_vi_tien_te', match: (n) => n.includes('don vi tien') || n === 'currency' || n.includes('currency') },
  {
    field: 'so_tien_chi_tieu_vnd',
    match: (n) =>
      n.includes('so tien da chi tieu') ||
      n.includes('amount spent') ||
      (n.includes('chi tieu') && n.includes('so tien')) ||
      (n.includes('spend') && !n.includes('cpc') && !n.includes('cpm')),
  },
  {
    field: 'chi_phi_mua',
    match: (n) =>
      n.includes('chi phi tren moi luot ket qua') ||
      n.includes('cost per result') ||
      (n.includes('cost per') && n.includes('result')),
  },
  { field: 'cpm', match: (n) => /\bcpm\b/.test(n) },
  { field: 'ctr_tat_ca', match: (n) => /\bctr\b/.test(n) },
  {
    field: 'luot_tro_chuyen_tin_nhan',
    match: (n) =>
      n.includes('tro chuyen qua tin nhan') ||
      n.includes('messaging conversations') ||
      n.includes('cuoc tro chuyen') ||
      (n.includes('conversation') && n.includes('start')),
  },
  { field: 'cpc', match: (n) => /\bcpc\b/.test(n) },
  {
    field: 'ngay',
    match: (n) =>
      n === 'ngay' ||
      n === 'day' ||
      (n.startsWith('ngay ') && !n.includes('bat dau') && !n.includes('ket thuc')) ||
      /^day$/i.test(n),
  },
];

function buildQcColumnMap(headerRow: unknown[]): Partial<Record<QcField, number>> {
  const map: Partial<Record<QcField, number>> = {};
  const used = new Set<number>();
  for (const { field, match } of QC_HEADER_RULES) {
    if (map[field] != null) continue;
    for (let c = 0; c < headerRow.length; c++) {
      if (used.has(c)) continue;
      const raw = cellStr(headerRow[c]);
      if (!raw) continue;
      const n = normalizeHeaderVi(raw);
      if (!n) continue;
      if (match(n)) {
        map[field] = c;
        used.add(c);
        break;
      }
    }
  }
  return map;
}

function findQcHeaderRowIndex(aoa: unknown[][]): number {
  const maxScan = Math.min(12, aoa.length);
  let bestIdx = 0;
  let bestScore = -1;
  for (let hi = 0; hi < maxScan; hi++) {
    const row = aoa[hi] as unknown[];
    if (!row?.length) continue;
    const m = buildQcColumnMap(row);
    let score = 0;
    if (m.ten_tai_khoan != null) score += 2;
    if (m.ten_quang_cao != null) score += 2;
    if (m.ngay != null) score += 2;
    if (m.so_tien_chi_tieu_vnd != null) score += 2;
    if (m.don_vi_tien_te != null) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = hi;
    }
  }
  return bestIdx;
}

function cellAt(r: unknown[], col: number | undefined): unknown {
  if (col == null || col < 0) return undefined;
  return r[col];
}

export function downloadQcExcelTemplate(): void {
  const hdr = Array.from(QC_EXCEL_HEADERS);
  const aoa = [
    hdr,
    ...EXAMPLE_ROWS.map((row) => {
      const o = [...row];
      while (o.length < hdr.length) o.push('');
      return o;
    }),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = QC_EXCEL_HEADERS.map((_, i) => ({ wch: i === 1 ? 36 : i === 5 ? 26 : 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Du lieu QC');
  const helpAoa = [
    ['Hướng dẫn mẫu QC dự án'],
    [''],
    ['• Mẫu chỉ còn các cột cần cho QC / đẩy detail_reports.'],
    ['• Export Meta đầy đủ (CPM, CTR, CPC, khoảng báo cáo…) vẫn import được — app đọc theo tên cột.'],
    ['• «Tên quảng cáo»: thêm [mã_ma_ns] khi đẩy detail_reports (vd: … [VD-QC-01]).'],
    ['• Ngày: yyyy-mm-dd, hoặc All / Tất cả cho dòng tổng hợp.'],
    ['• Mẫu không gồm cột trống Meta / cột legacy detail_reports (page_report, branch, kpis, …).'],
  ];
  const wsHelp = XLSX.utils.aoa_to_sheet(helpAoa);
  wsHelp['!cols'] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsHelp, 'Huong dan');
  XLSX.writeFile(wb, QC_EXCEL_TEMPLATE_FILENAME);
}

function rowHasData(r: unknown[]): boolean {
  if (!r?.length) return false;
  return r.some((c) => c !== '' && c != null && String(c).trim() !== '');
}

export async function parseQcExcelFile(
  file: File
): Promise<{ rows: Omit<QcExcelDbRow, 'du_an_id' | 'source_file'>[]; errors: { row: number; msg: string }[] }> {
  const errors: { row: number; msg: string }[] = [];
  const rows: Omit<QcExcelDbRow, 'du_an_id' | 'source_file'>[] = [];

  let buf: ArrayBuffer;
  try {
    buf = await file.arrayBuffer();
  } catch {
    return { rows: [], errors: [{ row: 0, msg: 'Không đọc được file.' }] };
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'array', cellDates: false });
  } catch {
    return { rows: [], errors: [{ row: 0, msg: 'File không phải Excel hợp lệ.' }] };
  }

  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { rows: [], errors: [{ row: 0, msg: 'Không có sheet.' }] };

  const aoa = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(ws, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];

  if (aoa.length < 2) {
    errors.push({ row: 1, msg: 'File cần ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu.' });
    return { rows, errors };
  }

  const headerIdx = findQcHeaderRowIndex(aoa);
  const headerRow = aoa[headerIdx] as unknown[];
  const col = buildQcColumnMap(headerRow);

  if (col.ngay == null) {
    errors.push({
      row: headerIdx + 1,
      msg:
        'Không tìm thấy cột ngày theo tên tiêu đề (ví dụ «Ngày», «Day»). Kiểm tra dòng tiêu đề hoặc export Meta/Ads.',
    });
    return { rows, errors };
  }

  const dataStart = headerIdx + 1;
  let lastTenTk = '';
  let lastTenQc = '';

  for (let i = dataStart; i < aoa.length; i++) {
    const r = aoa[i] as unknown[];
    const sheetRow = i + 1;
    if (!rowHasData(r)) continue;

    const rawTk = cellStr(cellAt(r, col.ten_tai_khoan));
    const rawQc = cellStr(cellAt(r, col.ten_quang_cao));
    if (rawTk) lastTenTk = rawTk;
    if (rawQc) lastTenQc = rawQc;
    const tenTk = lastTenTk;
    const tenQc = lastTenQc;

    const ngayRaw = cellAt(r, col.ngay);
    const ngayTxt = cellStr(ngayRaw);
    const summaryNgay = isSummaryNgayCell(ngayRaw) || ngayTxt === '';
    const ngay = summaryNgay ? null : parseNgayCell(ngayRaw);

    const donVi = cellStr(cellAt(r, col.don_vi_tien_te));
    const spend = parseMoney(cellAt(r, col.so_tien_chi_tieu_vnd));
    const cpp = parseMetric(cellAt(r, col.chi_phi_mua));
    const cpm = parseMetric(cellAt(r, col.cpm));
    const ctrRaw = cellAt(r, col.ctr_tat_ca);
    const ctr = cellStr(ctrRaw) || null;
    const mess = parseMetric(cellAt(r, col.luot_tro_chuyen_tin_nhan));
    const cpc = parseMetric(cellAt(r, col.cpc));
    const tu = parseDateTimeCell(cellAt(r, col.bao_cao_tu));
    const den = parseDateTimeCell(cellAt(r, col.bao_cao_den));

    const hasMetrics =
      spend != null ||
      cpp != null ||
      cpm != null ||
      (ctr != null && ctr.length > 0) ||
      mess != null ||
      cpc != null;

    if (!tenTk && !tenQc && !hasMetrics) continue;

    if (!summaryNgay && !ngay) {
      if (ngayTxt !== '') {
        errors.push({
          row: sheetRow,
          msg:
            'Cột ngày (theo tên tiêu đề): cần ngày hợp lệ (yyyy-mm-dd, dd/mm/yyyy…) hoặc «All»/«Tất cả» cho dòng tổng hợp.',
        });
        continue;
      }
    }

    rows.push({
      ten_tai_khoan: tenTk || null,
      ten_quang_cao: tenQc || null,
      ngay,
      don_vi_tien_te: donVi || null,
      so_tien_chi_tieu_vnd: spend,
      chi_phi_mua: cpp,
      cpm,
      ctr_tat_ca: ctr,
      luot_tro_chuyen_tin_nhan: mess,
      cpc,
      bao_cao_tu: tu,
      bao_cao_den: den,
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ row: 0, msg: 'Không có dòng dữ liệu hợp lệ.' });
  }

  return { rows, errors };
}
