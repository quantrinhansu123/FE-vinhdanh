import test from 'node:test';
import assert from 'node:assert/strict';
import { isHeatmapTeamMember } from './heatmapPermissions.js';

test('explicit CRM member IDs override a stale employees.team label', () => {
  assert.equal(isHeatmapTeamMember('employee-1', 'Old Team', {
    ten_team: 'New Team',
    member_ids: ['employee-1'],
  }), true);
});

test('a populated member list does not authorize another employee by matching free text', () => {
  assert.equal(isHeatmapTeamMember('employee-2', 'New Team', {
    ten_team: 'New Team',
    member_ids: ['employee-1'],
  }), false);
});

test('legacy teams without explicit members fall back to normalized employees.team', () => {
  assert.equal(isHeatmapTeamMember('employee-1', '  MKT  Alpha ', {
    ten_team: 'mkt alpha',
    member_ids: [],
  }), true);
});
