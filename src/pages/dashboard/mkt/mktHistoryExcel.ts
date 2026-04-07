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
  'Lượt bắt đầu cuộc trò chuyện qua tin nhắn',
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

/** Excel serial (hệ 1900/1904) → yyyy-mm-dd qua SheetJS — khớp Excel thật. */
function excelSerialToYyyyMmDd(serial: number, date1904: boolean): string | null {
  if (!Number.isFinite(serial)) return null;
  const parsed = XLSX.SSF.parse_date_code(serial, date1904 ? { date1904: true } : undefined) as {
    y: number;
    m: number;
    d: number;
  } | null;
  if (!parsed) return null;
  const y = parsed.y;
  if (y < 1980 || y > 2100) return null;
  const m = String(parsed.m).padStart(2, '0');
  const d = String(parsed.d).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isValidYmd(y: number, mo: number, day: number): boolean {
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return false;
  const dt = new Date(y, mo - 1, day);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === day;
}

/** Bỏ BOM / ký tự ẩn / khoảng trắng quanh dấu / trong ngày Excel. */
function sanitizeDateInputString(raw: string): string {
  let s = raw.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  s = s.replace(/\s*([/.-])\s*/g, '$1');
  return s;
}

function parseDateCell(
  val: unknown,
  date1904: boolean
): { ok: true; iso: string } | { ok: false } {
  if (val == null || val === '') return { ok: false };
  if (typeof val === 'boolean') return { ok: false };

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    if (y >= 1980 && y <= 2100) return { ok: true, iso: `${y}-${m}-${d}` };
    return { ok: false };
  }

  if (typeof val === 'number' && Number.isFinite(val)) {
    const iso = excelSerialToYyyyMmDd(val, date1904);
    return iso ? { ok: true, iso } : { ok: false };
  }

  let s = sanitizeDateInputString(String(val));
  if (s.startsWith("'")) s = s.slice(1).trim();

  // Serial dạng text: "45738" hoặc "4,5738E+04"
  if (/^\d+[.,]?\d*[eE][+-]?\d+$/.test(s)) {
    const iso = excelSerialToYyyyMmDd(Number(s.replace(',', '.')), date1904);
    if (iso) return { ok: true, iso };
  }

  const isoFlex = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[\sT].*)?$/);
  if (isoFlex) {
    const y = Number(isoFlex[1]);
    const mo = Number(isoFlex[2]);
    const da = Number(isoFlex[3]);
    if (isValidYmd(y, mo, da)) {
      return { ok: true, iso: `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}` };
    }
  }

  s = s.split(/\s|T/, 1)[0] || s;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, da] = s.split('-').map(Number);
    return isValidYmd(y, mo, da) ? { ok: true, iso: s } : { ok: false };
  }

  let m = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const da = Number(m[3]);
    if (isValidYmd(y, mo, da)) {
      return { ok: true, iso: `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}` };
    }
  }

  // dd/mm/yyyy (VN); nếu phần giữa > 12 → mm/dd/yyyy (file Excel locale US)
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);
    let mo: number;
    let da: number;
    if (b > 12) {
      mo = a;
      da = b;
    } else if (a > 12) {
      da = a;
      mo = b;
    } else {
      da = a;
      mo = b;
    }
    if (isValidYmd(y, mo, da)) {
      return { ok: true, iso: `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}` };
    }
  }

  // Chuỗi chỉ là số serial Excel (ô định dạng Text hoặc copy từ số)
  const numStr = s.replace(',', '.');
  if (/^\d+(\.\d+)?$/.test(numStr)) {
    const iso = excelSerialToYyyyMmDd(Number(numStr), date1904);
    if (iso) return { ok: true, iso };
  }

  // Tháng dạng chữ (locale Excel / CSV): "3-Apr-2026", "Apr 3, 2026"
  const parsedMs = Date.parse(s);
  if (!Number.isNaN(parsedMs)) {
    const d = new Date(parsedMs);
    const y = d.getFullYear();
    if (y >= 1980 && y <= 2100) {
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return { ok: true, iso: `${y}-${mo}-${day}` };
    }
  }

  return { ok: false };
}

