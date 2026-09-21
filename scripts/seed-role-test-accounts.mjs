/**
 * Seed 4 tài khoản test phân cấp + mapping Team Test / dự án.
 * Chạy: node scripts/seed-role-test-accounts.mjs
 * Dùng anon key trong .env (RLS đang cho anon insert/update).
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const env = {};
  for (const file of ['.env.local', '.env']) {
    try {
      const text = readFileSync(file, 'utf8');
      for (const line of text.split('\n')) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    } catch { /* ignore */ }
  }
  return env;
}

const env = loadEnv();
const URL = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error('Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong .env');
  process.exit(1);
}
const supabase = createClient(URL, KEY);

const ACCOUNTS = [
  { name: 'Test Giám Đốc', email: 'giamdoc@test.com', pass: '123456', team: 'Ban Giám Đốc', vi_tri: 'Giám đốc', ma_ns: 'TEST-GD' },
  { name: 'Test QLDA', email: 'qldoan@test.com', pass: '123456', team: 'Ban Quản Lý', vi_tri: 'Quản lý dự án', ma_ns: 'TEST-PM' },
  { name: 'Test Leader', email: 'leader@test.com', pass: '123456', team: 'Team Test', vi_tri: 'Leader', ma_ns: 'TEST-LD' },
  { name: 'Test NV', email: 'nv@test.com', pass: '123456', team: 'Team Test', vi_tri: 'Nhân viên MKT', ma_ns: 'TEST-NV' },
];

async function upsertEmployee(a) {
  const found = await supabase.from('employees').select('id').ilike('email', a.email).limit(1);
  if (found.error) throw new Error(`employees select: ${found.error.message}`);
  const payload = { name: a.name, email: a.email, pass: a.pass, team: a.team, vi_tri: a.vi_tri, ma_ns: a.ma_ns, trang_thai: 'dang_lam', score: 0 };
  if (found.data?.length) {
    const id = found.data[0].id;
    const up = await supabase.from('employees').update(payload).eq('id', id).select('id').single();
    if (up.error) throw new Error(`employees update ${a.email}: ${up.error.message}`);
    console.log(`updated ${a.email} (${a.vi_tri})`);
    return id;
  }
  const ins = await supabase.from('employees').insert(payload).select('id').single();
  if (ins.error) throw new Error(`employees insert ${a.email}: ${ins.error.message}`);
  console.log(`inserted ${a.email} (${a.vi_tri})`);
  return ins.data.id;
}

const r = await supabase.from('du_an').select('id, ten_du_an').order('ten_du_an', { ascending: true });
if (r.error) throw new Error(`du_an select: ${r.error.message}`);
let projects = r.data || [];
if (projects.length < 2) {
  const ins = await supabase.from('du_an').insert({
    ma_du_an: 'TEST-B', ten_du_an: 'Dự án Test B (ngoài scope Team Test)',
    trang_thai: 'dang_chay', so_mkt: 0,
  }).select('id, ten_du_an').single();
  if (ins.error) throw new Error(`du_an insert: ${ins.error.message}`);
  console.log(`inserted project ${ins.data.ten_du_an}`);
  projects = [...projects, ins.data];
}
const projectA = projects[0];
console.log(`projectA (thuộc Team Test): ${projectA.ten_du_an}`);
console.log(`projectB (ngoài scope): ${projects[1]?.ten_du_an}`);

const ids = {};
for (const a of ACCOUNTS) ids[a.email] = await upsertEmployee(a);

const leaderName = 'Test Leader';
await supabase.from('du_an').update({ leader: leaderName, staff_ids: [ids['leader@test.com'], ids['nv@test.com']] }).eq('id', projectA.id)
  .then(({ error }) => { if (error) throw new Error(`du_an update scope: ${error.message}`); });
console.log(`du_an ${projectA.ten_du_an}: leader=${leaderName}, staff=[leader,nv]`);

const tFound = await supabase.from('crm_teams').select('id').eq('ma_team', 'TEAM-TEST').limit(1);
if (tFound.error) throw new Error(`crm_teams select: ${tFound.error.message}`);
const teamPayload = {
  ma_team: 'TEAM-TEST', ten_team: 'Team Test', leader: leaderName,
  member_ids: [ids['leader@test.com'], ids['nv@test.com']],
  du_an_ids: [projectA.id], so_thanh_vien: 2, trang_thai: 'hoat_dong',
};
if (tFound.data?.length) {
  const { error } = await supabase.from('crm_teams').update(teamPayload).eq('id', tFound.data[0].id);
  if (error) throw new Error(`crm_teams update: ${error.message}`);
  console.log('updated crm_teams TEAM-TEST');
} else {
  const { error } = await supabase.from('crm_teams').insert(teamPayload);
  if (error) throw new Error(`crm_teams insert: ${error.message}`);
  console.log('inserted crm_teams TEAM-TEST');
}

console.log('\nXONG. 4 acc test (pass 123456): giamdoc@test.com, qldoan@test.com, leader@test.com, nv@test.com');
