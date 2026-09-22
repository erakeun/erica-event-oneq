import test from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  reconcile,
  updateState,
  normalizeState,
  defaultAgenda,
  buildChecklist,
} from "../app.js";
import {
  buildOnsite,
  buildAfter,
  invitationText,
  unresolved,
  assignedRoles,
  fieldSummary,
  matches,
} from "../operations.js";
import { LEGACY_AGENDAS } from "../legacy-agendas.js";
import { EVENTS, VENUES } from "../data.js";
const make = (values) => reconcile({ ...createState(), ...values });
const ids = (s) => buildOnsite(s).map((i) => i.id);
test("V0.3 A: rich MOU field work, roles and aftercare are conditional", () => {
  const s = make({
    event: "mou",
    agenda: defaultAgenda("mou"),
    venue: "prime",
    external: "yes",
    vip: "yes",
    seating: "needed",
    nameplates: "needed",
    outputs: ["welcome"],
    food: "snacks",
    roles: { lead: "가상 총괄" },
    audio: "needed",
  });
  for (const id of [
    "place",
    "seats",
    "nameplates",
    "audio",
    "agenda",
    "vip",
    "photo",
    "guests",
    "food",
    "mou-docs",
    "mou-flow",
    "output-welcome",
  ])
    assert.ok(ids(s).includes(id), id);
  assert.equal(assignedRoles(s).length, 1);
  assert.ok(buildAfter(s).some((i) => i.id === "photos"));
  s.checks["food-order"].status = "done";
  assert.equal(s.onsiteChecks.food.status, "todo");
});
test("V0.3 B: simple meeting removes guest/food/media questions and field tasks", () => {
  const s = make({
    event: "meeting",
    agenda: defaultAgenda("meeting"),
    venue: "seoul",
    external: "no",
    food: "none",
    vip: "no",
    seating: "none",
    nameplates: "none",
    outputDecision: "none",
    publicity: "none",
    photography: "none",
    audio: "none",
  });
  assert.deepEqual(ids(s), ["place", "agenda", "meeting"]);
  assert.equal(assignedRoles(s).length, 0);
  assert.equal(invitationText(s), "");
  assert.ok(!buildChecklist(s).some((i) => /^(guest|food|photo)/.test(i.id)));
});
test("V0.3 C/D: awards and donation need selected materials; undecided is not done", () => {
  for (const [event, id] of [
    ["award", "award"],
    ["donation", "donation"],
  ]) {
    const s = make({
      event,
      agenda: defaultAgenda(event),
      external: "unknown",
      food: "unknown",
    });
    assert.ok(ids(s).includes(id));
    assert.ok(!ids(s).includes("food"));
    assert.ok(
      unresolved(s).some(
        (i) => i.label === "外部 참석 여부".replace("外部", "외부"),
      ),
    );
    const empty = updateState(
      s,
      "agenda",
      s.agenda.map((a) => ({ ...a, included: false })),
    );
    assert.ok(!ids(empty).includes(id));
  }
});
test("V0.3 invitation excludes missing values, hidden notes and unconfirmed defaults", () => {
  const s = make({
    external: "yes",
    eventName: "가상 행사",
    parkingNote: "숨겨진 주차 정보",
  });
  assert.equal(invitationText(s), "[가상 행사 안내]");
  const complete = make({
    ...s,
    date: "2026-10-01T10:00",
    venue: "department",
    otherVenue: "가상 회의실",
    venueDetail: "2층",
    guestNeeds: ["arrival"],
    arrivalNote: "09:50 도착 요청",
  });
  assert.equal(
    invitationText(complete),
    "[가상 행사 안내]\n일시: 2026-10-01 10:00\n장소: 가상 회의실 · 2층\n도착 안내: 09:50 도착 요청",
  );
});
test("V0.3 relevant field checks reset, unrelated checks persist, removed work cannot resurrect", () => {
  let s = make({
    food: "snacks",
    external: "yes",
    venue: "prime",
    seating: "needed",
  });
  for (const v of Object.values(s.onsiteChecks)) v.status = "done";
  s = updateState(s, "venue", "seoul");
  assert.equal(s.onsiteChecks.place.status, "todo");
  assert.equal(s.onsiteChecks.agenda.status, "done");
  s.onsiteChecks.food.status = "done";
  s = updateState(s, "food", "none");
  assert.ok(!s.onsiteChecks.food);
  s = updateState(s, "food", "snacks");
  assert.equal(s.onsiteChecks.food.status, "todo");
  s.onsiteChecks.food.status = "done";
  s = updateState(s, "foodTime", "12:30");
  assert.equal(s.onsiteChecks.food.status, "todo");
});
test("V0.3 backward migration preserves V0.2 data and never invents field completion", () => {
  let old = make({ eventName: "가상 이전 행사" });
  old.version = 2;
  old.checks.agenda.status = "done";
  delete old.onsiteChecks;
  const s = normalizeState(old);
  assert.equal(s.version, 5);
  assert.equal(s.checks.agenda.status, "done");
  assert.ok(Object.values(s.onsiteChecks).every((v) => v.status === "todo"));
  assert.equal(s.external, "unknown");
});
test("V0.3 corrupt nested and overlong data normalize safely", () => {
  const s = normalizeState({
    ...createState(),
    roles: { lead: "가".repeat(100), other: {} },
    guestNeeds: ["evil", "parking", "parking"],
    foodPeople: "-3",
    diet: "yes",
    onsiteChecks: { place: { status: "done", signature: "bad" } },
  });
  assert.equal(s.roles.lead.length, 60);
  assert.ok(!s.roles.other);
  assert.deepEqual(s.guestNeeds, ["parking"]);
  assert.equal(s.foodPeople, "");
  assert.equal(s.diet, false);
  assert.equal(s.onsiteChecks.place.status, "todo");
});
test("V0.3 aftercare choices add only relevant work and preserve memo", () => {
  let s = make({
    food: "none",
    photography: "none",
    publicity: "none",
    borrowed: "no",
    followupAdmin: "no",
    afterNote: "가상 메모",
  });
  assert.deepEqual(
    buildAfter(s).map((i) => i.id),
    ["archive"],
  );
  s = updateState(s, "borrowed", "yes");
  assert.ok(buildAfter(s).some((i) => i.id === "return"));
  assert.equal(normalizeState(s).afterNote, "가상 메모");
});
test("V0.3 field summary includes only entered roles and incomplete checks", () => {
  const s = make({ roles: { lead: "가상 담당" }, eventName: "가상 행사" });
  s.onsiteChecks.place.status = "done";
  const text = fieldSummary(s);
  assert.ok(text.includes("총괄: 가상 담당"));
  assert.ok(!text.includes("사회 / 진행:"));
  assert.ok(!text.includes("행사 장소가 실제로"));
});
test("V0.3 450 venue/event/guest/food combinations have stable unique IDs and serialization", () => {
  for (const venue of VENUES)
    for (const event of EVENTS)
      for (const external of ["yes", "no", "unknown"])
        for (const food of ["none", "snacks", "meal", "both", "unknown"]) {
          const s = make({
            venue: venue.id,
            event: event.id,
            agenda: defaultAgenda(event.id),
            external,
            food,
          });
          assert.equal(new Set(ids(s)).size, ids(s).length);
          assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(s))), s);
          assert.equal(ids(s).includes("guests"), external === "yes");
          assert.equal(ids(s).includes("food"), matches(s, "food"));
        }
});
test("V0.3 location changes clear stale room/parking information and recheck availability", () => {
  let s = make({
    venue: "department",
    otherVenue: "가상 A실",
    venueStatus: "secured",
    venueDetail: "1층",
    external: "yes",
    guestNeeds: ["parking"],
    parkingNote: "가상 주차 안내",
  });
  s = updateState(s, "otherVenue", "가상 B실");
  assert.equal(s.venueStatus, "unknown");
  assert.equal(s.venueDetail, "");
  assert.equal(s.parkingNote, "");
  s = updateState(s, "venue", "prime");
  assert.equal(s.otherVenue, "");
  assert.ok(!invitationText(s).includes("가상 B실"));
});
test("V0.3 exchange without signing still requires agreement documents; room change resets movement checks", () => {
  let s = make({
    event: "mou",
    agenda: LEGACY_AGENDAS.mou
      .map((a) => ({ ...a, included: true }))
      .map((a) => ({
        ...a,
        included: a.id === "exchange",
      })),
  });
  assert.ok(ids(s).includes("mou-docs"));
  assert.ok(!ids(s).includes("mou-pen"));
  s = make({
    event: "award",
    agenda: defaultAgenda("award"),
    venueDetail: "1층",
  });
  s.onsiteChecks.award.status = "done";
  s = updateState(s, "venueDetail", "2층");
  assert.equal(s.onsiteChecks.award.status, "todo");
});