/** Đọc ngày từ ô sheet: thử raw (v) rồi chuỗi hiển thị (w) — khớp Excel locale. */
function parseDateFromSheetCell(
  ws: XLSX.WorkSheet,
  row0: number,
  col0: number,
  date1904: boolean
): { ok: true; iso: string } | { ok: false } {
  const addr = XLSX.utils.encode_cell({ r: row0, c: col0 });
  const cell = ws[addr] as XLSX.CellObject | undefined;
  if (!cell) return { ok: false };

  const fromV = parseDateCell(cell.v, date1904);
  if (fromV.ok) return fromV;

  if (cell.w != null && String(cell.w).trim() !== '') {
    return parseDateCell(cell.w, date1904);
  }

  return { ok: false };
}

/** Tìm ngày ở cột A, B hoặc C (file có cột STT / cột trống). */
function findDateInRow(
  ws: XLSX.WorkSheet,
  row0: number,
  rowArr: unknown[],
  date1904: boolean
): { ok: true; iso: string; colShift: number } | { ok: false } {
  for (let c = 0; c < 3; c++) {
    const fromSheet = parseDateFromSheetCell(ws, row0, c, date1904);
    if (fromSheet.ok) return { ok: true, iso: fromSheet.iso, colShift: c };
    const fromArr = parseDateCell(rowArr[c], date1904);
    if (fromArr.ok) return { ok: true, iso: fromArr.iso, colShift: c };
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

/** Chỉ true khi đúng mẫu CRM — tránh nhầm file Ads có chữ "ngày" ở tiêu đề. */
function looksLikeCrmMktHeader(headerRow: unknown[] | undefined): boolean {
  if (!headerRow || headerRow.length === 0) return false;
  const a = cellStr(headerRow[0]).toLowerCase();
  const b = cellStr(headerRow[1]).toLowerCase();
  if (a.includes('yyyy-mm-dd') || a.includes('yyyy/mm/dd')) return true;
  if (a.includes('report_date')) return true;
  if (a.includes('ngày') && a.includes('báo cáo')) return true;
  if (a.includes('ngày') && (b.includes('sản phẩm') || b.includes('san pham'))) return true;
  return false;
}

/**
 * Export phân cấp kiểu Meta/Ads: cột A = nhóm (FBC…), cột B = tài khoản "Tên - id" | All | yyyy-mm-dd.
 * Chi phí: cột số sau "VND" (thường cột D/E).
 */
function extractAdsExportAccountKey(label: string): string {
  const t = label.trim();
  const m = t.match(/-\s*(\d{8,})\s*$/);
  if (m) return m[1];
  const m2 = t.match(/(\d{10,})/);
  return m2 ? m2[1] : t;
}

function firstMoneyMetricsFromExportRow(r: unknown[]): { ad_cost: number; revenue: number } {
  const amounts: number[] = [];
  for (let c = 0; c < Math.min(r.length, 22); c++) {
    const raw = r[c];
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0 && raw < 100 && raw % 1 !== 0) {
      continue;
    }
    const s = cellStr(raw).toLowerCase();
    if (s === 'vnd' || s === 'usd' || s === 'all' || s === '') continue;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) continue;
    const n = cellNum(raw);
    if (n >= 1) amounts.push(n);
  }
  const uniq = [...new Set(amounts)].sort((a, b) => b - a);
  const ad_cost = uniq[0] ?? 0;
  const revenue = uniq[1] ?? 0;
  return { ad_cost, revenue };
}

/**
 * Ngày "chắc chắn" cho export Ads — tránh nhầm chi phí (số ~ vài nghìn) với serial Excel.
 */
