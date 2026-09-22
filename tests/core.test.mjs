import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createState,
  updateState,
  reconcile,
  buildChecklist,
  defaultAgenda,
  loadState,
  saveState,
  clearState,
  validPeople,
  normalizeState,
  verifyTemplate,
} from "../app.js";
import { STORAGE_KEY, EVENTS, TEMPLATES, LINKS } from "../data.js";
const make = (values) =>
  reconcile(
    Object.assign(
      createState(),
      { seating: "needed", publicity: "needed" },
      values,
    ),
  );
const ids = (s) => buildChecklist(s).map((i) => i.id);
const mark = (s, id, status = "done") => {
  s.checks[id].status = status;
  return s;
};
const store = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
    map,
  };
};
test("A: PRIME + MOU + VIP: seat, separate request/support, MOU materials", () => {
  const s = make({
    venue: "prime",
    event: "mou",
    agenda: defaultAgenda("mou"),
    vip: "yes",
    nameplates: "needed",
  });
  for (const id of [
    "seat",
    "press-request",
    "press-support",
    "material-mou-sign",
    "nameplate-file",
    "nameplate-placement",
  ])
    assert.ok(ids(s).includes(id));
  assert.equal(TEMPLATES.filter((t) => t.events.includes("mou")).length, 4);
});
test("B: department + meeting + no VIP: no rental/press, nameplates independent", () => {
  const s = make({
    venue: "department",
    event: "meeting",
    agenda: defaultAgenda("meeting"),
    vip: "no",
    nameplates: "needed",
  });
  assert.ok(!ids(s).includes("rental"));
  assert.ok(!ids(s).includes("press-request"));
  assert.ok(!ids(s).includes("self-photo"));
  assert.ok(ids(s).includes("nameplate-file"));
});
test("C: history + donation + undecided VIP retains attendance task", () => {
  const s = make({
    venue: "history",
    event: "donation",
    agenda: defaultAgenda("donation"),
  });
  assert.ok(ids(s).includes("vip-confirm"));
  assert.ok(ids(s).includes("material-donation-handover"));
  assert.equal(buildChecklist(s).find((i) => i.id === "seat")?.link, null);
});
test("D: other + awards + no nameplates removes every nameplate item", () => {
  const s = make({
    venue: "other",
    event: "award",
    agenda: defaultAgenda("award"),
    nameplates: "none",
  });
  assert.ok(ids(s).includes("material-award-present"));
  assert.ok(!ids(s).some((id) => id.startsWith("nameplate")));
  assert.equal(buildChecklist(s).find((i) => i.id === "seat")?.link, null);
});
test("E: no basic information and undecided venue yields usable checklist", () => {
  const s = make({});
  assert.ok(ids(s).includes("venue"));
  assert.ok(ids(s).includes("date"));
  assert.ok(ids(s).includes("pr-submit"));
  assert.ok(buildChecklist(s).length > 0);
});
test("F: venue changes invalidate related checks, preserve unrelated checks/inputs", () => {
  let s = make({
    venue: "prime",
    venueStatus: "secured",
    nameplates: "needed",
    eventName: "그대로 보존",
    outputs: ["welcome"],
    outputDecision: "chosen",
  });
  for (const id of [
    "venue",
    "seat",
    "nameplate-file",
    "output-welcome-file",
    "pr-submit",
    "agenda",
  ])
    mark(s, id);
  s = updateState(s, "venue", "history");
  assert.equal(s.venueStatus, "unknown");
  assert.equal(s.eventName, "그대로 보존");
  for (const id of ["venue", "nameplate-file", "output-welcome-file"])
    assert.equal(s.checks[id].status, "todo");
  assert.equal(s.checks["pr-submit"].status, "done");
  assert.equal(s.checks.agenda.status, "done");
  assert.equal(s.checks.seat.status, "todo");
});
test("F: event and VIP changes remove stale tasks and do not resurrect completed checks", () => {
  let s = make({
    event: "mou",
    agenda: defaultAgenda("mou"),
    vip: "yes",
    eventName: "유지",
  });
  mark(s, "material-mou-sign");
  mark(s, "roles");
  mark(s, "agenda");
  mark(s, "press-request");
  mark(s, "pr-submit");
  s = updateState(s, "event", "meeting");
  assert.ok(!s.checks["material-mou-sign"]);
  assert.equal(s.checks.roles.status, "todo");
  assert.equal(s.checks.agenda.status, "todo");
  assert.equal(s.checks["pr-submit"].status, "done");
  s = updateState(s, "vip", "unknown");
  assert.ok(!s.checks["press-request"]);
  assert.ok(s.checks["vip-confirm"]);
  s = updateState(s, "vip", "yes");
  assert.equal(s.checks["press-request"].status, "todo");
  assert.equal(s.eventName, "유지");
});
test("agenda exclude/reorder prunes ghost rows and invalidates flow checks", () => {
  let s = make({ event: "mou", agenda: defaultAgenda("mou") });
  mark(s, "agenda");
  mark(s, "material-mou-sign");
  s = updateState(
    s,
    "agenda",
    s.agenda.map((a) => (a.id === "sign" ? { ...a, included: false } : a)),
  );
  assert.ok(!s.checks["material-mou-sign"]);
  assert.equal(s.checks.agenda.status, "todo");
  mark(s, "agenda");
  s = updateState(s, "agenda", [...s.agenda].reverse());
  assert.equal(s.checks.agenda.status, "todo");
});
test("nameplate and output deselection prunes completed ghost items", () => {
  let s = make({
    nameplates: "needed",
    outputs: ["welcome", "led"],
    outputDecision: "chosen",
  });
  mark(s, "nameplate-file");
  mark(s, "output-led-file");
  s = updateState(s, "nameplates", "none");
  s = updateState(s, "outputs", ["welcome"]);
  assert.ok(!s.checks["nameplate-file"]);
  assert.ok(!s.checks["output-led-file"]);
  assert.ok(s.checks["output-welcome-onsite"]);
});
test("G: navigation does not complete tasks; links contain no user-input parameters", () => {
  let s = make({});
  s = updateState(s, "step", 6);
  assert.ok(Object.values(s.checks).every((c) => c.status === "todo"));
  for (const link of Object.values(LINKS)) {
    const u = new URL(link.url);
    assert.equal(u.protocol, "https:");
    assert.equal(u.search, "");
  }
});
test("H: missing, unsafe, nonexistent, HTML fallback and network-failed files stay disabled", async () => {
  assert.equal((await verifyTemplate(null)).ready, false);
  for (const path of [
    "../secret.hwp",
    "assets/templates/../x.hwp",
    "https://host/file.hwp",
    "assets/templates/%2e%2e/x.hwp",
    "assets/templates/x.txt",
  ])
    assert.equal((await verifyTemplate(path)).ready, false);
  assert.equal(
    (
      await verifyTemplate("assets/templates/missing.hwp", async () => ({
        ok: false,
      }))
    ).ready,
    false,
  );
  assert.equal(
    (
      await verifyTemplate(
        "assets/templates/html.hwp",
        async () => new Response("<html>fallback</html>"),
      )
    ).ready,
    false,
  );
  assert.equal(
    (
      await verifyTemplate("assets/templates/offline.hwp", async () => {
        throw new Error("offline");
      })
    ).ready,
    false,
  );
});
test("H: simulated valid compound-file response activates a validated relative HWP path", async () => {
  // In-memory response only. This is not a real HWP and is never written to deployable assets.
  const bytes = new Uint8Array(512);
  bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  let requested;
  const result = await verifyTemplate(
    "assets/templates/fixture.hwp",
    async (path) => {
      requested = path;
      return new Response(bytes);
    },
  );
  assert.deepEqual(result, {
    ready: true,
    path: "./assets/templates/fixture.hwp",
  });
  assert.equal(requested, "./assets/templates/fixture.hwp");
});
test("I: save/restore/reset preserves another application storage key", () => {
  const storage = store();
  storage.setItem("other-tool", "keep");
  const s = make({ eventName: "저장 확인" });
  mark(s, "pr-submit");
  assert.ok(saveState(storage, s));
  const loaded = loadState(storage).state;
  assert.equal(loaded.eventName, "저장 확인");
  assert.equal(loaded.checks["pr-submit"].status, "done");
  assert.ok(clearState(storage));
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(storage.getItem("other-tool"), "keep");
});
test("I: malformed JSON and blocked storage never break default guidance", () => {
  const storage = store();
  storage.setItem(STORAGE_KEY, "{bad");
  assert.equal(loadState(storage).state.venue, "unknown");
  assert.equal(loadState(null).state.event, "other");
  assert.equal(saveState(null, createState()), false);
  assert.equal(clearState(null), false);
  const blocked = {
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
    removeItem() {
      throw Error();
    },
  };
  assert.ok(buildChecklist(loadState(blocked).state).length);
  assert.equal(saveState(blocked, createState()), false);
  assert.equal(clearState(blocked), false);
});
test("I: partially corrupt stored state sanitizes unsupported ids, duplicates and forged checks", () => {
  const s = normalizeState({
    ...createState(),
    step: 99,
    venue: "bogus",
    event: "bogus",
    people: "-1",
    agenda: [{ id: "main", included: false }, { id: "main" }, { id: "bad" }],
    outputs: ["led", "led", "bad"],
    checks: {
      ghost: { status: "done", signature: "shared" },
      venue: { status: "done", signature: "incorrect" },
    },
  });
  assert.equal(s.step, 0);
  assert.equal(s.venue, "unknown");
  assert.equal(s.people, "");
  assert.deepEqual(s.outputs, ["led"]);
  assert.equal(new Set(s.agenda.map((a) => a.id)).size, 1);
  assert.ok(!s.checks.ghost);
  assert.equal(s.checks.venue.status, "todo");
});
test("input validation accepts only optional positive safe integers", () => {
  for (const v of ["", "1", "20", "9999"]) assert.ok(validPeople(v));
  for (const v of [
    "0",
    "-1",
    "1.2",
    "1e2",
    "01",
    "abc",
    " ",
    "9007199254740992",
    null,
    undefined,
  ])
    assert.equal(validPeople(v), false);
});
test("all event examples contain meaningful roles, checks and scripts; stable ids unique", () => {
  for (const e of EVENTS) {
    assert.ok(e.agenda.length >= 3);
    assert.equal(new Set(e.agenda.map((a) => a.id)).size, e.agenda.length);
    for (const a of e.agenda)
      assert.ok(a.what && a.role && a.check && a.script);
  }
  for (const event of EVENTS)
    for (const venue of ["prime", "history", "department", "other", "unknown"])
      for (const vip of ["yes", "no", "unknown"])
        for (const nameplates of ["needed", "none", "later"]) {
          const s = make({
            event: event.id,
            agenda: defaultAgenda(event.id),
            venue,
            vip,
            nameplates,
          });
          assert.equal(new Set(ids(s)).size, ids(s).length);
          assert.deepEqual(normalizeState(s), s);
          assert.equal(ids(s).includes("press-request"), vip === "yes");
          assert.equal(ids(s).includes("seat"), true);
          assert.equal(
            buildChecklist(s).find((i) => i.id === "seat").link,
            venue === "prime" ? "seat" : null,
          );
          assert.equal(
            ids(s).includes("nameplate-file"),
            nameplates === "needed",
          );
        }
});
test("rescheduling invalidates venue/request/support but preserves unrelated preparation", () => {
  let s = make({ venue: "prime", vip: "yes", date: "2026-10-01T10:00" });
  for (const id of [
    "venue",
    "rental",
    "press-request",
    "press-support",
    "pr-submit",
    "agenda",
  ])
    mark(s, id);
  s = updateState(s, "date", "2026-10-02T10:00");
  for (const id of ["venue", "rental", "press-request", "press-support"])
    assert.equal(s.checks[id].status, "todo");
  assert.equal(s.checks["pr-submit"].status, "done");
  assert.equal(s.checks.agenda.status, "done");
});
test("corrupt non-calendar dates are removed during restoration", () => {
  for (const date of [
    "2026-02-31T10:00",
    "2026-13-01T10:00",
    "2026-01-01T24:00",
    "0000-01-01T00:00",
  ])
    assert.equal(normalizeState({ ...createState(), date }).date, "");
  assert.equal(
    normalizeState({ ...createState(), date: "2028-02-29T23:59" }).date,
    "2028-02-29T23:59",
  );
});

