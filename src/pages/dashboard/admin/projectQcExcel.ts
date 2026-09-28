import * as XLSX from 'xlsx';

export const QC_EXCEL_TABLE =
  import.meta.env.VITE_SUPABASE_DU_AN_QC_EXCEL_TABLE?.trim() || 'du_an_qc_excel_rows';

export const MKT_DAILY_DETAILS_TABLE = 'mkt_daily_details';

export const QC_EXCEL_TEMPLATE_FILENAME = 'mau-du-lieu-qc-ma-nv.xlsx';

/** QC template matching the Meta export, with the employee code included. */
export const QC_EXCEL_HEADERS = [
  'Ng\u00e0y',
  'M\u00e3 NV',
  'T\u00ean chi\u1ebfn d\u1ecbch',
  'S\u1ed1 ti\u1ec1n \u0111\u00e3 chi ti\u00eau (VND)',
  'S\u1ed1 tr\u00f2 chuy\u1ec7n qua tin nh\u1eafn',
] as const;

export type QcExcelDbRow = {
  ma_nv: string | null;
  ten_chien_dich: string | null;
  ngay: string | null;
  so_tien_da_chi_tieu_vnd: number | null;
  so_tro_chuyen_tin_nhan: number | null;
  source_file: string | null;
};

const EXAMPLE_ROWS: (string | number)[][] = [
  ['2026-09-27', 'VD-QC-01', 'FABICO - 122120954511034419 [VD-QC-01]', 120000, 1],
];

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function isSummaryDate(value: unknown): boolean {
  const s = String(value ?? '').trim().toLowerCase();
  return s === 'all' || s === 'tat ca';
}

function isSummaryCampaign(value: unknown): boolean {
  const s = normalizeHeader(value);
  return s === 'all' || s === 'total' || s === 'grand total' || s === 'tong (all)' || s === 'tong all';
}

