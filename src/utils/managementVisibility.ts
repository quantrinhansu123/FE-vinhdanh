function normalize(value: string | null | undefined): string {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Records marked for removal from the management views in the supplied screenshots.
const hiddenProjects = new Set(['biokama', 'biokama cambodia', 'masshu cambodia', 'yasu', 'yasu cambodia']);
const hiddenTeamCodes = new Set(['team b', 'team a', 'team phu', 'yasu 01', 'ys cam']);
const hiddenTeamNames = new Set(['rise kama', 'team 1', 'team chay phu', 'team yasu', 'yasu vo dich']);
const hiddenStaffNames = new Set(['bui trung kien', 'ke toan kama', 'ke toan yasu']);

export function isVisibleProject(row: { ten_du_an?: string | null }): boolean {
  return !hiddenProjects.has(normalize(row.ten_du_an));
}

export function isVisibleTeam(row: { ma_team?: string | null; ten_team?: string | null }): boolean {
  return !hiddenTeamCodes.has(normalize(row.ma_team)) && !hiddenTeamNames.has(normalize(row.ten_team));
}

export function isVisibleStaff(row: { name?: string | null; email?: string | null; id?: string }): boolean {
  return !hiddenStaffNames.has(normalize(row.name)) && normalize(row.email) !== 'buitrungkien250@gmail.com' && !['9DFAE9F0', 'D31DB15E'].includes((row.id || '').slice(0, 8).toUpperCase());
}