test("organizer: next work is limited to three remaining preparation tasks and updates after completion", async () => {
  const { nextPreparation } = await import("../operations.js");
  const s = make({ food: "snacks" });
  const items = buildChecklist(s);
  assert.deepEqual(
    nextPreparation(s, items).map((i) => i.id),
    ["date", "venue", "vip-confirm"],
  );
  s.checks.date.status = "done";
  s.checks.venue.status = "na";
  assert.ok(
    !nextPreparation(s, items).some((i) => ["date", "venue"].includes(i.id)),
  );
  for (const value of Object.values(s.checks)) value.status = "done";
  assert.deepEqual(nextPreparation(s, items), []);
});
test("organizer: field flow preserves selected order and omits excluded rows", async () => {
  const { fieldAgendaView } = await import("../operations-view.js");
  const s = make({
    event: "mou",
    agenda: defaultAgenda("mou")
      .reverse()
      .map((a) => ({ ...a, included: a.id !== "sign" })),
  });
  const html = fieldAgendaView(s);
  assert.ok(!html.includes("협약서 서명"));
  assert.ok(html.indexOf("폐회") < html.indexOf("개회"));
  assert.equal(
    fieldAgendaView({
      ...s,
      agenda: s.agenda.map((a) => ({ ...a, included: false })),
    }),
    "",
  );
});

