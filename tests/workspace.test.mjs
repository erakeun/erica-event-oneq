import test from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  reconcile,
  normalizeState,
  updateState,
  buildChecklist,
  saveState,
  loadState,
} from "../app.js";
import { defaultAgenda } from "../agenda.js";
import { buildOnsite } from "../operations.js";
import {
  newPerson,
  newCue,
  normalizeRows,
  moveRow,
  validTime,
  cuesFromAgenda,
  cueSignature,
  cueStale,
  timeWarnings,
  importAttendeesCSV,
  exportAttendeesCSV,
  exportEventJSON,
  importEventJSON,
  duplicateEvent,
  rosterFingerprint,
  CSV_LIMIT,
  JSON_LIMIT,
} from "../event-workspace.js";
import {
  attendeesView,
  packetView,
  dayView,
  cuesView,
} from "../workspace-view.js";
const person = (id = "p1", name = "가상 김하나") => ({
  ...newPerson(id),
  group: "가상 기관",
  org: "가상 부서",
  title: "가상 팀장",
  name,
});
const make = () =>
  reconcile({
    ...createState(),
    campus: "erica",
    venue: "prime",
    event: "mou",
    agenda: defaultAgenda("mou"),
    external: "yes",
    food: "snacks",
    seating: "needed",
    nameplates: "needed",
    vip: "yes",
    publicity: "needed",
    outputs: ["welcome"],
    outputDecision: "chosen",
  });
const done = (s) => {
  for (const k of ["checks", "onsiteChecks", "afterChecks"])
    for (const v of Object.values(s[k])) v.status = "done";
  return s;
};
const read = (s) => importEventJSON(s, normalizeState, createState());