function parseExplicitDateForAdsExport(
  ws: XLSX.WorkSheet,
  row0: number,
  col0: number,
  date1904: boolean
): { ok: true; iso: string } | { ok: false } {
  const addr = XLSX.utils.encode_cell({ r: row0, c: col0 });
  const cell = ws[addr] as XLSX.CellObject | undefined;

  if (cell?.v instanceof Date && !Number.isNaN(cell.v.getTime())) {
    return parseDateCell(cell.v, date1904);
  }

  const w = cell?.w != null ? String(cell.w).trim() : '';
  if (/\d{4}-\d{2}-\d{2}/.test(w)) {
    const p = parseDateCell(w, date1904);
    if (p.ok) return p;
  }

  if (cell && typeof cell.v === 'number' && Number.isFinite(cell.v)) {
    if (w && /(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/.test(w)) {
      return parseDateCell(cell.v, date1904);
    }
    return { ok: false };
  }

  if (cell?.v != null && cell.v !== '') {
    const vs = cellStr(cell.v);
    if (/\d{4}-\d{2}-\d{2}/.test(vs)) {
      return parseDateCell(cell.v, date1904);
    }
  }

  return { ok: false };
}

function looksLikeAdsAccountLabel(text: string): boolean {
  const t = text.trim();
  if (!t || /^all$/i.test(t)) return false;
  if (/-\s*\d{8,}/.test(t)) return true;
  if (/^\d{14,}$/.test(t.replace(/\s/g, ''))) return true;
  if (/act_\d+/i.test(t)) return true;
  return false;
}

/** Chuẩn hoá tiêu đề tiếng Việt để tìm cột (bỏ dấu). */
function normalizeHeaderVi(s: string): string {
  return cellStr(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tìm chỉ số cột "Bắt đầu báo cáo" / "Kết thúc báo cáo" (hoặc tương đương Meta).
 * Quét vài dòng đầu vì đôi khi có dòng title phía trên.
 */
function findAdsReportPeriodColumns(aoa: unknown[][]): { startCol: number; endCol: number } | null {
  const maxHeaderRows = Math.min(8, aoa.length);
  for (let hi = 0; hi < maxHeaderRows; hi++) {
    const row = aoa[hi] as unknown[];
    if (!row?.length) continue;
    let startCol = -1;
    let endCol = -1;
    for (let c = 0; c < Math.min(row.length, 48); c++) {
      const n = normalizeHeaderVi(cellStr(row[c]));
      if (!n) continue;
      const enStart = /reporting\s+period\s+start|^start\s+date$/i.test(n) || n.includes('period start');
      const enEnd = /reporting\s+period\s+end|^end\s+date$/i.test(n) || n.includes('period end');
      const viBaoCao = n.includes('bao cao') || n.includes('baocao');
      if (viBaoCao && n.includes('bat dau')) startCol = c;
      if (viBaoCao && n.includes('ket thuc')) endCol = c;
      if (enStart) startCol = c;
      if (enEnd) endCol = c;
    }
    if (startCol >= 0 && endCol >= 0 && startCol !== endCol) {
      return { startCol, endCol };
    }
  }
  return null;
}

/** Cột "Tên quảng cáo" (Meta) → map vào `page` trong báo cáo. */
function findAdsAdNameColumn(aoa: unknown[][]): number | null {
  const maxHeaderRows = Math.min(8, aoa.length);
  for (let hi = 0; hi < maxHeaderRows; hi++) {
    const row = aoa[hi] as unknown[];
    if (!row?.length) continue;
    for (let c = 0; c < Math.min(row.length, 48); c++) {
      const n = normalizeHeaderVi(cellStr(row[c]));
      if (!n) continue;
      if (n.includes('ten quang cao') || n.includes('tenquangcao')) return c;
      if (n === 'ad name' || n.includes('ad name')) return c;
      if (n.includes('tieu de quang cao')) return c;
    }
  }
  return null;
}

function parseCellToIsoOptional(
  ws: XLSX.WorkSheet,
  row0: number,
  col0: number,
  raw: unknown,
  date1904: boolean
): string | null {
  const d = parseExplicitDateForAdsExport(ws, row0, col0, date1904);
  if (d.ok) return d.iso;
  if (typeof raw === 'string' && /\d{4}-\d{2}-\d{2}/.test(raw.trim())) {
    const p = parseDateCell(raw, date1904);
    return p.ok ? p.iso : null;
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const p = parseDateCell(raw, date1904);
    return p.ok ? p.iso : null;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const p = parseDateCell(raw, date1904);
    return p.ok ? p.iso : null;
  }
  return null;
}

/**
 * Export Ads / Meta: nhóm thường ở cột A; tài khoản "Tên - id" có thể ở B/C;
 * dòng ngàyyyy-mm-dd có thể ở B, C hoặc D tùy file (không nhầm với số chi phí).
 */
function parseAdsAccountHierarchyExport(
  ws: XLSX.WorkSheet,
  aoa: unknown[][],
  date1904: boolean
): { rows: MktExcelInsertRow[]; errors: { row: number; msg: string }[] } {
  const rows: MktExcelInsertRow[] = [];
  const errors: { row: number; msg: string }[] = [];

  const periodCols = findAdsReportPeriodColumns(aoa);
  const adNameCol = findAdsAdNameColumn(aoa);

  let groupName = '';
  let accountLabel: string | null = null;
  let accountKey: string | null = null;

  const maxScanCol = 8;

  for (let i = 1; i < aoa.length; i++) {
    const r = (aoa[i] as unknown[]) || [];
    if (!r.length) continue;
    if (r.every((c) => c === '' || c == null || String(c).trim() === '')) continue;

    const c0 = cellStr(r[0]);
    if (c0 && !/^\d{4}-\d{2}-\d{2}$/.test(c0)) {
      groupName = c0;
    }

    let dateIso: string | null = null;
    for (let c = 0; c < maxScanCol; c++) {
      const d = parseExplicitDateForAdsExport(ws, i, c, date1904);
      if (d.ok) {
        dateIso = d.iso;
        break;
      }
      const raw = r[c];
      if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}(?:\s|T|$)/.test(raw.trim())) {
        const arrD = parseDateCell(raw, date1904);
        if (arrD.ok) {
          dateIso = arrD.iso;
          break;
        }
      }
    }

    if (dateIso) {
      if (periodCols) {
        const rawS = r[periodCols.startCol];
        const rawE = r[periodCols.endCol];
        const isoStart = parseCellToIsoOptional(ws, i, periodCols.startCol, rawS, date1904);
        const isoEnd = parseCellToIsoOptional(ws, i, periodCols.endCol, rawE, date1904);
        if (!isoStart || !isoEnd || isoStart !== isoEnd) {
          continue;
        }
      }

      const { ad_cost, revenue } = firstMoneyMetricsFromExportRow(r);
      const ad_account = (accountKey || accountLabel || groupName || '').trim() || null;
      const pageFromAdName =
        adNameCol != null ? cellStr(r[adNameCol]).trim() || null : null;
      rows.push({
        report_date: dateIso,
        product: groupName || 'Ads export',
        market: 'VND',
        page: pageFromAdName || accountLabel,
        ma_tkqc: null,
        ad_account,
        ad_cost,
        mess_comment_count: 0,
        tong_data_nhan: 0,
        revenue,
        order_count: 0,
        tong_lead: 0,
      });
      continue;
    }

    for (let c = 0; c < maxScanCol; c++) {
      const txt = cellStr(r[c]);
      if (looksLikeAdsAccountLabel(txt)) {
        accountLabel = txt;
        accountKey = extractAdsExportAccountKey(txt);
        break;
      }
    }
  }

  return { rows, errors };
}

export function downloadMktReportExcelTemplate(): void {
  const aoa = [Array.from(MKT_EXCEL_HEADERS), EXAMPLE_ROW];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = MKT_EXCEL_HEADERS.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bao cao');
  XLSX.writeFile(wb, MKT_EXCEL_TEMPLATE_FILENAME);
}

function sheetToAoa(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(ws, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];
}

function parseCrmMktSheet(
  ws: XLSX.WorkSheet,
  aoa: unknown[][],
  date1904: boolean
): { rows: MktExcelInsertRow[]; errors: { row: number; msg: string }[] } {
  const errors: { row: number; msg: string }[] = [];
  const rows: MktExcelInsertRow[] = [];

  for (let i = 1; i < aoa.length; i++) {
    const r = (aoa[i] as unknown[]) || [];
    const sheetRow = i + 1;
    if (!r || r.length === 0) continue;
    const allEmpty = r.every((c) => c === '' || c == null || String(c).trim() === '');
    if (allEmpty) continue;

    const dateFound = findDateInRow(ws, i, r, date1904);
    if (!dateFound.ok) {
      const addrA = XLSX.utils.encode_cell({ r: i, c: 0 });
      const cellA = ws[addrA] as XLSX.CellObject | undefined;
      const hint =
        cellA?.w?.trim() ||
        cellStr(cellA?.v) ||
        cellStr(r[0]) ||
        cellStr(r[1]) ||
        '';
      if (hint === '' && r.slice(1).every((c) => !cellStr(c))) continue;
      errors.push({
        row: sheetRow,
        msg: `Cột ngày (A–C) — không đọc được${hint ? `: "${hint}"` : ''} (yyyy-mm-dd, dd/mm/yyyy, yyyy/mm/dd, ô Định dạng Ngày, hoặc serial Excel).`,
      });
      continue;
    }

    const start = 1 + dateFound.colShift;
    rows.push({
      report_date: dateFound.iso,
      product: cellStr(r[start]) || null,
      market: cellStr(r[start + 1]) || null,
      page: cellStr(r[start + 2]) || null,
      ma_tkqc: cellStr(r[start + 3]) || null,
      ad_account: cellStr(r[start + 4]) || null,
      ad_cost: cellNum(r[start + 5]),
      // Cột H: "Lượt bắt đầu cuộc trò chuyện qua tin nhắn"
      mess_comment_count: cellNum(r[start + 6]),
      tong_data_nhan: cellNum(r[start + 7]),
      revenue: cellNum(r[start + 8]),
      order_count: cellNum(r[start + 9]),
      tong_lead: cellNum(r[start + 10]),
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ row: 0, msg: 'Không có dòng dữ liệu hợp lệ sau dòng tiêu đề.' });
  }

  return { rows, errors };
}

export async function parseMktReportExcelFile(file: File): Promise<{
  rows: MktExcelInsertRow[];
  errors: { row: number; msg: string }[];
}> {
  let buf: ArrayBuffer;
  try {
    buf = await file.arrayBuffer();
  } catch {
    return { rows: [], errors: [{ row: 0, msg: 'Không đọc được file.' }] };
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'array', cellDates: true });
  } catch {
    return { rows: [], errors: [{ row: 0, msg: 'File không phải Excel hợp lệ (.xlsx / .xls).' }] };
  }

  const date1904 = !!wb.Workbook?.WBProps?.date1904;
  const names = wb.SheetNames;
  if (!names.length) return { rows: [], errors: [{ row: 0, msg: 'File không có sheet.' }] };

  let bestAds: MktExcelInsertRow[] = [];

  for (const sheetName of names) {
    const ws = wb.Sheets[sheetName];
    const aoa = sheetToAoa(ws);
    if (!aoa || aoa.length < 2) continue;

    if (looksLikeCrmMktHeader(aoa[0] as unknown[])) {
      return parseCrmMktSheet(ws, aoa, date1904);
    }

    const ads = parseAdsAccountHierarchyExport(ws, aoa, date1904);
    if (ads.rows.length > bestAds.length) {
      bestAds = ads.rows;
    }
  }

  if (bestAds.length > 0) {
    return { rows: bestAds, errors: [] };
  }

  const ws0 = wb.Sheets[names[0]];
  const aoa0 = sheetToAoa(ws0);
  if (aoa0.length < 2) {
    return {
      rows: [],
      errors: [{ row: 1, msg: 'Thiếu dữ liệu: cần dòng tiêu đề và ít nhất một dòng từ dòng 2.' }],
    };
  }

  return parseCrmMktSheet(ws0, aoa0, date1904);
}