test("campus: exact venue menus and no automatic place selection", async () => {
  const { venuesForCampus } = await import("../operations.js");
  let s = make({});
  assert.equal(s.campus, "");
  assert.deepEqual(venuesForCampus(s), []);
  s = updateState(s, "campus", "seoul");
  assert.deepEqual(
    venuesForCampus(s).map((v) => v.id),
    ["seoul", "department", "other", "unknown"],
  );
  assert.equal(s.venue, "unknown");
  s = updateState(s, "campus", "erica");
  assert.deepEqual(
    venuesForCampus(s).map((v) => v.id),
    ["prime", "history", "department", "other"],
  );
  assert.equal(s.venue, "unknown");
});
test("campus: old known venues infer campus; shared venues retain input without guessing", () => {
  for (const [venue, campus] of [
    ["seoul", "seoul"],
    ["prime", "erica"],
    ["history", "erica"],
    ["department", ""],
    ["other", ""],
    ["unknown", ""],
  ]) {
    const old = { ...createState(), venue, otherVenue: "가상 회의실" };
    delete old.campus;
    const s = normalizeState(old);
    assert.equal(s.campus, campus);
    assert.equal(s.otherVenue, "가상 회의실");
  }
  const s = updateState(
    make({ venue: "department", otherVenue: "가상 공유실" }),
    "campus",
    "seoul",
  );
  assert.equal(s.otherVenue, "가상 공유실");
  assert.equal(s.venue, "department");
});
test("campus: changing campus clears old place information and relevant checks, preserves event and roles", () => {
  let s = make({
    campus: "seoul",
    vip: "yes",
    venue: "department",
    otherVenue: "가상 A실",
    venueDetail: "2층",
    venueStatus: "secured",
    parkingNote: "가상 주차",
    foodPlace: "가상 테이블",
    food: "snacks",
    seating: "needed",
    roles: { lead: "가상 총괄" },
    eventName: "가상 행사",
  });
  s.checks.seat.status = "done";
  s.checks["press-request"].status = "done";
  s.checks.agenda.status = "done";
  s.onsiteChecks.place.status = "done";
  s.onsiteChecks.agenda.status = "done";
  s = updateState(s, "campus", "erica");
  assert.equal(s.venue, "unknown");
  assert.equal(s.venueStatus, "unknown");
  for (const f of ["otherVenue", "venueDetail", "parkingNote", "foodPlace"])
    assert.equal(s[f], "");
  assert.equal(s.checks.seat.status, "todo");
  assert.equal(s.checks["press-request"].status, "todo");
  assert.equal(s.onsiteChecks.place.status, "todo");
  assert.equal(s.checks.agenda.status, "done");
  assert.equal(s.onsiteChecks.agenda.status, "done");
  assert.equal(s.roles.lead, "가상 총괄");
  assert.equal(s.eventName, "가상 행사");
});
test("campus: shared venue invitations name the campus and incompatible stored venues are cleared", () => {
  let s = make({
    campus: "seoul",
    venue: "department",
    otherVenue: "가상 회의실",
    external: "yes",
  });
  assert.match(invitationText(s), /서울캠퍼스 · 가상 회의실/);
  s = normalizeState({
    ...s,
    campus: "erica",
    venue: "seoul",
    venueStatus: "secured",
    venueDetail: "옛 회의실",
  });
  assert.equal(s.venue, "unknown");
  assert.equal(s.venueDetail, "");
  assert.equal(s.campus, "erica");
});