test("V0.5 empty workspace and old V0.4 state migrate without fabricating attendees or cues", () => {
  const raw = { ...make(), version: 4 };
  delete raw.attendees;
  delete raw.cues;
  delete raw.cueBasis;
  const next = normalizeState(raw);
  assert.equal(next.version, 5);
  assert.deepEqual(next.attendees, []);
  assert.deepEqual(next.cues, []);
  assert.deepEqual(next.agenda, raw.agenda);
});
test("attendee CRUD and stable order, arrived flag separate from roster identity", () => {
  let s = updateState(make(), "attendees", [
    person(),
    person("p2", "가상 이둘"),
  ]);
  s = updateState(s, "attendees", moveRow(s.attendees, "p2", -1));
  assert.equal(s.attendees[0].id, "p2");
  const fingerprint = rosterFingerprint(s);
  s.attendees[0].arrived = true;
  assert.equal(rosterFingerprint(s), fingerprint);
  s = updateState(
    s,
    "attendees",
    s.attendees.filter((p) => p.id !== "p1"),
  );
  assert.equal(normalizeState(s).attendees.length, 1);
  assert.deepEqual(moveRow(s.attendees, "missing", 1), s.attendees);
});
test("CSV round trip supports Korean BOM, commas, quotes, multiline cells and ignores blank rows", () => {
  const rows = [{ ...person(), note: '첫째 줄\n"둘째, 줄"' }];
  const csv = exportAttendeesCSV(rows);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const imported = importAttendeesCSV(csv + "\r\n\r\n");
  assert.equal(imported.attendees[0].note, rows[0].note);
  assert.equal(imported.attendees[0].name, rows[0].name);
});
test("CSV unknown columns ignored with disclosure, known aliases supported", () => {
  const result = importAttendeesCSV(
    "이름,직위,소속,예상밖,기관\r\n가상 김하나,팀장,가상 부서,제외,가상 기관",
  );
  assert.deepEqual(result.ignored, ["예상밖"]);
  assert.equal(result.attendees[0].title, "팀장");
  assert.equal(Object.hasOwn(result.attendees[0], "예상밖"), false);
});
test("CSV rejects malformed quotes, missing names, duplicate meaning headers, long and oversized input", () => {
  for (const csv of [
    '성명\n"가상',
    "기관\n가상",
    "성명,이름\n가상,가상",
    "성명,비고\n,메모",
    "성명\n가상,초과",
    "성명\n" + "가".repeat(81),
    '성명\n"가상"x',
  ])
    assert.throws(() => importAttendeesCSV(csv));
  assert.throws(() => importAttendeesCSV("x".repeat(CSV_LIMIT + 1)));
  assert.throws(() =>
    importAttendeesCSV("성명\n" + Array(301).fill("가상").join("\n")),
  );
});
test("CSV injection escaped at export for = + - @ and leading whitespace/control, UI escapes source", () => {
  for (const value of ["=1+1", "+cmd", "-1", "@SUM(A1)", " \t=1", "\r=1"]) {
    const csv = exportAttendeesCSV([{ ...person(), name: value }]);
    assert.ok(csv.includes("\"'" + value + '"'));
  }
  const s = make();
  s.attendees = [person("p1", "<img src=x onerror=alert(1)>")];
  assert.ok(attendeesView(s).includes("&lt;img"));
  assert.ok(!attendeesView(s).includes("<img src=x"));
});
test("nameplate CSV follows inspected positional parser: no header, exactly 3 columns, no embedded newlines", () => {
  const csv = exportAttendeesCSV(
    [{ ...person(), org: "가상\n부서" }],
    "nameplate",
  );
  assert.equal(csv.split("\r\n").length, 1);
  assert.ok(csv.startsWith('\uFEFF"가상 김하나","가상 부서","가상 팀장"'));
  assert.ok(!csv.includes('"이름"'));
});
test("attendee changes reopen only related artifacts; unrelated screen stays complete", () => {
  let s = updateState(make(), "attendees", [person()]);
  s = updateState(s, "parkingStatus", "done");
  done(s);
  s = updateState(s, "attendees", [{ ...s.attendees[0], title: "가상 부장" }]);
  for (const id of [
    "seat",
    "nameplate-file",
    "nameplate-placement",
    "food-count",
    "food-order",
    "parking-registration",
    "attendee-intro",
    "operation-pack",
    "material-mou-introduce",
    "material-mou-photo",
  ])
    assert.equal(s.checks[id].status, "todo", id);
  for (const id of [
    "seats",
    "nameplates",
    "parking-registration",
    "photo",
    "food",
  ])
    assert.equal(s.onsiteChecks[id].status, "todo", id);
  assert.equal(s.parkingStatus, "unknown");
  assert.equal(s.checks["output-welcome-file"].status, "done");
  assert.equal(s.onsiteChecks["output-welcome"].status, "done");
  assert.equal(s.checks.venue.status, "done");
});
test("cue draft uses edited selected agenda titles only; never invents time, owner or actions", () => {
  let s = make();
  s.agenda[0].title = "가상 개회";
  s.agenda[1].included = false;
  s.cues = cuesFromAgenda(s);
  s.cueBasis = cueSignature(s);
  assert.equal(s.cues.length, 7);
  assert.equal(s.cues[0].title, "가상 개회");
  assert.ok(s.cues.every((r) => !r.time && !r.owner && !r.action && !r.note));
  assert.equal(cueStale(s), false);
  const old = structuredClone(s.cues);
  s = updateState(s, "agenda", s.agenda.slice(1));
  assert.ok(cueStale(s));
  assert.deepEqual(s.cues, old);
});
test("cue CRUD/order and HH:MM validation; time reversal warning is non-destructive", () => {
  for (const value of ["", "00:00", "23:59", "09:05"])
    assert.ok(validTime(value));
  for (const value of ["24:00", "9:05", "12:60", "abcd"])
    assert.equal(validTime(value), false);
  const cues = [
    { ...newCue("a"), time: "14:00" },
    { ...newCue("b"), time: "" },
    { ...newCue("c"), time: "13:00" },
  ];
  const before = JSON.stringify(cues);
  assert.equal(timeWarnings(cues).length, 1);
  assert.equal(JSON.stringify(cues), before);
  assert.equal(moveRow(cues, "c", -1)[1].id, "c");
  assert.throws(() =>
    normalizeRows([{ ...newCue("a"), time: "99:00" }], "cues", true),
  );
});
test("date/location changes preserve custom cue content and mark stale", () => {
  for (const [key, value] of [
    ["date", "2026-10-01T14:00"],
    ["venue", "history"],
    ["venueDetail", "가상 회의실"],
  ]) {
    let s = make();
    s.cues = [
      {
        ...newCue("q1"),
        title: "가상 영접",
        time: "13:00",
        owner: "가상팀",
        action: "가상 안내",
      },
    ];
    s.cueBasis = cueSignature(s);
    const old = structuredClone(s.cues);
    s = updateState(s, key, value);
    assert.ok(cueStale(s));
    assert.deepEqual(s.cues, old);
  }
});
test("JSON round trip restores full roster, notes, cue times, roles and compatible completion", () => {
  let s = make();
  s = updateState(s, "attendees", [person()]);
  s = updateState(s, "cues", [
    {
      ...newCue("c1"),
      time: "14:05",
      title: "가상 업무",
      owner: "가상팀",
      action: "가상 준비",
    },
  ]);
  s.cueBasis = cueSignature(s);
  s.roles = { lead: "가상 총괄팀" };
  s.afterNote = "가상 다음 행사 메모";
  s.parkingStatus = "done";
  s = reconcile(s);
  done(s);
  const restored = read(exportEventJSON(s));
  assert.deepEqual(restored.attendees, s.attendees);
  assert.deepEqual(restored.cues, s.cues);
  assert.deepEqual(restored.roles, s.roles);
  assert.deepEqual(restored.checks, s.checks);
  assert.equal(restored.afterNote, s.afterNote);
});
test("JSON rejects corrupt/foreign/future versions, unsafe structures, invalid types and invalid enum without changing input", () => {
  const state = make(),
    before = JSON.stringify(state),
    good = JSON.parse(exportEventJSON(state));
  for (const text of [
    "{broken",
    "[]",
    '{"app":"other"}',
    JSON.stringify({ ...good, schemaVersion: 6 }),
    ' {"__proto__":{"polluted":true}}',
    JSON.stringify({ ...good, state: { ...good.state, attendees: "bad" } }),
    JSON.stringify({ ...good, state: { ...good.state, vip: "maybe" } }),
    JSON.stringify({
      ...good,
      state: { ...good.state, date: "2026-02-31T00:00" },
    }),
    JSON.stringify({
      ...good,
      state: { ...good.state, eventName: "x".repeat(161) },
    }),
  ])
    assert.throws(() => read(text));
  assert.equal(JSON.stringify(state), before);
  assert.equal({}.polluted, undefined);
  assert.throws(() => read("x".repeat(JSON_LIMIT + 1)));
  const bad = JSON.stringify(good).replace(
    '"roles":{}',
    '"roles":{"constructor":{}}',
  );
  assert.throws(() => read(bad));
});
test("JSON rejects duplicate/invalid roster IDs, cue types and malformed check state", () => {
  const base = JSON.parse(exportEventJSON(make()));
  for (const patch of [
    { attendees: [person(), person()] },
    { attendees: [person("__proto__")] },
    { cues: [{ ...newCue("x"), owner: 42 }] },
    { checks: { x: { status: "done", signature: [] } } },
    { cues: [{ ...newCue("x"), time: "25:00" }] },
  ])
    assert.throws(() =>
      read(JSON.stringify({ ...base, state: { ...base.state, ...patch } })),
    );
});
test("duplicating clears all completion/date/arrival/assignments but preserves structures and optional roster", () => {
  let s = make();
  s = updateState(s, "attendees", [{ ...person(), arrived: true }]);
  s.cues = [
    { ...newCue("c"), time: "09:00", owner: "가상 담당", action: "가상 준비" },
  ];
  s.date = "2026-10-01T09:00";
  s.roles = { lead: "가상팀" };
  s.foodTime = "08:30";
  s.afterNote = "지난 메모";
  s.parkingStatus = "done";
  s = reconcile(s);
  done(s);
  for (const keep of [true, false]) {
    const clone = duplicateEvent(s, keep, normalizeState);
    assert.equal(clone.date, "");
    assert.equal(clone.venue, s.venue);
    assert.deepEqual(
      clone.agenda,
      s.agenda.map((a) => ({ ...a, role: "" })),
    );
    assert.deepEqual(clone.outputs, s.outputs);
    assert.equal(clone.attendees.length, keep ? 1 : 0);
    assert.ok(clone.attendees.every((p) => !p.arrived));
    assert.equal(clone.cues[0].action, "가상 준비");
    assert.equal(clone.cues[0].time, "");
    assert.equal(clone.cues[0].owner, "");
    assert.deepEqual(clone.roles, {});
    assert.equal(clone.parkingStatus, "unknown");
    for (const key of ["checks", "onsiteChecks", "afterChecks"])
      assert.ok(Object.values(clone[key]).every((c) => c.status === "todo"));
  }
  assert.equal(s.attendees[0].arrived, true);
});
test("operation packet is conditional, escaped and contains contacts/roster/cues without VIP request for non-VIP", () => {
  let s = make();
  s.attendees = [person()];
  s.cues = [{ ...newCue("c"), title: "<script>alert(1)</script>" }];
  s.vip = "no";
  s = reconcile(s);
  const html = packetView(s, buildChecklist(s));
  for (const value of [
    "가상 김하나",
    "4415 / 4418",
    "4289",
    "진행 큐시트",
    "외부 참석자 / 주차",
    "다과·식사",
    "보도자료 제출",
  ])
    assert.ok(html.includes(value), value);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("촬영·취재 요청"));
  s.attendees = [];
  s.cues = [];
  s.food = "none";
  s.external = "no";
  s.publicity = "none";
  const minimal = packetView(s, []);
  assert.ok(!minimal.includes("<h2>참석자"));
  assert.ok(!minimal.includes("<h2>진행 큐시트"));
  assert.ok(!minimal.includes("<h2>다과"));
});
test("day mode offers direct attendees/cues/roles/checks and no network data links", () => {
  const s = make();
  s.attendees = [person()];
  const html = dayView(s, "attendees", false);
  assert.ok(html.includes('data-arrived="p1"'));
  assert.ok(html.includes("가상 김하나"));
  for (const key of ["agenda", "cues", "roles", "onsite"])
    assert.ok(html.includes(`data-day="${key}"`));
  assert.ok(!html.includes("postMessage"));
});
test("localStorage retains V0.5 and bounded maximums fit JSON file limit", () => {
  const s = make();
  s.attendees = Array.from({ length: 300 }, (_, i) => ({
    ...person("p" + i),
    note: "가".repeat(500),
  }));
  s.cues = Array.from({ length: 150 }, (_, i) => ({
    ...newCue("c" + i),
    action: "가".repeat(1000),
    note: "가".repeat(500),
  }));
  const normalized = reconcile(s);
  const store = new Map();
  const storage = {
    setItem: (k, v) => store.set(k, v),
    getItem: (k) => store.get(k),
  };
  assert.ok(saveState(storage, normalized));
  assert.equal(loadState(storage).state.attendees.length, 300);
  assert.ok(
    new TextEncoder().encode(exportEventJSON(normalized)).length < JSON_LIMIT,
  );
  assert.equal(read(exportEventJSON(normalized)).cues.length, 150);
});
test("JSON saves and restores roles entered in any order without resetting compatible checks", () => {
  let s = make();
  s.roles = { host: "가상 사회팀", lead: "가상 총괄팀" };
  s.parkingStatus = "done";
  s = reconcile(s);
  done(s);
  const restored = read(exportEventJSON(s));
  assert.deepEqual(restored.roles, s.roles);
  assert.deepEqual(restored.onsiteChecks, s.onsiteChecks);
  assert.deepEqual(restored.checks, s.checks);
  const payload = JSON.parse(exportEventJSON(s));
  payload.state.attendees = [
    {
      name: "가상",
      arrived: false,
      note: "",
      title: "",
      org: "",
      group: "",
      id: "p1",
    },
  ];
  assert.equal(read(JSON.stringify(payload)).attendees[0].name, "가상");
});
test("cue edit reopens latest cue field check but preserves unrelated physical venue check", () => {
  let s = make();
  s = updateState(s, "cues", [{ ...newCue("q1"), title: "가상 준비" }]);
  done(s);
  s = updateState(s, "cues", [{ ...s.cues[0], action: "가상 변경" }]);
  assert.equal(s.onsiteChecks.cue.status, "todo");
  assert.equal(s.onsiteChecks.place.status, "done");
  assert.equal(s.checks["operation-pack"].status, "todo");
});
test("manually starting a cue sheet is current, and changing time/place reopens arrival confirmations", () => {
  let s = make();
  s = updateState(s, "cues", [{ ...newCue("q1"), title: "가상 회의 준비" }]);
  assert.equal(cueStale(s), false);
  s.attendees = [{ ...person(), arrived: true }];
  s = updateState(s, "date", "2026-10-22T14:00");
  assert.equal(s.attendees[0].arrived, false);
  s.attendees[0].arrived = true;
  s = updateState(s, "attendees", [{ ...s.attendees[0], name: "가상 변경" }]);
  assert.equal(s.attendees[0].arrived, false);
});
