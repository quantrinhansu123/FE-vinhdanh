import * as XLSX from 'xlsx';
import { parseIntVi } from './mktDetailReportShared';

export const MKT_EXCEL_TEMPLATE_FILENAME = 'mau-nhap-bao-cao-mkt.xlsx';

/** Dòng 1: tiêu đề. Dữ liệu từ dòng 2. Cột A→L cố định thứ tự như mẫu. */
export const MKT_EXCEL_HEADERS = [
  'Ngày báo cáo (yyyy-mm-dd)',
  'Sản phẩm',
  'Thị trường',
  'Page',
  'TKQC (ma_tkqc)',
  'Mã TK (ad_account)',
  'Chi phí QC',
  'Mess',
  'Tổng data nhận',
  'Doanh số (VND)',
  'Số đơn',
  'Tổng lead',
] as const;

export type MktExcelInsertRow = {
  report_date: string;
  product: string | null;
  market: string | null;
  page: string | null;
  ma_tkqc: string | null;
  ad_account: string | null;
  ad_cost: number;
  mess_comment_count: number;
  tong_data_nhan: number;
  revenue: number;
  order_count: number;
  tong_lead: number;
};

const EXAMPLE_ROW: string[] = [
  '2026-04-01',
  'Ví dụ sản phẩm',
  'Ví dụ thị trường',
  'Fanpage / Page',
  'QC-A01',
  '123456789012345',
  '500000',
  '120',
  '50',
  '10000000',
  '5',
  '30',
];

/** Excel serial (ngày) → yyyy-mm-dd UTC (đủ cho cột ngày không giờ). */
function excelSerialToYyyyMmDd(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const whole = Math.floor(serial);
  if (whole < 20000 || whole > 80000) return null;
  const utcMs = (whole - 25569) * 86400 * 1000;
  const u = new Date(utcMs);
  const y = u.getUTCFullYear();
  const m = String(u.getUTCMonth() + 1).padStart(2, '0');
  const d = String(u.getUTCDate()).padStart(2, '0');
  if (y < 2000 || y > 2100) return null;
  return `${y}-${m}-${d}`;
}

function parseDateCell(val: unknown): { ok: true; iso: string } | { ok: false } {
  if (val == null || val === '') return { ok: false };
  if (typeof val === 'number' && Number.isFinite(val)) {
    const iso = excelSerialToYyyyMmDd(val);
    return iso ? { ok: true, iso } : { ok: false };
  }
  const s = String(val).trim().split(/\s|T/)[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: true, iso: s };
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    return { ok: true, iso: `${m[3]}-${mm}-${dd}` };
  }
  return { ok: false };
}

function cellStr(val: unknown): string {
  if (val == null || val === '') return '';
  if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  return String(val).trim();
}

function cellNum(val: unknown): number {
  if (val == null || val === '') return 0;
  if (typeof val === 'number' && Number.isFinite(val)) return Math.max(0, Math.floor(val));
  return parseIntVi(cellStr(val));
}

export function downloadMktReportExcelTemplate(): void {
  const aoa = [Array.from(MKT_EXCEL_HEADERS), EXAMPLE_ROW];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = MKT_EXCEL_HEADERS.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bao cao');
  XLSX.writeFile(wb, MKT_EXCEL_TEMPLATE_FILENAME);
}

export async function parseMktReportExcelFile(file: File): Promise<{
  rows: MktExcelInsertRow[];
  errors: { row: number; msg: string }[];
}> {
  const errors: { row: number; msg: string }[] = [];
  const rows: MktExcelInsertRow[] = [];

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
    return { rows: [], errors: [{ row: 0, msg: 'File không phải Excel hợp lệ (.xlsx / .xls).' }] };
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ row: 0, msg: 'File không có sheet.' }] };

  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(ws, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];

  if (aoa.length < 2) {
    errors.push({ row: 1, msg: 'Thiếu dữ liệu: cần dòng tiêu đề và ít nhất một dòng từ dòng 2.' });
    return { rows, errors };
  }

  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i] as unknown[];
    const sheetRow = i + 1;
    if (!r || r.length === 0) continue;
    const allEmpty = r.every((c) => c === '' || c == null || String(c).trim() === '');
    if (allEmpty) continue;

    const dateParsed = parseDateCell(r[0]);
    if (!dateParsed.ok) {
      const hint = cellStr(r[0]);
      if (hint === '' && r.slice(1).every((c) => !cellStr(c))) continue;
      errors.push({
        row: sheetRow,
        msg: `Cột A — ngày không hợp lệ${hint ? `: "${hint}"` : ''} (dùng yyyy-mm-dd hoặc định dạng ngày Excel).`,
      });
      continue;
    }

    rows.push({
      report_date: dateParsed.iso,
      product: cellStr(r[1]) || null,
      market: cellStr(r[2]) || null,
      page: cellStr(r[3]) || null,
      ma_tkqc: cellStr(r[4]) || null,
      ad_account: cellStr(r[5]) || null,
      ad_cost: cellNum(r[6]),
      mess_comment_count: cellNum(r[7]),
      tong_data_nhan: cellNum(r[8]),
      revenue: cellNum(r[9]),
      order_count: cellNum(r[10]),
      tong_lead: cellNum(r[11]),
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ row: 0, msg: 'Không có dòng dữ liệu hợp lệ sau dòng tiêu đề.' });
  }

  return { rows, errors };
}