test("H: a real temporary fixture path is read and verified, with no fake HWP shipped", async () => {
  const root = await mkdtemp(join(tmpdir(), "oneq-hwp-test-"));
  try {
    await mkdir(join(root, "assets/templates"), { recursive: true });
    const bytes = new Uint8Array(512);
    bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    await writeFile(join(root, "assets/templates/test-only.hwp"), bytes);
    const fetchFile = async (path) => {
      try {
        return new Response(await readFile(join(root, path)));
      } catch {
        return new Response(null, { status: 404 });
      }
    };
    assert.equal(
      (await verifyTemplate("assets/templates/test-only.hwp", fetchFile)).ready,
      true,
    );
    assert.equal(
      (await verifyTemplate("assets/templates/absent.hwp", fetchFile)).ready,
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("V0.2: Seoul routes only to its room tool; no seats when not needed", () => {
  let s = make({
    venue: "seoul",
    event: "meeting",
    agenda: defaultAgenda("meeting"),
    vip: "no",
    seating: "needed",
    nameplates: "none",
    publicity: "none",
    outputs: [],
    outputDecision: "none",
  });
  assert.equal(
    buildChecklist(s).find((i) => i.id === "seat").link,
    "seoulSeat",
  );
  assert.ok(!ids(s).some((id) => /^(press-|pr-|nameplate|output-)/.test(id)));
  mark(s, "seat");
  s = updateState(s, "venue", "prime");
  assert.equal(s.checks.seat.status, "todo");
  assert.equal(buildChecklist(s).find((i) => i.id === "seat").link, "seat");
  s = updateState(s, "seating", "none");
  assert.ok(!s.checks.seat);
  s = updateState(s, "seating", "needed");
  assert.equal(s.checks.seat.status, "todo");
});

test("V0.2: publicity remains independent of VIP and excludes unneeded work", () => {
  for (const vip of ["yes", "no", "unknown"])
    for (const publicity of ["needed", "none", "later"]) {
      const s = make({ vip, publicity });
      assert.equal(ids(s).includes("pr-submit"), publicity === "needed");
      assert.equal(ids(s).includes("pr-decision"), publicity === "later");
      assert.equal(ids(s).includes("press-request"), vip === "yes");
    }
  let s = make({ publicity: "needed" });
  mark(s, "pr-submit");
  s = updateState(s, "publicity", "none");
  s = updateState(s, "publicity", "needed");
  assert.equal(s.checks["pr-submit"].status, "todo");
});

test("V0.2: V0.1 migration preserves input, agenda and unrelated checked status", () => {
  const old = make({
    event: "award",
    agenda: defaultAgenda("award"),
    eventName: "보존 확인",
    nameplates: "needed",
  });
  old.version = 1;
  delete old.seating;
  delete old.publicity;
  mark(old, "agenda");
  const migrated = normalizeState(old);
  assert.equal(migrated.version, 4);
  assert.equal(migrated.eventName, old.eventName);
  assert.deepEqual(migrated.agenda, old.agenda);
  assert.equal(migrated.checks.agenda.status, "done");
  assert.equal(migrated.seating, "later");
  assert.equal(migrated.publicity, "later");
  assert.ok(!migrated.checks["pr-submit"]);
});

test("V0.2: shipped samples are actual UTF-8 files with correct markers and format", async () => {
  const { templatesFor } = await import("../app.js");
  assert.equal(TEMPLATES.length, 12);
  for (const t of TEMPLATES.filter((t) => t.status === "sample")) {
    const content = await readFile(new URL(`../${t.path}`, import.meta.url));
    assert.equal(
      (await verifyTemplate(t, async () => new Response(content))).ready,
      true,
    );
    assert.ok(content.toString().includes("학교 공식"));
    assert.equal(t.status, "sample");
    assert.equal(t.format, "txt");
  }
  let s = make({ event: "mou", agenda: defaultAgenda("mou") });
  assert.ok(templatesFor(s).some((t) => t.id === "agreement-mou"));
  s = updateState(
    s,
    "agenda",
    s.agenda.map((a) =>
      ["sign", "exchange"].includes(a.id) ? { ...a, included: false } : a,
    ),
  );
  assert.ok(!templatesFor(s).some((t) => t.id === "agreement-mou"));
  const txt = TEMPLATES.find((t) => t.format === "txt");
  for (const content of [
    "<html>fallback</html>",
    "내용이 있지만 임시 샘플 표시가 없는 잘못된 다운로드 파일입니다.",
  ])
    assert.equal(
      (await verifyTemplate(txt, async () => new Response(content))).ready,
      false,
    );
  assert.equal(
    (await verifyTemplate({ ...txt, path: "assets/templates/../x.txt" })).ready,
    false,
  );
});

test("V0.2: 2430 event/venue/VIP/seat/publicity combinations reconcile consistently", () => {
  for (const event of EVENTS)
    for (const venue of [
      "prime",
      "seoul",
      "history",
      "department",
      "other",
      "unknown",
    ])
      for (const vip of ["yes", "no", "unknown"])
        for (const seating of ["needed", "none", "later"])
          for (const publicity of ["needed", "none", "later"])
            for (const nameplates of ["needed", "none", "later"]) {
              const s = make({
                event: event.id,
                agenda: defaultAgenda(event.id),
                venue,
                vip,
                seating,
                publicity,
                nameplates,
              });
              assert.deepEqual(normalizeState(s), s);
              assert.equal(ids(s).includes("seat"), seating === "needed");
              assert.equal(
                ids(s).includes("seat-decision"),
                seating === "later",
              );
              assert.equal(
                ids(s).includes("nameplate-file"),
                nameplates === "needed",
              );
              assert.equal(new Set(ids(s)).size, ids(s).length);
            }
});
