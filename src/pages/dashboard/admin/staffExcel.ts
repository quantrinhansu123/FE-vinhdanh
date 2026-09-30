import * as XLSX from 'xlsx';

export const STAFF_EXCEL_TEMPLATE_FILENAME = 'mau-nhan-su.xlsx';

const HEADERS = [
  'Mã NS',
  'Họ tên',
  'Team',
  'Vị trí',
  'Dự án',
  'Email',
  'Mật khẩu',
] as const;

export type StaffImportRow = {
  ma_ns: string | null;
  name: string;
  team: string;
  vi_tri: string | null;
  leader: string | null;
  du_an_ten: string | null;
  so_fanpage: number;
  trang_thai: 'dang_lam' | 'nghi' | 'tam_nghi' | 'dot_tien';
  email: string | null;
  pass?: string;
  score: number;
  ngay_bat_dau: string | null;
};

export type StaffExcelError = { row: number; message: string };

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const HEADER_ALIASES: Record<keyof StaffImportRow, string[]> = {
  ma_ns: ['ma ns', 'ma nhan su', 'ma nhan vien', 'employee code'],
  name: ['ho ten', 'ten nhan su', 'name', 'full name'],
  team: ['team', 'nhom', 'doi'],
  vi_tri: ['vi tri', 'chuc danh', 'position'],
  leader: ['leader', 'truong nhom', 'quan ly'],
  du_an_ten: ['du an', 'ten du an', 'project'],
  so_fanpage: ['so fanpage', 'fanpage'],
  trang_thai: ['trang thai', 'status'],
  email: ['email', 'e mail'],
  pass: ['mat khau', 'password'],
  score: ['diem', 'score'],
  ngay_bat_dau: ['ngay bat dau', 'ngay vao lam', 'start date'],
};

const STATUS_ALIASES: Record<string, StaffImportRow['trang_thai']> = {
  'dang lam': 'dang_lam',
  active: 'dang_lam',
  nghi: 'nghi',
  'on leave': 'nghi',
  'tam nghi': 'tam_nghi',
  'temporary leave': 'tam_nghi',
  'dot tien': 'dot_tien',
  'at risk': 'dot_tien',
};

function cellText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function parseNonNegativeInt(value: unknown, label: string, row: number, errors: StaffExcelError[]): number {
  if (value == null || value === '') return 0;
  const numeric = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(numeric) || numeric < 0 || !Number.isInteger(numeric)) {
    errors.push({ row, message: `${label} phải là số nguyên không âm.` });
    return 0;
  }
  return numeric;
}

function parseDate(value: unknown): string | null | undefined {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date((Math.floor(value) - 25569) * 86400 * 1000);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  let parts: RegExpMatchArray | null;
  if ((parts = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    const [, year, month, day] = parts;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return undefined;
  }
  if ((parts = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    const [, day, month, year] = parts;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  return undefined;
}

export function downloadStaffExcelTemplate(): void {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, Array(HEADERS.length).fill('')]);
  ws['!cols'] = [16, 28, 20, 22, 24, 30, 22].map((wch) => ({ wch }));
  const help = XLSX.utils.aoa_to_sheet([
    ['Hướng dẫn nhập nhân sự'],
    ['Nhập mỗi nhân sự trên một dòng trong sheet Nhan su. Có thể để trống bất kỳ ô nào.'],
    ['Dòng hoàn toàn trống sẽ được bỏ qua. Mã NS và Email nên là duy nhất.'],
    ['Mật khẩu không bắt buộc; để trống nếu chưa tạo thông tin đăng nhập.'],
    ['File tải lên chỉ thêm nhân sự mới; dòng có Mã NS hoặc Email đã tồn tại sẽ được bỏ qua.'],
  ]);
  help['!cols'] = [{ wch: 110 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Nhan su');
  XLSX.utils.book_append_sheet(wb, help, 'Huong dan');
  XLSX.writeFile(wb, STAFF_EXCEL_TEMPLATE_FILENAME);
}

export async function parseStaffExcelFile(file: File): Promise<{ rows: StaffImportRow[]; errors: StaffExcelError[] }> {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  } catch {
    return { rows: [], errors: [{ row: 0, message: 'Không đọc được file Excel.' }] };
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { rows: [], errors: [{ row: 0, message: 'File không có sheet dữ liệu.' }] };
  const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
  if (values.length < 2) return { rows: [], errors: [{ row: 1, message: 'File cần có tiêu đề và ít nhất một dòng dữ liệu.' }] };

  const headers = values[0].map(normalizeHeader);
  const columns = {} as Record<keyof StaffImportRow, number>;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [keyof StaffImportRow, string[]][]) {
    const normalizedAliases = aliases.map(normalizeHeader);
    columns[field] = headers.findIndex((header) => normalizedAliases.includes(header));
  }

  const errors: StaffExcelError[] = [];
  if (!Object.values(columns).some((index) => index >= 0)) {
    return { rows: [], errors: [{ row: 1, message: 'Không tìm thấy tiêu đề cột nhân sự trong file Excel.' }] };
  }
  const rows: StaffImportRow[] = [];
  const seenCodes = new Set<string>();
  const seenEmails = new Set<string>();
  for (let i = 1; i < values.length; i += 1) {
    const cells = values[i];
    if (!cells.some((value) => cellText(value))) continue;
    const rowNumber = i + 1;
    const get = (field: keyof StaffImportRow) => (columns[field] < 0 ? '' : cells[columns[field]]);
    const name = cellText(get('name'));
    const team = cellText(get('team'));
    const maNs = cellText(get('ma_ns')) || null;
    const emailText = cellText(get('email'));
    const email = emailText || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: rowNumber, message: 'Email không đúng định dạng.' });
      continue;
    }
    const codeKey = maNs?.toLowerCase();
    const emailKey = email?.toLowerCase();
    if ((codeKey && seenCodes.has(codeKey)) || (emailKey && seenEmails.has(emailKey))) {
      errors.push({ row: rowNumber, message: 'Mã NS hoặc Email bị trùng trong file.' });
      continue;
    }
    if (codeKey) seenCodes.add(codeKey);
    if (emailKey) seenEmails.add(emailKey);

    const numericErrorsBefore = errors.length;
    const soFanpage = parseNonNegativeInt(get('so_fanpage'), 'Số fanpage', rowNumber, errors);
    const score = parseNonNegativeInt(get('score'), 'Điểm', rowNumber, errors);
    const parsedDate = parseDate(get('ngay_bat_dau'));
    if (parsedDate === undefined) errors.push({ row: rowNumber, message: 'Ngày bắt đầu không hợp lệ.' });
    const rawStatus = normalizeHeader(get('trang_thai')) || 'dang lam';
    const status = STATUS_ALIASES[rawStatus];
    if (!status) errors.push({ row: rowNumber, message: 'Trạng thái không hợp lệ.' });
    if (errors.length !== numericErrorsBefore) continue;

    const password = cellText(get('pass'));
    rows.push({
      ma_ns: maNs,
      name,
      team,
      vi_tri: cellText(get('vi_tri')) || null,
      leader: cellText(get('leader')) || null,
      du_an_ten: cellText(get('du_an_ten')) || null,
      so_fanpage: soFanpage,
      trang_thai: status!,
      email,
      ...(password ? { pass: password } : {}),
      score,
      ngay_bat_dau: parsedDate ?? null,
    });
  }

  if (!rows.length && !errors.length) errors.push({ row: 0, message: 'Không tìm thấy dòng nhân sự nào trong file.' });
  return { rows, errors };
}
