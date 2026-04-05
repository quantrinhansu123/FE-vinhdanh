import * as XLSX from 'xlsx';

export const QC_EXCEL_TABLE =
  import.meta.env.VITE_SUPABASE_DU_AN_QC_EXCEL_TABLE?.trim() || 'du_an_qc_excel_rows';

export const QC_EXCEL_TEMPLATE_FILENAME = 'mau-du-lieu-qc-du-an.xlsx';

/**
 * Đúng thứ tự cột như export Meta (Ads Manager):
 * A–C tài khoản / quảng cáo / ngày (hoặc «All»), D trống, E tiền tệ, F–J chỉ số.
 * Meta thường chỉ xuất tới J; K–M (CPC, khoảng báo cáo) là tùy chọn nếu có trong file.
 */
export const QC_EXCEL_HEADERS = [
  'Tên tài khoản',
  'Tên quảng cáo',
  'Ngày',
  '',
  'Đơn vị tiền tệ',
  'Số tiền đã chi tiêu',
  'Chi phí trên mỗi lượt kết quả',
  'CPM (Chi phí trên mỗi 1.000 lượt hiển thị)',
  'CTR (Tất cả)',
  'Lượt bắt đầu cuộc trò chuyện qua tin nhắn',
  'CPC (tất cả)',
  'Bắt đầu báo cáo',
  'Kết thúc báo cáo',
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

/** Hai dòng mẫu: dòng «All» + dòng theo ngày (A/B để trống như file Meta gộp nhóm) */
const EXAMPLE_ROWS: (string | number)[][] = [
  ['FBC 7', 'FABICO - 122120954511034419', 'All', '', 'VND', 1707762, 5078.54, 0.4, 0.21, 1],
  ['', '', '2026-03-31', '', 'VND', 120000, 5000, 0.35, 0.18, 0],
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
  ws['!cols'] = QC_EXCEL_HEADERS.map((_, i) => ({ wch: i === 3 ? 4 : i === 1 ? 28 : 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Du lieu QC');
  XLSX.writeFile(wb, QC_EXCEL_TEMPLATE_FILENAME);
}

function rowHasData(r: unknown[], minCols = 3): boolean {
  if (!r?.length) return false;
  const slice = r.slice(0, 13);
  return slice.some((c) => c !== '' && c != null && String(c).trim() !== '');
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

  let dataStart = 1;
  const h0 = cellStr(aoa[0]?.[0]).toLowerCase();
  if (!h0.includes('tài khoản') && !h0.includes('tai khoan')) {
    dataStart = 0;
  }

  let lastTenTk = '';
  let lastTenQc = '';

  for (let i = dataStart; i < aoa.length; i++) {
    const r = aoa[i] as unknown[];
    const sheetRow = i + 1;
    if (!rowHasData(r)) continue;

    const rawTk = cellStr(r[0]);
    const rawQc = cellStr(r[1]);
    if (rawTk) lastTenTk = rawTk;
    if (rawQc) lastTenQc = rawQc;
    const tenTk = lastTenTk;
    const tenQc = lastTenQc;

    const ngayRaw = r[2];
    const ngayTxt = cellStr(ngayRaw);
    const summaryNgay = isSummaryNgayCell(ngayRaw) || ngayTxt === '';
    const ngay = summaryNgay ? null : parseNgayCell(ngayRaw);

    const donVi = cellStr(r[4]);
    const spend = parseMoney(r[5]);
    const cpp = parseMetric(r[6]);
    const cpm = parseMetric(r[7]);
    const ctr = cellStr(r[8]) || null;
    const mess = parseMetric(r[9]);
    const cpc = parseMetric(r[10]);
    const tu = parseDateTimeCell(r[11]);
    const den = parseDateTimeCell(r[12]);

    const hasMetrics =
      spend != null ||
      cpp != null ||
      cpm != null ||
      (ctr != null && ctr.length > 0) ||
      mess != null ||
      cpc != null;

    if (!tenTk && !tenQc && !hasMetrics) continue;

    if (!summaryNgay && !ngay) {
      // Nếu ô ngày có nội dung nhưng không parse được → báo lỗi; nếu rỗng thì coi là tổng hợp (All)
      if (ngayTxt !== '') {
        errors.push({
          row: sheetRow,
          msg:
            'Cột C (Ngày): cần ngày hợp lệ (yyyy-mm-dd, dd/mm/yyyy…) hoặc «All»/«Tất cả» cho dòng tổng hợp.',
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
