export type ReportsRawMetricRow = {
  id?: string | null;
  report_date?: string | null;
  code?: string | null;
  page?: string | null;
  revenue?: number | string | null;
  tien_viet?: number | string | null;
  ad_cost?: number | string | null;
  mess_comment_count?: number | string | null;
};

function safeNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function codeFromPage(value: string | null | undefined): string | null {
  const match = String(value ?? '').trim().match(/\[([^\]]+)\]/);
  return match?.[1]?.trim() || null;
}

function employeeCode(row: ReportsRawMetricRow): string {
  return String(row.code || codeFromPage(row.page) || '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Sales in Fabico reports has one authoritative total per date and employee.
 * Imported rows may split other fields across several rows, so only sales are
 * collapsed to that grain; Meta spend and messages remain row-summed.
 */
export function aggregateReportsRawMetrics(rows: ReportsRawMetricRow[]) {
  let mess = 0;
  let ads = 0;
  const salesByEmployeeDay = new Map<string, { id: string; revenue: number; vnd: number }>();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    mess += safeNumber(row.mess_comment_count);
    ads += safeNumber(row.ad_cost);

    const reportDate = row.report_date?.slice(0, 10) || '';
    const code = employeeCode(row);
    const key = reportDate && code ? `${reportDate}\0${code}` : `row\0${row.id || index}`;
    const id = row.id || key;
    const previous = salesByEmployeeDay.get(key);
    if (!previous || id.localeCompare(previous.id) < 0) {
      salesByEmployeeDay.set(key, {
        id,
        revenue: Number.isFinite(Number(row.revenue)) ? Number(row.revenue) : 0,
        vnd: safeNumber(row.tien_viet),
      });
    }
  }

  let revenue = 0;
  let vnd = 0;
  for (const sales of salesByEmployeeDay.values()) {
    revenue += sales.revenue;
    vnd += sales.vnd;
  }
  return { mess, ads, vnd, revenue };
}
