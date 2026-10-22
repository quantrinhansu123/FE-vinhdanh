import type { IncomingMessage, ServerResponse } from 'node:http';
import { createUpcareClient } from '../server/upcareClient.js';
import { requestUpcareSaleOnlyPayload } from '../server/upcareSales.js';
import {
  createCrmDatabase,
  crmErrorResponse,
  readCrmEmployee,
  requireSameOriginCrmRequest,
  resolveCrmSessionId,
  type CrmEmployee,
} from '../server/crmSession.js';
import { isAdminViTriPosition } from '../src/utils/crmNavAccess.js';
import { isHeatmapTeamMember } from '../server/heatmapPermissions.js';

type TeamRecord = { id: string; ten_team: string; leader: string | null; member_ids: unknown; du_an_ids: unknown; trang_thai?: string | null };
type EmployeeRecord = CrmEmployee;
type ReportRecord = {
  report_date: string;
  code: string | null;
  email: string;
  name: string | null;
  team: string | null;
  ad_cost: number | string | null;
  revenue: number | string | null;
  tien_viet: number | string | null;
};
type HeatmapRow = {
  date: string;
  email: string;
  code: string | null;
  name: string;
  teamId: string | null;
  teamName: string;
  avatarUrl: string | null;
  position: string | null;
  adCost: number;
  revenueVnd: number;
  hasReport: boolean;
};

function normalize(value: unknown): string {
  return String(value ?? '').normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isProjectManager(position: string | null): boolean {
  const role = normalize(position);
  return role.includes('quan ly du an') || role.includes('project manager') || role === 'qlda';
}

function toNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function fetchAll<T>(queryFactory: (from: number, to: number) => any): Promise<T[]> {
  const values: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await queryFactory(from, from + 999).abortSignal(AbortSignal.timeout(15000));
    if (error) throw new Error('Không đọc được dữ liệu Heatmap từ Supabase.');
    const page = Array.isArray(data) ? data as T[] : [];
    values.push(...page);
    if (page.length < 1000) return values;
  }
}

function projectIds(value: unknown): string[] {
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return []; }
  }
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
}

function normalizeCode(value: unknown): string {
  return String(value ?? '').normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\u00a0/g, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
}

const ODOO_VND_RATE = 25_000;
const ODOO_SALE_ONLY_CODES = new Set(['fbc.oldcustomer', 'fbc.hotline']);

function addProjectQuery(search: URLSearchParams, env: Record<string, string | undefined>): void {
  const projectId = (env.UPCARE_CRM_PROJECT_UUID || env.VITE_UPCARE_CRM_PROJECT_UUID || '').trim();
  if (!projectId || projectId.toLowerCase() === 'none') return;
  const parameter = (env.UPCARE_CRM_PROJECT_PARAM || env.VITE_UPCARE_CRM_PROJECT_PARAM || 'project_id').trim();
  search.set(parameter || 'project_id', projectId);
}

function blankTeamId(name: string): string {
  return `unlinked:${normalize(name)}`;
}

