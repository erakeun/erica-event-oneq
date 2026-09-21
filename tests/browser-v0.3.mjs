import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.ONEQ_URL || "http://127.0.0.1:4173/";
await mkdir("tests/browser-evidence", { recursive: true });
const step = async (n) => page.locator(`#steps [data-step="${n}"]`).click();
const radio = async (n, v) =>
  page.locator(`[name="${n}"][value="${v}"]`).check();
const view = async (v) => page.locator(`[data-view="${v}"]`).first().click();
const noOverflow = async () => {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "overflow",
  );
};
const state = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("erica-event-oneq:prototype:v0.1")),
  );
const reset = async () => {
  await page.locator("#reset").click();
  await page.locator("button[value=confirm]").click();
};
await page.goto(base);
await page.locator("h1").waitFor();
// A: complete UI path, synthetic inputs only.
await radio("venue", "prime");
await radio("venueStatus", "secured");
await step(1);
await radio("event", "mou");
await page.locator("#eventName").fill("가상 교류 협약식");
await page.locator("#date").fill("2026-10-15T14:00");
await page.locator("#people").fill("20");
await radio("vip", "yes");
await radio("external", "yes");
await page.locator("#venueDetail").fill("가상 행사구역");
await page.locator("[data-guest=arrival]").check();
await page.locator("#arrivalNote").fill("13:50 도착 요청");
await page.locator("[data-action=copy-invitation]").click();
assert.match(
  await page.evaluate(() => navigator.clipboard.readText()),
  /가상 교류 협약식/,
);
assert.doesNotMatch(
  await page.evaluate(() => navigator.clipboard.readText()),
  /주차/,
);
await radio("food", "snacks");
await page.locator("#foodPeople").fill("20");
await page.locator("#foodTime").fill("13:30");
await page.locator("#foodPlace").fill("가상 입구 테이블");
await page.locator("[name=diet]").check();
await page.locator("summary").filter({ hasText: "현장 장비" }).click();
await radio("audio", "needed");
await step(2);
await radio("photography", "needed");
await radio("publicity", "needed");
await step(3);
await page.locator("summary").filter({ hasText: "행사 전체 역할분담" }).click();
await page.locator("[data-role=lead]").fill("가상 총괄팀");
await page.locator("[data-role=photo]").fill("가상 촬영팀");
await page.locator('[data-move="sign"][data-direction="-1"]').click();
await page.waitForSelector("a[download]");
const downloaded = page.waitForEvent("download");
await page.locator("a[download]").first().click();
assert.ok(await (await downloaded).path());
await step(4);
await radio("seating", "needed");
await radio("nameplates", "needed");
assert.ok(
  await page
    .locator('a[href="https://erakeun.github.io/erica-seat-planner/"]')
    .count(),
);
await step(5);
await page.locator("[data-output=welcome]").check();
await step(6);
await page.locator("[data-check=food-order]").selectOption("done");
await view("onsite");
assert.equal(await page.locator("[data-onsite=food]").isChecked(), false);
await page.locator("[data-onsite=place]").check();
await page.locator("[data-onsite=food]").check();
await page.locator("#remaining-only").check();
assert.equal(
  await page.locator(".field-check:not(.filtered)").count(),
  (await page.locator(".field-check").count()) - 2,
);
await page.setViewportSize({ width: 390, height: 844 });
await noOverflow();
await page.screenshot({
  path: "tests/browser-evidence/v03-A-onsite-390.png",
  fullPage: true,
});
await page.emulateMedia({ media: "print" });
assert.equal(
  await page.locator(".field-check.filtered").first().isVisible(),
  true,
);
await page.pdf({
  path: "tests/browser-evidence/onsite.pdf",
  format: "A4",
  printBackground: true,
});
await page.emulateMedia({ media: "screen" });
await view("roles");
assert.equal(await page.locator(".role-sheet > div").count(), 2);
await page.emulateMedia({ media: "print" });
await page.pdf({ path: "tests/browser-evidence/roles.pdf", format: "A4" });
await page.emulateMedia({ media: "screen" });
await view("after");
await radio("borrowed", "yes");
await radio("followupAdmin", "yes");
await page.locator("[data-after=photos]").check();
await page.locator("#afterNote").fill("가상 메모: 수령 담당을 미리 정하기");
await page.reload();
assert.equal(
  await page.locator("#afterNote").inputValue(),
  "가상 메모: 수령 담당을 미리 정하기",
);
assert.equal(await page.locator("[data-after=photos]").isChecked(), true);
await view("onsite");
await page.locator("#remaining-only").uncheck();
await step(0);
await radio("venue", "seoul");
await view("onsite");
assert.equal(await page.locator("[data-onsite=place]").isChecked(), false);
assert.equal(await page.locator("[data-onsite=food]").isChecked(), false);
await page.goBack();
await page.goForward();
assert.match(await page.locator("h1").textContent(), /최종점검/);
// B: short meeting path.
await reset();
await radio("venue", "seoul");
await step(1);
await radio("event", "meeting");
await radio("vip", "no");
await radio("external", "no");
await radio("food", "none");
assert.equal(await page.locator("#invitation").count(), 0);
assert.equal(await page.locator("#foodTime").count(), 0);
await step(2);
await radio("photography", "none");
await radio("publicity", "none");
await step(4);
await radio("seating", "none");
await radio("nameplates", "none");
await step(5);
await page.locator("[data-action=skip-outputs]").click();
await view("onsite");
assert.deepEqual(
  await page
    .locator("[data-onsite]")
    .evaluateAll((es) => es.map((e) => e.dataset.onsite)),
  ["place", "agenda", "meeting"],
);
await view("roles");
assert.equal(await page.locator(".role-sheet > div").count(), 0);
// C: department awards.
await reset();
await radio("venue", "department");
await page.locator("#otherVenue").fill("가상 부서 회의실");
await step(1);
await radio("event", "award");
await radio("external", "yes");
await radio("food", "unknown");
await step(3);
await page.locator("summary").filter({ hasText: "행사 전체 역할분담" }).click();
await page.locator("[data-role=lead]").fill("가상 행사팀");
await step(4);
await radio("nameplates", "needed");
await step(5);
await page.locator("[data-output=notice]").check();
await view("onsite");
assert.ok(await page.locator("[data-onsite=award]").count());
assert.ok(await page.locator("[data-onsite=output-notice]").count());
assert.equal(await page.locator("[data-onsite=food]").count(), 0);
await page.setViewportSize({ width: 412, height: 915 });
await noOverflow();
await page.screenshot({
  path: "tests/browser-evidence/v03-C-onsite-412.png",
  fullPage: true,
});
// D: undecided, then changes.
await reset();
await step(1);
await radio("event", "donation");
await view("prep");
assert.ok(await page.locator(".unresolved").count());
await view("onsite");
assert.ok(await page.locator("[data-onsite=donation]").count());
await step(1);
await radio("external", "yes");
await radio("food", "meal");
await view("onsite");
await page.locator("[data-onsite=guests]").check();
await page.locator("[data-onsite=food]").check();
await step(1);
await radio("external", "no");
await radio("food", "none");
await view("onsite");
assert.equal(await page.locator("[data-onsite=guests]").count(), 0);
assert.equal(await page.locator("[data-onsite=food]").count(), 0);
// Full venue/type/layout regression.
let screens = 0;
for (const width of [1440, 390, 412]) {
  await page.setViewportSize({ width, height: 1000 });
  for (const venue of [
    "prime",
    "seoul",
    "history",
    "department",
    "other",
    "unknown",
  ]) {
    await step(0);
    await radio("venue", venue);
    await noOverflow();
    screens++;
  }
  for (const event of ["mou", "award", "donation", "meeting", "other"]) {
    await step(1);
    await radio("event", event);
    for (const n of [1, 2, 3, 4, 5, 6]) {
      await step(n);
      await noOverflow();
      screens++;
    }
    for (const v of ["prep", "onsite", "roles", "after"]) {
      await view(v);
      await noOverflow();
      screens++;
    }
  }
}
// Keyboard, empty/invalid count, all links marked safe, saved state.
await step(1);
await page.locator("#people").fill("-1");
assert.equal((await state()).people, "");
assert.equal(
  await page.locator("#people").getAttribute("aria-invalid"),
  "true",
);
await page.locator("#people").fill("8");
await page.locator("#eventName").focus();
await page.keyboard.press("Tab");
assert.equal(
  await page.locator("#date").evaluate((e) => e === document.activeElement),
  true,
);
await view("prep");
await page.setViewportSize({ width: 1440, height: 1000 });
await page.screenshot({
  path: "tests/browser-evidence/v03-prep-desktop.png",
  fullPage: true,
});
for (const link of await page
  .locator("a[target=_blank]")
  .evaluateAll((es) => es.map((e) => ({ rel: e.rel, href: e.href }))))
  assert.match(link.rel, /noopener/);
assert.deepEqual(errors, []);
await writeFile(
  "tests/browser-evidence/v03-browser.json",
  JSON.stringify(
    {
      scenarios: ["A", "B", "C", "D"],
      screens,
      viewports: [1440, 390, 412],
      errors,
      clipboard: true,
      downloads: true,
      storage: true,
      reset: true,
      backForward: true,
      printPdf: true,
      keyboard: true,
      overflow: false,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ scenarios: "A–D passed", screens, errors }));
await browser.close();
