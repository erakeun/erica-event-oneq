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
  assert.equal(s.version, 3);
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
    agenda: defaultAgenda("mou").map((a) => ({
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
