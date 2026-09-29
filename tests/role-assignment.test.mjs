import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createState,
  normalizeState,
  saveState,
  loadState,
  saveWithBackup,
} from "../app.js";
import {
  exportEventJSON,
  importEventJSON,
  duplicateEvent,
} from "../event-workspace.js";
import {
  blankTask,
  normalizeAssignments,
  assignmentCandidates,
  addAssignmentTasks,
  TASK_TEMPLATES,
  assignmentConflicts,
  taskTimeIssue,
  deleteStaff,
  sortedTasks,
  assignmentTimeline,
  hasTask,
} from "../role-assignment.js";
const staff = [
  { id: "s1", name: "담당 가", org: "준비팀", contact: "" },
  { id: "s2", name: "담당 나", org: "운영팀", contact: "" },
];
const task = (id, more = {}) => ({ ...blankTask(id), title: id, ...more });
const s = () => ({
  ...createState(),
  staff: structuredClone(staff),
  roleTasks: [],
});
const importJSON = (v) => importEventJSON(v, normalizeState, createState());
test("pre-feature V0.5 fixture retains agenda, roster, campus and legacy notes with empty assignments", () => {
  const raw = JSON.parse(
    readFileSync(
      new URL("./fixtures/event-complete.json", import.meta.url),
      "utf8",
    ),
  );
  const n = importJSON(JSON.stringify(raw));
  assert.deepEqual(n.staff, []);
  assert.deepEqual(n.roleTasks, []);
  for (const k of ["agenda", "attendees", "roles", "campus", "cues"])
    assert.deepEqual(n[k], raw.state[k]);
});
test("complete assignment JSON round trip, including assistants, notes and times", () => {
  const a = s();
  a.roleTasks = [
    task("t1", {
      primary: "s1",
      assistant: "s2",
      phase: "day",
      start: "13:30",
      end: "14:20",
      status: "active",
      description: "장비 점검",
      location: "로비",
      note: "예비 케이블",
    }),
    task("t2", { due: "2026-09-30" }),
  ];
  const b = importJSON(exportEventJSON(normalizeState(a)));
  assert.deepEqual(b.roleTasks, a.roleTasks);
  assert.deepEqual(b.staff, a.staff);
});
test("malformed assignment files fail before replacement", () => {
  const a = s();
  a.roleTasks = [task("t1")];
  for (const mutate of [
    (v) => v.staff.push(v.staff[0]),
    (v) => (v.roleTasks[0].primary = "missing"),
    (v) => (v.roleTasks[0].start = "24:00"),
    (v) => (v.roleTasks[0].due = "2026-02-30"),
    (v) => (v.roleTasks[0].status = "oops"),
    (v) => (v.staff[0].name = ""),
    (v) => (v.roleTasks[0].description = "x".repeat(1001)),
    (v) => (v.roleTasks[0].primary = v.roleTasks[0].assistant = "s1"),
  ]) {
    const b = structuredClone(a);
    mutate(b);
    assert.throws(() => importJSON(exportEventJSON(b)));
  }
});
test("candidate choices follow needs; no unconditional photography, parking, screen or food", () => {
  const a = s();
  a.photography = "none";
  a.food = "none";
  a.external = "no";
  a.nameplates = "none";
  a.seating = "none";
  let keys = assignmentCandidates(a).map((t) => t.source);
  assert.ok(
    !keys.some((k) => /photo|parking|screen|food|seating|nameplates/.test(k)),
  );
  Object.assign(a, {
    photography: "needed",
    food: "snacks",
    external: "yes",
    nameplates: "needed",
    seating: "needed",
    outputs: ["led"],
  });
  keys = assignmentCandidates(a).map((t) => t.source);
  for (const k of [
    "prep:parking",
    "prep:nameplates",
    "prep:photo",
    "day:photo",
    "prep:screen",
    "day:screen",
    "prep:seating",
    "day:seating",
    "prep:food",
    "day:food",
  ])
    assert.ok(keys.includes(k), k);
});
test("explicit candidate selection prevents duplicates across templates, rename, title whitespace", () => {
  let n = 0;
  const id = () => `t${++n}`,
    c = TASK_TEMPLATES[0];
  const a = addAssignmentTasks(s(), [c], id);
  assert.equal(a.roleTasks.length, 1);
  a.roleTasks[0].title = "사용자가 바꾼 제목";
  assert.equal(addAssignmentTasks(a, [c], id).roleTasks.length, 1);
  assert.ok(hasTask([task("custom", { title: "장소예약/확인" })], c));
});
test("conflicts include primary vs assistant and assistant vs assistant, adjacent time is allowed", () => {
  const a = s();
  a.roleTasks = [
    task("a", {
      phase: "day",
      primary: "s1",
      assistant: "s2",
      start: "13:30",
      end: "14:10",
    }),
    task("b", {
      phase: "day",
      primary: "s2",
      assistant: "s1",
      start: "13:50",
      end: "14:30",
    }),
    task("c", { phase: "day", primary: "s1", start: "14:30", end: "15:00" }),
  ];
  assert.equal(assignmentConflicts(a).length, 2);
  a.roleTasks[1].primary = "";
  assert.equal(assignmentConflicts(a).length, 1);
  a.roleTasks[0].primary = "";
  a.roleTasks[0].assistant = "s1";
  assert.equal(assignmentConflicts(a)[0].person, "s1");
});
test("missing/reversed times are flagged, never block save, and are excluded from overlap comparison", () => {
  const a = s();
  a.roleTasks = [
    task("a", { phase: "day", primary: "s1", start: "15:00", end: "14:00" }),
  ];
  assert.ok(taskTimeIssue(a.roleTasks[0]));
  assert.equal(assignmentConflicts(a).length, 0);
  assert.deepEqual(importJSON(exportEventJSON(a)).roleTasks, a.roleTasks);
});
test("deleting a person preserves work and clears primary or assistant references", () => {
  const a = s();
  a.roleTasks = [
    task("a", { primary: "s1", assistant: "s2", status: "planned" }),
    task("b", { primary: "s2", assistant: "s1" }),
  ];
  const b = deleteStaff(a, "s1");
  assert.equal(b.roleTasks.length, 2);
  assert.equal(b.roleTasks[0].primary, "");
  assert.equal(b.roleTasks[0].status, "unassigned");
  assert.equal(b.roleTasks[1].assistant, "");
  assert.equal(b.roleTasks[1].primary, "s2");
});
test("duplicating an event keeps task definitions but clears staff, assignment and schedule", () => {
  const a = s();
  a.roleTasks = [
    task("a", {
      primary: "s1",
      assistant: "s2",
      start: "13:00",
      end: "14:00",
      due: "2026-09-30",
      status: "done",
    }),
  ];
  const b = duplicateEvent(a, false, normalizeState);
  assert.deepEqual(b.staff, []);
  assert.equal(b.roleTasks[0].title, "a");
  for (const k of ["primary", "assistant", "start", "end", "due"])
    assert.equal(b.roleTasks[0][k], "");
  assert.equal(b.roleTasks[0].status, "unassigned");
});
test("run sheet merges cues without mutating or copying them into role tasks; unknown times last", () => {
  const a = s();
  a.cues = [
    {
      id: "cue1",
      title: "개회",
      time: "14:00",
      owner: "사회",
      action: "소개",
      note: "",
    },
  ];
  a.roleTasks = [
    task("a", { phase: "day", start: "13:50", end: "14:05" }),
    task("b", { phase: "day" }),
    task("p", { phase: "prep" }),
  ];
  const before = structuredClone(a);
  assert.deepEqual(
    assignmentTimeline(a).map((t) => t.id),
    ["a", "cue1", "b"],
  );
  assert.deepEqual(a, before);
  assert.equal(sortedTasks(a.roleTasks)[0].id, "p");
});
test("transaction storage failure leaves saved state intact; reload restores tasks", () => {
  const map = new Map(),
    store = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
      removeItem: (k) => map.delete(k),
    };
  loadState(store);
  const a = s();
  a.roleTasks = [task("a", { primary: "s1" })];
  assert.equal(saveState(store, a), true);
  assert.deepEqual(loadState(store).state.roleTasks, a.roleTasks);
  const prior = [...map.entries()];
  store.setItem = () => {
    throw Error("quota");
  };
  assert.throws(() => saveWithBackup(store, { ...a, roleTasks: [] }));
  assert.deepEqual([...map.entries()], prior);
});

test("same-time and untimed cue rows retain the existing cue order", () => {
  const a = s();
  a.cues = ["c1", "c2"].map((id) => ({
    id,
    title: id,
    time: "14:00",
    owner: "",
    action: "",
    note: "",
  }));
  a.roleTasks = ["t1", "t2"].map((id) =>
    task(id, { phase: "day", start: "14:00", end: "14:10" }),
  );
  assert.deepEqual(
    assignmentTimeline(a).map((t) => t.id),
    ["c1", "c2", "t1", "t2"],
  );
  for (const row of a.cues) row.time = "";
  for (const row of a.roleTasks) row.start = "";
  assert.deepEqual(
    assignmentTimeline(a).map((t) => t.id),
    ["c1", "c2", "t1", "t2"],
  );
});
