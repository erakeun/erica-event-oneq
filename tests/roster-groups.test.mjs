import test from 'node:test';
import assert from 'node:assert/strict';
import { rosterGroups } from '../event-workspace.js';

test('group counts preserve first appearance, trimmed names and active attendance', () => {
  const state = { attendees: [
    { group: ' B ', attendance: 'attending' },
    { group: 'hidden', attendance: 'absent' },
    { group: 'A' },
    { group: 'B' },
    { group: ' ', attendance: 'attending' },
    { group: 'hidden', attendance: 'replaced' },
    { group: '구분 미입력' },
    { group: '__proto__' },
    { group: 'constructor' },
  ] };
  const original = structuredClone(state);
  assert.deepEqual(rosterGroups(state), [
    { name: 'B', count: 2 }, { name: 'A', count: 1 },
    { name: '구분 미입력', count: 2 },
    { name: '__proto__', count: 1 }, { name: 'constructor', count: 1 },
  ]);
  assert.deepEqual(state, original);
  assert.deepEqual(rosterGroups({ attendees: [] }), []);
});

test('maximum roster reads each active group once instead of once per group', () => {
  let reads = 0;
  const attendees = Array.from({ length: 300 }, (_, i) => ({
    get group() { reads++; return `Group ${i}`; },
  }));
  const groups = rosterGroups({ attendees });
  assert.equal(groups.length, 300);
  assert.ok(groups.every(group => group.count === 1));
  assert.equal(reads, 300);
});
