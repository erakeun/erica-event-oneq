import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
await mkdir("tests/browser-evidence", { recursive: true });
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const base = process.env.ONEQ_URL || "http://127.0.0.1:4173/";
await p.goto(base);
await p.locator("[name=campus]").first().waitFor();
const keys = () =>
  p.locator("[name=venue]").evaluateAll((es) => es.map((e) => e.value));
assert.deepEqual(await keys(), []);
let screens = 0;
for (const width of [1440, 390, 412]) {
  await p.setViewportSize({ width, height: 900 });
  await p.locator("[name=campus][value=seoul]").check();
  assert.deepEqual(await keys(), ["seoul", "department", "other", "unknown"]);
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  screens++;
  await p.locator("[name=venue][value=seoul]").check();
  await p.locator('#steps [data-step="4"]').click();
  await p.locator("[name=seating][value=needed]").check();
  assert.equal(
    await p
      .locator('a[href="https://erakeun.github.io/seoul-seat-planner/"]')
      .count(),
    1,
  );
  await p.locator('#steps [data-step="0"]').click();
  await p.locator("[name=campus][value=erica]").check();
  assert.deepEqual(await keys(), ["prime", "history", "department", "other"]);
  assert.equal(await p.locator("[name=venue]:checked").count(), 0);
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  screens++;
  await p.locator("[name=venue][value=prime]").check();
  await p.locator('#steps [data-step="4"]').click();
  assert.equal(
    await p
      .locator('a[href="https://erakeun.github.io/erica-seat-planner/"]')
      .count(),
    1,
  );
  await p.locator('#steps [data-step="0"]').click();
}
await p.locator("[name=venue][value=department]").check();
await p.locator("#otherVenue").fill("가상 회의실");
await p.locator("[name=venueStatus][value=secured]").check();
await p.locator('#steps [data-step="1"]').click();
await p.locator("[name=external][value=yes]").check();
await p.locator("#eventName").fill("가상 캠퍼스 검증");
await p.locator("#venueDetail").fill("2층");
assert.match(
  await p.locator("#invitation").inputValue(),
  /ERICA · 가상 회의실 · 2층/,
);
await p.locator("[data-view=onsite]").first().click();
await p.locator("[data-onsite=place]").check();
await p.locator('#steps [data-step="0"]').click();
await p.locator("[name=campus][value=seoul]").check();
assert.ok(await p.locator("[name=venue][value=unknown]").isChecked());
await p.locator("[name=venue][value=department]").check();
assert.equal(await p.locator("#otherVenue").inputValue(), "");
await p.locator("#otherVenue").fill("가상 서울 회의실");
await p.reload();
assert.ok(await p.locator("[name=campus][value=seoul]").isChecked());
assert.equal(await p.locator("#otherVenue").inputValue(), "가상 서울 회의실");
await p.screenshot({ path: "tests/browser-evidence/campus-seoul-412.png" });
await p.locator("[data-view=onsite]").first().click();
assert.equal(await p.locator("[data-onsite=place]").isChecked(), false);
await p.locator('#steps [data-step="1"]').click();
assert.equal(await p.locator("#eventName").inputValue(), "가상 캠퍼스 검증");
assert.equal(await p.locator("#venueDetail").inputValue(), "");
assert.match(
  await p.locator("#invitation").inputValue(),
  /서울캠퍼스 · 가상 서울 회의실/,
);
await p.locator("#reset").click();
await p.locator("button[value=confirm]").click();
assert.deepEqual(await keys(), []);
assert.equal(await p.locator("[name=campus]:checked").count(), 0);
await p.screenshot({ path: "tests/browser-evidence/campus-first-412.png" });
await p.locator("[name=campus][value=erica]").check();
await p.screenshot({ path: "tests/browser-evidence/campus-erica-412.png" });
// Legacy V0.3 data: generic place name stays, no guessed campus.
await p.evaluate(() =>
  localStorage.setItem(
    "erica-event-oneq:prototype:v0.1",
    JSON.stringify({
      version: 3,
      step: 0,
      venue: "department",
      otherVenue: "가상 이전 장소",
      eventName: "가상 이전 행사",
    }),
  ),
);
await p.reload();
assert.equal(await p.locator("[name=campus]:checked").count(), 0);
assert.match(await p.locator("#main").textContent(), /가상 이전 장소/);
await p.locator("[name=campus][value=seoul]").check();
assert.equal(await p.locator("#otherVenue").inputValue(), "가상 이전 장소");
assert.deepEqual(errors, []);
console.log(JSON.stringify({ campus: "passed", screens, errors }));
await writeFile(
  "tests/browser-evidence/campus.json",
  JSON.stringify(
    {
      screens,
      errors,
      menus: true,
      venueRouting: true,
      changeReset: true,
      invitation: true,
      legacyRestore: true,
      reset: true,
    },
    null,
    2,
  ),
);
await b.close();
