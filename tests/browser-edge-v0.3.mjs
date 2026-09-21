import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
await mkdir("tests/browser-evidence", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const key = "erica-event-oneq:prototype:v0.1";
const context = await browser.newContext();
await context.addInitScript(() => {
  Storage.prototype.setItem = () => {
    throw Error("test quota");
  };
});
const page = await context.newPage();
await page.goto("http://127.0.0.1:4173/");
await page.locator("[name=venue][value=prime]").check();
assert.ok(await page.locator("#storage-alert").isVisible());
assert.match(await page.locator("#storage-alert").textContent(), /入力|입력/);
await context.close();
const c = await browser.newContext({
  permissions: ["clipboard-read", "clipboard-write"],
});
const p = await c.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto("http://127.0.0.1:4173/");
await p.evaluate((key) => {
  localStorage.setItem("unrelated-test-key", "preserve");
  localStorage.setItem(
    key,
    JSON.stringify({
      version: 2,
      step: 1,
      venue: "prime",
      event: "mou",
      eventName: "가상 V0.2 복원",
      date: "2026-10-15T14:00",
      people: "20",
      vip: "yes",
      seating: "needed",
      nameplates: "needed",
      outputs: ["welcome"],
      outputDecision: "chosen",
      publicity: "none",
      checks: {
        agenda: {
          status: "done",
          signature: "mou|open,introduce,remarks,sign,exchange,close",
        },
      },
    }),
  );
}, key);
await p.reload();
await p.locator('#steps [data-step="1"]').click();
assert.equal(await p.locator("#eventName").inputValue(), "가상 V0.2 복원");
assert.ok(await p.locator("[name=external][value=unknown]").isChecked());
await p.locator("[name=external][value=yes]").check();
await p.locator("#eventName").fill("<img src=x onerror=alert(1)>");
await p.locator("[name=food][value=snacks]").check();
await p.locator("#foodPlace").fill("<img src=x onerror=alert(1)>");
await p.locator("[data-view=onsite]").first().click();
assert.equal(await p.locator("#main img").count(), 0);
await p.locator("[data-view=after]").first().click();
await p.locator('#steps [data-step="5"]').click();
await p.locator("[data-action=skip-outputs]").click();
assert.equal(await p.locator("h1").textContent(), "내 행사 준비표");
await p.locator("#reset").click();
await p.locator("button[value=confirm]").click();
assert.equal(
  await p.evaluate(() => localStorage.getItem("unrelated-test-key")),
  "preserve",
);
// Each shipped sample actually downloads in browser across all event types.
let downloads = 0;
const { TEMPLATES } = await import("../data.js");
for (const sample of TEMPLATES) {
  const downloadContext = await browser.newContext();
  const dp = await downloadContext.newPage();
  await dp.goto("http://127.0.0.1:4173/");
  await dp.locator('#steps [data-step="1"]').click();
  await dp.locator(`[name=event][value=${sample.events[0]}]`).check();
  await dp.locator('#steps [data-step="3"]').click();
  const a = dp.locator(`a[download][href="./${sample.path}"]`);
  await a.waitFor();
  const d = dp.waitForEvent("download");
  await a.click();
  assert.ok(await (await d).path());
  downloads++;
  await downloadContext.close();
}
assert.equal(downloads, 12);
// External link opening does not alter completion.
await p.locator('#steps [data-step="4"]').click();
await p.locator("[name=nameplates][value=needed]").check();
const before = await p.evaluate(
  (key) => JSON.parse(localStorage.getItem(key)).checks,
  key,
);
const popupPromise = p.waitForEvent("popup");
await p.locator('a[href="https://erakeun.github.io/nameplate-maker/"]').click();
const popup = await popupPromise;
await popup.close();
assert.deepEqual(
  await p.evaluate((key) => JSON.parse(localStorage.getItem(key)).checks, key),
  before,
);
// Copy fallback succeeds without clipboard API.
await p.locator('#steps [data-step="1"]').click();
await p.locator("[name=external][value=yes]").check();
await p.locator("#eventName").fill("가상 대체 복사");
await p.evaluate(() =>
  Object.defineProperty(navigator, "clipboard", {
    value: undefined,
    configurable: true,
  }),
);
await p.locator("[data-action=copy-invitation]").click();
assert.match(await p.locator(".copy-status").textContent(), /복사했어요/);
// 200% text sizing at 390 px.
await p.setViewportSize({ width: 390, height: 844 });
await p.addStyleTag({ content: "html{font-size:200%}" });
await p.locator("[data-view=onsite]").first().click();
assert.ok(
  await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  "large text overflow",
);
assert.deepEqual(errors, []);
await writeFile(
  "tests/browser-evidence/edge.json",
  JSON.stringify(
    {
      storageFailure: true,
      v02Restore: true,
      escaping: true,
      prepNavigation: true,
      resetIsolation: true,
      downloads,
      externalNoAutoComplete: true,
      copyFallback: true,
      text200: true,
      errors,
    },
    null,
    2,
  ),
);
console.log("Edge checks passed; 12 downloads");
await browser.close();
