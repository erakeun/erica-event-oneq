import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  createState,
  reconcile,
  normalizeState,
  updateState,
  buildChecklist,
  verifyTemplate,
} from "../app.js";
import {
  defaultAgenda,
  selectedAgenda,
  newAgendaRow,
  editAgendaRow,
  scenarioText,
  normalizeAgenda,
} from "../agenda.js";
import { buildOnsite, buildAfter, invitationText } from "../operations.js";
import { fieldAgendaView } from "../operations-view.js";
import { EVENTS, VENUES, TEMPLATES } from "../data.js";
import { LEGACY_AGENDAS } from "../legacy-agendas.js";
const make = (event = "mou") =>
  reconcile({ ...createState(), event, agenda: defaultAgenda(event) });
test("V0.4 source-based MOU and donation each have the requested eight steps", () => {
  assert.deepEqual(
    defaultAgenda("mou").map((a) => a.title),
    [
      "개회사",
      "참석자 소개",
      "환영사",
      "답사",
      "협약기관 소개",
      "협약서 서명 및 교환",
      "기념촬영",
      "폐회사",
    ],
  );
  assert.deepEqual(
    defaultAgenda("donation").map((a) => a.title),
    [
      "개회",
      "내외빈 소개",
      "환영사",
      "답사",
      "기부사 및 기부 배경 소개",
      "기부금 및 감사패 전달",
      "기념촬영",
      "오찬 및 환송",
    ],
  );
});
test("V0.4 add, rename, role, memo, reorder and delete stay consistent after reload", () => {
  let s = make();
  s = updateState(s, "agenda", [...s.agenda, newAgendaRow("custom-test")]);
  assert.match(scenarioText(s), /진행 멘트를 직접 작성하세요/);
  for (const [field, value] of [
    ["title", "추가 순서"],
    ["role", "가상 안내팀"],
    ["script", "[안내 장소]로 이동해 주세요."],
    ["check", "이동 방향 확인"],
  ])
    s = updateState(s, "agenda", editAgendaRow(s, "custom-test", field, value));
  s = updateState(s, "agenda", [
    s.agenda.at(-1),
    ...s.agenda.slice(0, -1).filter((a) => a.id !== "reply"),
  ]);
  s.checks.agenda.status = "done";
  s.onsiteChecks.agenda.status = "done";
  const restored = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(restored, s);
  assert.equal(selectedAgenda(restored)[0].title, "추가 순서");
  assert.ok(!scenarioText(restored).includes("답사"));
  assert.match(scenarioText(restored), /가상 안내팀/);
  assert.ok(
    !buildChecklist(restored).some((i) => i.id === "material-mou-reply"),
  );
  assert.ok(buildChecklist(restored).some((i) => i.title === "추가 순서 준비"));
  assert.match(fieldAgendaView(restored), /추가 순서/);
  s = updateState(
    restored,
    "agenda",
    editAgendaRow(restored, "custom-test", "script", "진행 변경"),
  );
  assert.equal(s.checks.agenda.status, "todo");
  assert.equal(s.onsiteChecks.agenda.status, "todo");
});
test("V0.4 empty and removed agenda rows never resurrect on reload", () => {
  let s = make();
  s = updateState(s, "agenda", []);
  assert.deepEqual(normalizeState(s).agenda, []);
  assert.ok(!buildOnsite(s).some((i) => i.id === "agenda"));
  assert.ok(!buildChecklist(s).some((i) => i.id.startsWith("material-")));
});
test("V0.4 V0.3 ID-only MOU migration keeps its old titles, order and exclusions across repeated reload", () => {
  const legacy = LEGACY_AGENDAS.mou
    .map((a) => ({ id: a.id, included: a.id !== "sign" }))
    .reverse();
  const raw = {
    ...createState(),
    version: 3,
    event: "mou",
    agenda: legacy,
    external: "yes",
    food: "snacks",
    roles: { lead: "가상 팀" },
    afterNote: "유지",
  };
  let s = normalizeState(raw);
  assert.deepEqual(
    s.agenda.map((a) => a.id),
    legacy.map((a) => a.id),
  );
  assert.equal(
    s.agenda.find((a) => a.id === "exchange").title,
    "교환·기념촬영",
  );
  assert.equal(s.agenda.find((a) => a.id === "sign").included, false);
  assert.equal(s.roles.lead, "가상 팀");
  assert.equal(s.afterNote, "유지");
  assert.ok(s.agendaMigrated);
  assert.deepEqual(normalizeState(s), s);
});
test("V0.4 malformed custom row data is bounded and safe at HTML consumers", () => {
  const raw = [
    {
      id: "custom-x",
      title: "<img src=x onerror=alert(1)>",
      role: "<b>team</b>",
      script: "x".repeat(3000),
    },
    { id: 'bad"><script>', title: "bad" },
    { id: "custom-x" },
    { id: "fake" },
  ];
  let s = make();
  s.agenda = normalizeAgenda(raw, "mou", 4);
  s = reconcile(s);
  assert.equal(s.agenda.length, 1);
  assert.equal(s.agenda[0].script.length, 2400);
  assert.ok(!fieldAgendaView(s).includes("<img"));
  assert.match(fieldAgendaView(s), /&lt;img/);
  assert.equal(
    normalizeAgenda(
      Array.from({ length: 80 }, (_, i) => newAgendaRow(`custom-${i}`)),
      "mou",
      4,
    ).length,
    50,
  );
});
test("V0.4 parking requires external guests, maps explicit states and resets when place/date changes", () => {
  for (const external of ["yes", "no", "unknown"])
    for (const parkingStatus of ["done", "pending", "na", "unknown"]) {
      let s = reconcile({ ...make(), external, parkingStatus });
      assert.equal(!!s.checks["parking-registration"], external === "yes");
      assert.equal(
        buildOnsite(s).some((i) => i.id === "parking-registration"),
        external === "yes" && parkingStatus !== "na",
      );
      if (external === "yes")
        assert.equal(
          s.checks["parking-registration"].status,
          parkingStatus === "done"
            ? "done"
            : parkingStatus === "na"
              ? "na"
              : "todo",
        );
    }
  let s = reconcile({
    ...make(),
    external: "yes",
    parkingStatus: "done",
    venue: "prime",
  });
  s.onsiteChecks["parking-registration"].status = "done";
  s = updateState(s, "venue", "history");
  assert.equal(s.parkingStatus, "unknown");
  assert.equal(s.onsiteChecks["parking-registration"].status, "todo");
  s = updateState(s, "parkingStatus", "done");
  s = updateState(s, "date", "2026-10-10T12:00");
  assert.equal(s.parkingStatus, "unknown");
});
test("V0.4 press strictly follows senior attendance, publicity is independent", () => {
  for (const vip of ["yes", "no", "unknown"]) {
    const s = reconcile({
      ...make(),
      vip,
      publicity: "needed",
      photography: "needed",
    });
    const items = buildChecklist(s);
    assert.equal(
      items.some((i) => i.link === "press"),
      vip === "yes",
    );
    assert.ok(items.some((i) => i.link === "pr"));
    assert.equal(
      items.some((i) => i.id === "vip-confirm"),
      vip === "unknown",
    );
  }
});
test("V0.4 only supplied venue phone information is registered", () => {
  const prime = VENUES.find((v) => v.id === "prime"),
    history = VENUES.find((v) => v.id === "history"),
    seoul = VENUES.find((v) => v.id === "seoul");
  assert.equal(prime.rental.contact, "교내전화 4415 / 4418");
  assert.equal(prime.setupContact, "교내전화 4289");
  assert.equal(history.rental.contact, prime.rental.contact);
  assert.equal(history.setupContact, undefined);
  assert.equal(seoul.rental.contact, null);
});
test("V0.4 actual HWP bytes match the untouched user-provided originals", async () => {
  for (const [event, hash] of Object.entries({
    mou: "2d9cc6fde5aca760782132d3649cd844944c3963e5a4733f0fed6eccc0f2d226",
    donation:
      "d391857ee16550d4dc228b3eb2b2e0c61cb940f24a7ec484c8c6b896682a4e13",
  })) {
    const t = TEMPLATES.find((t) => t.id === `agenda-${event}`),
      bytes = await readFile(new URL(`../${t.path}`, import.meta.url));
    assert.equal(t.status, "real");
    assert.equal(t.format, "hwp");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), hash);
    assert.equal(
      (await verifyTemplate(t, async () => new Response(bytes))).ready,
      true,
    );
  }
});

test("V0.4 fifty long scripts fit comfortably in browser storage without repeated full-text signatures", () => {
  const s = reconcile({
    ...make(),
    agenda: Array.from({ length: 50 }, (_, i) => ({
      ...newAgendaRow(`custom-${i}`),
      title: `순서 ${i}`,
      script: "가".repeat(2400),
      check: "나".repeat(600),
      role: "다".repeat(160),
    })),
  });
  assert.ok(JSON.stringify(s).length < 250000);
  assert.deepEqual(normalizeState(s), s);
  const next = updateState(
    s,
    "agenda",
    editAgendaRow(s, "custom-49", "script", "다른 멘트"),
  );
  assert.notEqual(s.checks.agenda.signature, next.checks.agenda.signature);
});
