import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const base = process.env.ONEQ_URL || "http://127.0.0.1:4186/";
const evidence = process.env.EVIDENCE_DIR || "../qa/evidence/roles";
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [],
  requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) =>
  requests.push({ url: r.url(), method: r.method(), body: r.postData() }),
);
const key = "erica-event-oneq:prototype:v0.1";
const state = () =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
const clickAction = (action) =>
  page.locator(`[data-assignment="${action}"]`).first().click();
const submit = async () => {
  await page.locator('.assignment-dialog button[type="submit"]').click();
  await page.locator(".assignment-dialog").waitFor({ state: "detached" });
};
const confirm = () =>
  page.locator('#confirm-dialog button[value="confirm"]').click();
try {
  await page.goto(base + "#step-7/files");
  const old = JSON.parse(
    await readFile(
      new URL("./fixtures/event-complete.json", import.meta.url),
      "utf8",
    ),
  );
  await page
    .locator("#json-file")
    .setInputFiles({
      name: "legacy-v05.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(old)),
    });
  await confirm();
  await page.waitForFunction(
    (k) => JSON.parse(localStorage.getItem(k))?.eventName,
    key,
  );
  let s = await state();
  for (const k of ["agenda", "attendees", "roles", "campus", "cues"])
    assert.deepEqual(s[k], old.state[k]);
  assert.deepEqual(s.staff, []);
  assert.deepEqual(s.roleTasks, []);
  console.log("F: real legacy fixture import preserves existing fields");
  await page.locator('[data-view="roles"]').first().click();
  for (let i = 0; i < 5; i++) {
    await clickAction("add-staff");
    await page
      .locator('.assignment-dialog [name="name"]')
      .fill(`검증 담당${i + 1}`);
    if (i === 0) {
      await page.locator('.assignment-dialog [name="org"]').fill("행사지원팀");
      await page
        .locator('.assignment-dialog [name="contact"]')
        .fill("내선 0000");
    }
    await submit();
  }
  await clickAction("templates");
  const prep = page.locator('.assignment-dialog input[value^="prep:"]');
  for (let i = 0; i < 10; i++) await prep.nth(i).check();
  await submit();
  s = await state();
  for (let i = 0; i < 10; i++)
    await page
      .locator(
        `[data-assignment-field="primary"][data-id="${s.roleTasks[i].id}"]`,
      )
      .selectOption(s.staff[i % 5].id);
  const beforeReload = await state();
  await page.reload();
  await page.locator(".assignment-workspace").waitFor();
  s = await state();
  assert.equal(s.staff.length, 5);
  assert.equal(s.roleTasks.length, 10);
  assert.deepEqual(s.roleTasks, beforeReload.roleTasks);
  assert.deepEqual(s.staff, beforeReload.staff);
  console.log("A: five staff, ten prep tasks, assignments and refresh");
  await clickAction("templates");
  const day = page.locator('.assignment-dialog input[value^="day:"]');
  for (let i = 0; i < 15; i++) await day.nth(i).check();
  await submit();
  s = await state();
  const dayTasks = s.roleTasks.filter((t) => t.phase === "day");
  assert.equal(dayTasks.length, 15);
  for (let i = 0; i < dayTasks.length; i++)
    await page
      .locator(`[data-assignment-field="primary"][data-id="${dayTasks[i].id}"]`)
      .selectOption(s.staff[i % 5].id);
  for (let i = 0; i < 2; i++) {
    await page
      .locator(`[data-assignment="edit-task"][data-id="${dayTasks[i].id}"]`)
      .click();
    await page
      .locator('.assignment-dialog [name="start"]')
      .fill(i === 0 ? "13:30" : "13:50");
    await page
      .locator('.assignment-dialog [name="end"]')
      .fill(i === 0 ? "14:10" : "14:30");
    await page
      .locator('.assignment-dialog [name="location"]')
      .fill(i === 0 ? "행사장 로비" : "회의실 앞");
    if (i === 1)
      await page
        .locator('.assignment-dialog [name="assistant"]')
        .selectOption(s.staff[0].id);
    await submit();
  }
  assert.ok(
    (await page.locator(".ra-conflicts").innerText()).includes("검증 담당1"),
  );
  assert.ok(
    (await page.locator(".ra-conflicts").innerText()).includes(
      "업무 시간이 겹칩니다",
    ),
  );
  await page.reload();
  await page.locator(".ra-conflicts").waitFor();
  assert.equal((await state()).roleTasks.length, 25);
  console.log(
    "B: fifteen day tasks, primary/assistant overlap saved and restored",
  );
  await clickAction("candidates");
  assert.ok(
    (await page.locator(".assignment-dialog input:disabled").count()) > 0,
  );
  const candidates = page.locator(
    '.assignment-dialog input[name="candidate"]:enabled',
  );
  const selected = await candidates.first().getAttribute("value");
  await candidates.first().check();
  await submit();
  const afterCandidate = await state();
  assert.equal(afterCandidate.roleTasks.length, 26);
  await clickAction("candidates");
  assert.ok(
    await page
      .locator(`.assignment-dialog input[value="${selected}"]`)
      .isDisabled(),
  );
  await page.locator("[data-ra-cancel]").click();
  assert.equal((await state()).roleTasks.length, 26);
  console.log("C: selected recommendation added once, duplicates disabled");
  for (const view of ["all", "person", "timeline"]) {
    await page.locator(`[data-assignment="view"][data-mode="${view}"]`).click();
    assert.ok(await page.locator(".ra-report").innerText());
    if (view === "timeline") {
      assert.equal(
        await page.locator(".ra-timeline tbody tr").count(),
        (await state()).roleTasks.filter((t) => t.phase === "day").length +
          old.state.cues.length,
      );
      assert.ok(
        (await page.locator(".ra-report").innerText()).includes("식순·큐"),
      );
    }
    await page.screenshot({
      path: `${evidence}/${view}-desktop.png`,
      fullPage: true,
    });
    await page.pdf({
      path: `${evidence}/${view}.pdf`,
      format: "A4",
      printBackground: true,
    });
  }
  console.log("D: all/person/timeline and three A4 PDFs");
  await page.locator('[data-assignment="view"][data-mode="mine"]').click();
  await page
    .locator('[data-assignment-filter="person"]')
    .selectOption(s.staff[0].id);
  for (const width of [360, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `mobile overflow ${width}`,
    );
    const cards = page.locator(".ra-card");
    assert.ok((await cards.count()) >= 4);
    assert.ok((await cards.first().innerText()).includes("13:30"));
    assert.ok((await cards.first().innerText()).includes("행사장 로비"));
    assert.ok((await cards.nth(1).innerText()).includes("보조"));
    await page.screenshot({
      path: `${evidence}/mine-${width}.png`,
      fullPage: true,
    });
  }
  console.log(
    "E: mobile personal schedule incl assistants, time, location, description",
  );
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator('[data-view="files"]').first().click();
  await page.locator('[data-work="json-export"]').click();
  const downloading = page.waitForEvent("download");
  await confirm();
  const download = await downloading;
  const json = await readFile(await download.path());
  const saved = await state();
  await page.locator("#reset").click();
  await confirm();
  await page.waitForFunction((k) => localStorage.getItem(k) === null, key);
  await page
    .locator("#json-file")
    .setInputFiles({
      name: "roundtrip.json",
      mimeType: "application/json",
      buffer: json,
    });
  await confirm();
  await page.waitForFunction(
    (k) => JSON.parse(localStorage.getItem(k))?.roleTasks?.length === 26,
    key,
  );
  const restored = await state();
  for (const k of [
    "staff",
    "roleTasks",
    "agenda",
    "attendees",
    "roles",
    "cues",
    "mach",
  ])
    assert.deepEqual(restored[k], saved[k]);
  console.log("G: export/reset/import restores all role and original data");
  // Inline assignment, filters, task edits/deletion, person deletion, legacy notes and day mode.
  await page.locator('[data-view="roles"]').first().click();
  await page.locator('[data-assignment="view"][data-mode="all"]').click();
  await clickAction("clear-filters");
  await clickAction("unassigned");
  assert.ok((await page.locator("[data-task-row]").count()) > 0);
  await clickAction("clear-filters");
  await page.locator('[data-assignment-filter="phase"]').selectOption("prep");
  assert.equal(await page.locator("[data-task-row]").count(), 11);
  await clickAction("clear-filters");
  await clickAction("add-task");
  await page
    .locator('.assignment-dialog [name="title"]')
    .fill("추가 업무 <검증>");
  await page.locator('.assignment-dialog [name="due"]').fill("2026-09-30");
  await submit();
  s = await state();
  const custom = s.roleTasks.at(-1);
  assert.equal(custom.title, "추가 업무 <검증>");
  await page
    .locator(`[data-assignment="delete-task"][data-id="${custom.id}"]`)
    .click();
  await confirm();
  await page.waitForFunction(
    (k) => JSON.parse(localStorage.getItem(k))?.roleTasks.length === 26,
    key,
  );
  assert.equal((await state()).roleTasks.length, 26);
  await page.locator("#legacy-role-notes > summary").click();
  assert.ok(
    (await page.locator("#legacy-role-notes").innerText()).includes(
      "가상 운영팀",
    ),
  );
  await page.locator('[data-view="day"]').first().click();
  await page.locator('[data-day="roles"]').click();
  await page.locator("[data-my-work]").click();
  assert.ok(
    (await page.locator('[data-mode="mine"]').getAttribute("aria-pressed")) ===
      "true",
  );
  await page.locator('[data-assignment="view"][data-mode="all"]').click();
  await page.locator("#ra-staff > summary").click();
  await page.locator('[data-assignment="delete-staff"]').first().click();
  await confirm();
  await page.waitForFunction(
    (k) => JSON.parse(localStorage.getItem(k))?.staff.length === 4,
    key,
  );
  s = await state();
  assert.equal(s.staff.length, 4);
  assert.ok(
    s.roleTasks.every(
      (t) =>
        t.primary !== saved.staff[0].id && t.assistant !== saved.staff[0].id,
    ),
  );
  assert.deepEqual(errors, []);
  assert.ok(
    requests.every(
      (r) =>
        r.method === "GET" &&
        !r.body &&
        new URL(r.url).origin === new URL(base).origin,
    ),
  );
  const result = {
    result: "passed",
    scenarios: ["A", "B", "C", "D", "E", "F", "G"],
    viewports: [360, 390, 768, 1440],
    pageErrors: errors,
    requests: requests.length,
  };
  await writeFile(`${evidence}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