export function createHeatmapHandler(env: Record<string, string | undefined>) {
  return async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET, OPTIONS'); json(res, 405, { error: 'method_not_allowed' }); return; }

  try {
    requireSameOriginCrmRequest(req);
    const db = createCrmDatabase(env);
    const viewer = await readCrmEmployee(db, env, resolveCrmSessionId(req, env));
    const isAdmin = viewer.email.trim().toLowerCase() === 'upedu2024@gmail.com' || isAdminViTriPosition(viewer.vi_tri);
    const isPm = !isAdmin && isProjectManager(viewer.vi_tri);
    const position = normalize(viewer.vi_tri);
    const isLeader = !isAdmin && !isPm &&
      (position.includes('leader') || position.includes('truong nhom') || position.includes('team lead'));
    if (!isAdmin && !isPm && !isLeader) {
      json(res, 403, { error: 'heatmap_forbidden', message: 'Tài khoản không có quyền xem Heatmap.' });
      return;
    }

    const url = new URL(req.url || '/', 'http://localhost');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!validDate(from) || !validDate(to) || from > to ||
        (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 > 6) {
      json(res, 400, { error: 'invalid_date_range', message: 'Heatmap chỉ hỗ trợ tối đa 7 ngày hợp lệ.' });
      return;
    }

    const teamsTable = env.SUPABASE_TEAMS_TABLE?.trim() || env.VITE_SUPABASE_TEAMS_TABLE?.trim() || 'crm_teams';
    const employeeTable = env.SUPABASE_EMPLOYEES_TABLE?.trim() || env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
    const projectsTable = env.SUPABASE_DU_AN_TABLE?.trim() || env.VITE_SUPABASE_DU_AN_TABLE?.trim() || 'du_an';
    const reportsTable = env.SUPABASE_REPORTS_TABLE?.trim() || env.VITE_SUPABASE_REPORTS_TABLE?.trim() || 'detail_reports';
    const teams = await fetchAll<TeamRecord>((start, end) => db.from(teamsTable)
      .select('id,ten_team,leader,member_ids,du_an_ids,trang_thai').order('ten_team').range(start, end));

    let allowedTeams: TeamRecord[];
    let scope: 'all' | 'team' | 'project';
    if (isAdmin) {
      allowedTeams = teams;
      scope = 'all';
    } else if (isPm) {
      const projects = await fetchAll<{ id: string; leader: string | null; staff_ids: unknown }>((start, end) => db.from(projectsTable)
        .select('id,leader,staff_ids').order('id').range(start, end));
      const managedProjectIds = new Set(projects.filter((project) =>
        normalize(project.leader) === normalize(viewer.name) || projectIds(project.staff_ids).includes(viewer.id),
      ).map((project) => project.id));
      allowedTeams = managedProjectIds.size
        ? teams.filter((team) => projectIds(team.du_an_ids).some((id) => managedProjectIds.has(id)))
        : [];
      scope = 'project';
    } else {
      const managed = teams.filter((team) => normalize(team.leader) === normalize(viewer.name));
      const fallback = viewer.team?.trim();
      allowedTeams = managed.length
        ? managed
        : fallback
          ? teams.filter((team) => normalize(team.ten_team) === normalize(fallback))
          : [];
      if (!allowedTeams.length && fallback) {
        allowedTeams = [{ id: blankTeamId(fallback), ten_team: fallback, leader: viewer.name, member_ids: [], du_an_ids: [] }];
      }
      scope = 'team';
    }

    const teamIdByName = new Map(allowedTeams.map((team) => [normalize(team.ten_team), team.id]));
    const employeeFields = 'id,email,name,team,ma_ns,vi_tri,avatar_url';
    const allEmployees = await fetchAll<EmployeeRecord>((start, end) => {
      return db.from(employeeTable).select(employeeFields).not('email', 'is', null).order('name').range(start, end);
    });
    const globalEmails = new Set<string>();
    const duplicateEmails = new Set<string>();
    const globalCodes = new Set<string>();
    const duplicateCodes = new Set<string>();
    for (const employee of allEmployees) {
      const email = employee.email.trim().toLowerCase();
      if (email && globalEmails.has(email)) duplicateEmails.add(email);
      else if (email) globalEmails.add(email);
      const code = normalizeCode(employee.ma_ns);
      if (code && globalCodes.has(code)) duplicateCodes.add(code);
      else if (code) globalCodes.add(code);
    }
    const teamForEmployeeId = new Map<string, TeamRecord>();
    const permittedEmployees = allEmployees.filter((employee) => {
      if (isAdmin) return true;
      const matchingTeams = allowedTeams.filter((team) => isHeatmapTeamMember(employee.id, employee.team, team));
      const assignedTeam = matchingTeams.find((team) => normalize(team.ten_team) === normalize(employee.team)) || matchingTeams[0];
      if (assignedTeam) teamForEmployeeId.set(employee.id, assignedTeam);
      return Boolean(assignedTeam);
    });
    const employeeByEmail = new Map<string, EmployeeRecord>();
    const employeeByCode = new Map<string, EmployeeRecord>();
    for (const employee of permittedEmployees) {
      const email = employee.email.trim().toLowerCase();
      if (email && !duplicateEmails.has(email)) employeeByEmail.set(email, employee);
      const code = normalizeCode(employee.ma_ns);
      if (code && !duplicateCodes.has(code)) employeeByCode.set(code, employee);
    }

    const emails = [...employeeByEmail.keys()];
    const reports: ReportRecord[] = [];
    if (isAdmin || emails.length) {
      reports.push(...await fetchAll<ReportRecord>((start, end) => {
        let query = db.from(reportsTable).select('report_date,code,email,name,team,ad_cost,revenue,tien_viet')
          .gte('report_date', from).lte('report_date', to).order('report_date').range(start, end);
        if (!isAdmin) query = query.in('email', emails);
        return query;
      }));
    }

    const aggregates = new Map<string, HeatmapRow>();
    for (const report of reports) {
      const email = String(report.email || '').trim().toLowerCase();
      const employee = employeeByEmail.get(email);
      if (!employee && !isAdmin) continue;
      const date = String(report.report_date || '').slice(0, 10);
      if (!validDate(date)) continue;
      const assignedTeam = employee ? teamForEmployeeId.get(employee.id) : undefined;
      const teamName = String(assignedTeam?.ten_team || employee?.team || report.team || '').trim() || 'Chưa gán team';
      const teamId = assignedTeam?.id || teamIdByName.get(normalize(teamName)) || (isAdmin && teamName !== 'Chưa gán team' ? blankTeamId(teamName) : null);
      const key = `${email}\0${date}`;
      const current = aggregates.get(key) || {
        date,
        email,
        code: report.code || employee?.ma_ns || null,
        name: employee?.name || report.name || email,
        teamId,
        teamName,
        avatarUrl: employee?.avatar_url || null,
        position: employee?.vi_tri || null,
        adCost: 0,
        revenueVnd: 0,
        hasReport: true,
      } satisfies HeatmapRow;
      current.adCost += toNumber(report.ad_cost);
      const persistedVnd = report.tien_viet == null ? Number.NaN : Number(report.tien_viet);
      const revenueVnd = Number.isFinite(persistedVnd)
        ? persistedVnd
        : report.revenue == null ? 0 : toNumber(report.revenue);
      current.revenueVnd += revenueVnd;
      aggregates.set(key, current);
    }

    const warnings: string[] = [];
    const mktSearch = new URLSearchParams({ date_from: from, date_to: to });
    addProjectQuery(mktSearch, env);
    try {
      const response = await createUpcareClient(env).request(`/api/employee/mkt?${mktSearch.toString()}`);
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status}`);
      }
      if (!(response.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
        await response.body?.cancel();
        throw new Error('phản hồi không phải JSON');
      }
      const payload: unknown = await response.json();
      const dailyEntries: Array<[string, unknown[]]> = Array.isArray(payload)
        ? (from === to ? [[from, payload]] : [])
        : payload && typeof payload === 'object'
          ? Object.entries(payload as Record<string, unknown>).map(([date, rows]) => [date, rows as unknown[]])
          : [];
      const validDailyPayload = dailyEntries.length > 0 && dailyEntries.every(([date, rows]) =>
        validDate(date) && date >= from && date <= to && Array.isArray(rows),
      );
      const completeDailyPayload = validDailyPayload && eachDate(from, to).every((date) =>
        dailyEntries.some(([bucketDate]) => bucketDate === date),
      );
      if (!completeDailyPayload) {
        warnings.push('Odoo MKT chưa trả breakdown đủ ngày; đang dùng doanh thu đã lưu trong detail_reports.');
      } else {
        const revenueByCodeDay = new Map<string, number>();
        const matchedCodes = new Set<string>();
        for (const [date, rows] of dailyEntries) {
          for (const value of rows) {
            if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
            const raw = value as Record<string, unknown>;
            const code = normalizeCode(raw.code ?? raw.f99_uid);
            const employee = employeeByCode.get(code);
            if (!employee || ODOO_SALE_ONLY_CODES.has(code)) continue;
            matchedCodes.add(code);
            const key = `${code}\0${date}`;
            const amount = toNumber(raw.amount ?? raw.total);
            revenueByCodeDay.set(key, (revenueByCodeDay.get(key) || 0) + Math.round(amount * ODOO_VND_RATE));
          }
        }
        for (const code of matchedCodes) {
          const employee = employeeByCode.get(code);
          if (!employee) continue;
          const email = employee.email.trim().toLowerCase();
          const assignedTeam = teamForEmployeeId.get(employee.id);
          const teamName = assignedTeam?.ten_team || employee.team?.trim() || 'Chưa gán team';
          const teamId = assignedTeam?.id || teamIdByName.get(normalize(teamName)) || null;
          for (const date of eachDate(from, to)) {
            const key = `${email}\0${date}`;
            const current = aggregates.get(key) || {
              date, email, code: employee.ma_ns, name: employee.name || email,
              teamId, teamName, avatarUrl: employee.avatar_url, position: employee.vi_tri,
              adCost: 0, revenueVnd: 0, hasReport: false,
            } satisfies HeatmapRow;
            current.revenueVnd = revenueByCodeDay.get(`${code}\0${date}`) || 0;
            aggregates.set(key, current);
          }
        }
      }
    } catch {
      warnings.push('Không tải được doanh thu Odoo MKT; đang dùng số liệu đã lưu trong detail_reports.');
    }

    const saleOnlyCodes = ODOO_SALE_ONLY_CODES;
    const saleEmployees = [...saleOnlyCodes].map((code) => employeeByCode.get(code)).filter((employee): employee is EmployeeRecord =>
      Boolean(employee && employeeByEmail.get(employee.email.trim().toLowerCase())?.id === employee.id),
    );
    if (saleEmployees.length) {
      const saleUrl = new URLSearchParams({ date_from: from, date_to: to });
      addProjectQuery(saleUrl, env);
      try {
        const payload = await requestUpcareSaleOnlyPayload(createUpcareClient(env), saleUrl, env);
        if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
          warnings.push('Odoo Sales không trả dữ liệu chi tiết theo ngày; đang dùng số liệu đã lưu.');
        } else {
          const dailyBuckets = Object.entries(payload as Record<string, unknown>);
          if (!dailyBuckets.every(([, rows]) => Array.isArray(rows))) {
            warnings.push('Odoo Sales trả dữ liệu ngày không hợp lệ; đang dùng số liệu đã lưu.');
          } else {
            for (const employee of saleEmployees) {
              const email = employee.email.trim().toLowerCase();
              const assignedTeam = teamForEmployeeId.get(employee.id);
              const teamName = assignedTeam?.ten_team || employee.team?.trim() || 'Chưa gán team';
              const teamId = assignedTeam?.id || teamIdByName.get(normalize(teamName)) || null;
              for (const day of eachDate(from, to)) {
                const key = `${email}\0${day}`;
                aggregates.set(key, {
                  date: day, email, code: employee.ma_ns, name: employee.name || email,
                  teamId, teamName, avatarUrl: employee.avatar_url, position: employee.vi_tri,
                  adCost: 0, revenueVnd: 0, hasReport: true,
                });
              }
            }
            for (const [date, rawRows] of dailyBuckets) {
              if (!validDate(date) || date < from || date > to) continue;
              for (const raw of rawRows as Record<string, unknown>[]) {
                const code = normalizeCode(raw.code ?? raw.f99_uid);
                const employee = employeeByCode.get(code);
                if (!employee || !saleOnlyCodes.has(code)) continue;
                const email = employee.email.trim().toLowerCase();
                const key = `${email}\0${date}`;
                const row = aggregates.get(key);
                if (row) row.revenueVnd = Math.round(toNumber(raw.amount ?? raw.total) * 25000);
              }
            }
          }
        }
      } catch {
        warnings.push('Không tải được doanh thu Odoo Sales; đang dùng số liệu đã lưu.');
      }
    }

    const heatmapTeams = allowedTeams.map((team) => ({ id: team.id, name: team.ten_team }));
    if (isAdmin) {
      for (const employee of permittedEmployees) {
        const name = employee.team?.trim();
        if (name && !heatmapTeams.some((team) => normalize(team.name) === normalize(name))) {
          heatmapTeams.push({ id: blankTeamId(name), name });
        }
      }
    }
    json(res, 200, {
      range: { from, to },
      scope,
      teams: heatmapTeams,
      rows: [...aggregates.values()],
      warnings,
      scopeWarning: !isAdmin && allowedTeams.length === 0 ? 'Chưa có team hoặc dự án được gán cho tài khoản này.' : null,
    });
  } catch (error) {
    const response = crmErrorResponse(error);
    if (error instanceof Error && error.message === 'Không đọc được dữ liệu Heatmap từ Supabase.') {
      json(res, 502, { error: 'heatmap_source_failed', message: error.message });
      return;
    }
    json(res, response.status, response.body);
  }
  };
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return createHeatmapHandler(process.env)(req, res);
}

function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  while (cursor.getTime() <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