function parseDate(value: unknown): string | null {
  if (value == null || value === '' || isSummaryDate(value)) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(Math.floor((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const text = String(value).trim().split(/\s|T/)[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function parseNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let text = String(value).trim().replace(/\s/g, '');
  if (!text) return null;
  if (text.includes(',') && text.includes('.')) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (text.includes(',')) {
    text = text.replace(/,/g, '');
  } else if ((text.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(text)) {
    text = text.replace(/\./g, '');
  }
  const result = Number(text);
  return Number.isFinite(result) ? result : null;
}

function findColumns(header: unknown[]) {
  const normalized = header.map(normalizeHeader);
  const find = (match: (header: string) => boolean) => normalized.findIndex(match);
  return {
    ngay: find((h) => h === 'ngay' || h === 'date' || h === 'day'),
    ma_nv: find((h) => h === 'ma nv' || h === 'ma ns' || h === 'employee code' || h === 'staff code'),
    ten_chien_dich: find((h) =>
      h.includes('ten chien dich') || h.includes('campaign name') || h === 'campaign' ||
      h.includes('ten quang cao') || h.includes('ad name')
    ),
    so_tien_da_chi_tieu_vnd: find((h) =>
      (h.includes('so tien') && h.includes('chi tieu')) || h.includes('amount spent') || h === 'spend'
    ),
    so_tro_chuyen_tin_nhan: find((h) =>
      h.includes('tro chuyen qua tin nhan') || h.includes('messaging conversations') ||
      h.includes('cuoc tro chuyen') || h.includes('conversation started')
    ),
  };
}

function findHeaderRow(aoa: unknown[][]): { index: number; columns: ReturnType<typeof findColumns> } | null {
  for (let index = 0; index < Math.min(12, aoa.length); index++) {
    const columns = findColumns(aoa[index] || []);
    if (columns.ngay >= 0 && columns.ten_chien_dich >= 0 &&
        (columns.so_tien_da_chi_tieu_vnd >= 0 || columns.so_tro_chuyen_tin_nhan >= 0)) {
      return { index, columns };
    }
  }
  return null;
}

export function downloadQcExcelTemplate(): void {
  const aoa = [
    ['MAP - Marketing Analytic Platform'],
    ['QC Meta - Daily Marketing Detail'],
    [],
    Array.from(QC_EXCEL_HEADERS),
    ...EXAMPLE_ROWS,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: QC_EXCEL_HEADERS.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: QC_EXCEL_HEADERS.length - 1 } },
  ];
  ws['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 44 }, { wch: 28 }, { wch: 32 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Du lieu QC');
  const help = [
    ['MAP - Marketing Analytic Platform'],
    ['H\u01b0\u1edbng d\u1eabn m\u1eabu QC Meta'],
    [''],
    ['M\u1eabu g\u1ed3m 5 c\u1ed9t: Ng\u00e0y, M\u00e3 NV, T\u00ean chi\u1ebfn d\u1ecbch, chi ti\u00eau v\u00e0 s\u1ed1 tr\u00f2 chuy\u1ec7n.'],
    ['Ch\u1ec9 nh\u1eadp c\u00e1c d\u00f2ng chi ti\u1ebft; b\u1ecf d\u00f2ng t\u1ed5ng All / Total.'],
    ['Ng\u00e0y nh\u1eadn d\u1ea1ng yyyy-mm-dd ho\u1eb7c dd/mm/yyyy.'],
    ['M\u00e3 NV c\u00f3 th\u1ec3 \u0111i\u1ec1n ri\u00eang ho\u1eb7c t\u1ef1 l\u1ea5y t\u1eeb ngo\u1eb7c vu\u00f4ng trong t\u00ean chi\u1ebfn d\u1ecbch, v\u00ed d\u1ee5 [VD-QC-01].'],
    ['C\u00e1c c\u1ed9t chi ti\u00eau v\u00e0 tr\u00f2 chuy\u1ec7n nh\u1eadn s\u1ed1.'],
  ];
  const helpWs = XLSX.utils.aoa_to_sheet(help);
  helpWs['!cols'] = [{ wch: 105 }];
  XLSX.utils.book_append_sheet(wb, helpWs, 'Huong dan');
  XLSX.writeFile(wb, QC_EXCEL_TEMPLATE_FILENAME);
}

export async function parseQcExcelFile(
  file: File
): Promise<{
  rows: Omit<QcExcelDbRow, 'source_file'>[];
  errors: { row: number; msg: string }[];
}> {
  const errors: { row: number; msg: string }[] = [];
  const rows: Omit<QcExcelDbRow, 'source_file'>[] = [];
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  } catch {
    return { rows, errors: [{ row: 0, msg: 'File Excel kh\u00f4ng h\u1ee3p l\u1ec7 ho\u1eb7c kh\u00f4ng \u0111\u1ecdc \u0111\u01b0\u1ee3c.' }] };
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { rows, errors: [{ row: 0, msg: 'File kh\u00f4ng c\u00f3 sheet d\u1eef li\u1ec7u.' }] };
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
  const found = findHeaderRow(aoa);
  if (!found) {
    return {
      rows,
      errors: [{ row: 1, msg: 'C\u1ea7n c\u00e1c c\u1ed9t Ng\u00e0y, T\u00ean chi\u1ebfn d\u1ecbch v\u00e0 Chi ti\u00eau ho\u1eb7c Tr\u00f2 chuy\u1ec7n. M\u00e3 NV c\u00f3 th\u1ec3 t\u1ef1 t\u00e1ch t\u1eeb t\u00ean chi\u1ebfn d\u1ecbch.' }],
    };
  }

  const { index: headerIndex, columns } = found;
  let lastCampaign = '';
  for (let i = headerIndex + 1; i < aoa.length; i++) {
    const row = aoa[i] || [];
    const rawCampaign = String(row[columns.ten_chien_dich] ?? '').trim();
    const rawDate = row[columns.ngay];
    if (isSummaryDate(rawDate) || isSummaryCampaign(rawCampaign)) {
      if (isSummaryCampaign(rawCampaign)) lastCampaign = '';
      continue;
    }
    if (rawCampaign) lastCampaign = rawCampaign;
    const campaign = rawCampaign || lastCampaign;
    if (isSummaryCampaign(campaign)) continue;
    const explicitCode = columns.ma_nv >= 0 ? String(row[columns.ma_nv] ?? '').trim() : '';
    const bracketCode = campaign.match(/\[\s*([^\]]+?)\s*\]/)?.[1]?.trim() || '';
    const maNv = explicitCode || bracketCode || null;
    const dateText = String(rawDate ?? '').trim();
    const ngay = parseDate(rawDate);
    const spend = columns.so_tien_da_chi_tieu_vnd >= 0
      ? parseNumber(row[columns.so_tien_da_chi_tieu_vnd]) : null;
    const conversations = columns.so_tro_chuyen_tin_nhan >= 0
      ? parseNumber(row[columns.so_tro_chuyen_tin_nhan]) : null;

    if (!campaign && spend == null && conversations == null && !dateText) continue;
    if (dateText && !ngay) {
      errors.push({ row: i + 1, msg: 'Ng\u00e0y kh\u00f4ng h\u1ee3p l\u1ec7; d\u00f9ng yyyy-mm-dd ho\u1eb7c dd/mm/yyyy.' });
      continue;
    }
    rows.push({
      ma_nv: maNv,
      ngay,
      ten_chien_dich: campaign || null,
      so_tien_da_chi_tieu_vnd: spend,
      so_tro_chuyen_tin_nhan: conversations,
    });
  }
  if (rows.length === 0 && errors.length === 0) {
    errors.push({ row: 0, msg: 'Kh\u00f4ng t\u00ecm th\u1ea5y d\u00f2ng d\u1eef li\u1ec7u h\u1ee3p l\u1ec7.' });
  }
  return { rows, errors };
}
