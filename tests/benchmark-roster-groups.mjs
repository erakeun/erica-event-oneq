// Optional microbenchmark: node tests/benchmark-roster-groups.mjs
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { rosterGroups } from '../event-workspace.js';
import { activePeople } from '../oneq-changes.js';

// Reference behavior from main 00520fd5, before single-pass counting.
const previous = s => [...new Set(activePeople(s).map(p => p.group.trim() || '구분 미입력'))]
  .map(name => ({ name, count: activePeople(s).filter(p => (p.group.trim() || '구분 미입력') === name).length }));
let seed = 12345;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
for (let i = 0; i < 500; i++) {
  const state = { attendees: Array.from({ length: Math.floor(random() * 301) }, () => ({
    group: ['A', ' B ', '', '\t', '구분 미입력', '__proto__', 'constructor', String(Math.floor(random() * 50))][Math.floor(random() * 8)],
    attendance: [undefined, 'attending', 'absent', 'replaced'][Math.floor(random() * 4)],
  })) };
  assert.deepEqual(rosterGroups(state), previous(state));
}
const state = { attendees: Array.from({ length: 300 }, (_, i) => ({ group: `Group ${i}` })) };
function median(fn) {
  for (let i = 0; i < 500; i++) fn(state);
  const samples = [];
  for (let trial = 0; trial < 7; trial++) {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) fn(state);
    samples.push(performance.now() - start);
  }
  return samples.sort((a, b) => a - b)[3];
}
const before = median(previous), after = median(rosterGroups);
console.log(JSON.stringify({ equivalentFixtures: 500, attendees: 300, iterations: 1000, trials: 7, beforeMs: before, afterMs: after, speedup: before / after }, null, 2));
