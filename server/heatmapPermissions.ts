export type HeatmapTeamMembership = {
  ten_team: string;
  member_ids: unknown;
};

function normalize(value: unknown): string {
  return String(value ?? '').normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').trim().toLowerCase().replace(/\s+/g, ' ');
}

function ids(value: unknown): string[] {
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return []; }
  }
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
}

/** Explicit CRM member IDs are authoritative; only legacy teams without IDs use the free-text team field. */
export function isHeatmapTeamMember(employeeId: string, employeeTeam: string | null | undefined, team: HeatmapTeamMembership): boolean {
  const memberIds = ids(team.member_ids);
  return memberIds.length > 0
    ? memberIds.includes(employeeId)
    : normalize(employeeTeam) === normalize(team.ten_team);
}
