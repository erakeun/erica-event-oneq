import {readFile} from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
const page=await ctx.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));
const base=process.env.ONEQ_URL || 'http://127.0.0.1:4177/erica-event-oneq/';
await page.goto(base+'#step-7/attendees');await page.locator('[data-work="add-person"]').click();
await page.locator('[data-record="attendees"][data-field="name"]').fill('가상 검증가');
await page.locator('[data-record="attendees"][data-field="org"]').fill('가상 검증 기관');
await page.locator('[data-record="attendees"][data-field="title"]').fill('가상 긴 직책 확인 담당자');
await page.locator('[data-work="add-person"]').click();
await page.locator('[data-record="attendees"][data-field="name"]').last().fill('가상 검증나');
const key='erica-event-oneq:prototype:v0.1';
const state=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const initial=await state();assert.equal(initial.attendees.length,2);
for(const width of [390,412,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px overflow`);await page.locator('[data-mach="select-all"]').click();}
await page.locator('[data-mach="delegate"]').first().click();await page.locator('.mach-delegate [name="name"]').fill('가상 대리');await page.locator('.mach-delegate button[value="confirm"]').click();await page.locator('.mach-delegate').waitFor({state:'detached'});
let s=await state();assert.equal(s.attendees.length,3);assert.equal(s.attendees[0].attendance,'replaced');assert.equal(s.attendees[2].replaces,s.attendees[0].id);
await page.locator('[data-mach-attendance]').nth(1).selectOption('absent');await page.locator('#confirm-dialog button[value="confirm"]').click();await page.waitForTimeout(100);s=await state();assert.equal(s.attendees[1].attendance,'absent');assert.ok(await page.locator('.roster-summary').innerText().then(t=>t.includes('참석 1명')));
await page.reload();assert.deepEqual((await state()).mach.eventId,s.mach.eventId);assert.equal((await state()).attendees[2].replaces,s.attendees[0].id);
await page.locator('#csv-file').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from('성명,소속,직책\n가상 대리,가상 기관,가상 새 직책')});await page.locator('[data-work="csv-compare"]').click();await page.locator('[data-mach-match]').selectOption(s.attendees[2].id);await page.locator('[data-mach="compare-apply"]').click();s=await state();assert.equal(s.attendees[2].title,'가상 새 직책');assert.equal(s.attendees.length,3);assert.equal(s.attendees[0].attendance,'replaced');
await page.locator('[data-mach="undo"]').click();await page.locator('#confirm-dialog button[value="confirm"]').click();await page.waitForTimeout(100);assert.equal((await state()).attendees[2].title,'');

// Legacy V0.5 file is imported through the real input; then the extended file round trips after reset.
const legacy=await page.evaluate(async()=>{const {createState}=await import('./app.js?v=0.5.0');const s=createState();delete s.mach;s.eventName='가상 구형 저장본';s.attendees=['legacy-1','legacy-2'].map(id=>({id,name:'가상 동명이인',group:'가상 구분',org:'가상 기관',title:'가상 담당',note:'',arrived:false}));return {app:'erica-event-oneq',schemaVersion:5,state:s};});
await page.locator('#json-file').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});await page.locator('#confirm-dialog button[value="confirm"]').click();await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.eventName==='가상 구형 저장본',key);
await page.locator('[data-view="attendees"]').first().click();
await page.locator('#csv-file').setInputFiles({name:'ambiguous.csv',mimeType:'text/csv',buffer:Buffer.from('성명,소속,직책\n가상 동명이인,가상 기관,가상 후보 정정')});await page.locator('[data-work="csv-compare"]').click();assert.equal(await page.locator('[data-mach-match]').inputValue(),'');assert.equal(await page.locator('[data-mach-match] option').filter({hasText:'이름 일치 후보'}).count(),2);await page.locator('[data-mach-match]').selectOption('legacy-2');await page.locator('[data-mach="compare-apply"]').click();assert.equal((await state()).attendees[0].title,'가상 담당');assert.equal((await state()).attendees[1].title,'가상 후보 정정');
await page.locator('[data-view="files"]').first().click();await page.locator('[data-work="json-export"]').click();const downloadEvent=page.waitForEvent('download');await page.locator('#confirm-dialog button[value="confirm"]').click();const download=await downloadEvent;const saved=await state();await page.locator('#reset').click();await page.locator('#confirm-dialog button[value="confirm"]').click();await page.waitForFunction(k=>localStorage.getItem(k)===null,key);await page.locator('#json-file').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:await readFile(await download.path())});await page.locator('#confirm-dialog button[value="confirm"]').click();await page.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key))?.mach.eventId===id,{key,id:saved.mach.eventId});assert.deepEqual((await state()).attendees,saved.attendees);

assert.deepEqual(errors,[]);assert.ok(requests.every(r=>!r.body && r.method==='GET' && new URL(r.url).origin===new URL(base).origin));assert.ok(requests.every(r=>!decodeURIComponent(r.url).includes('가상')));
console.log(JSON.stringify({result:'passed',viewports:[390,412,1440],scenarios:['input','delegation','absence','migration-reload','explicit-csv-comparison','selected-apply','backup-undo','legacy-json-import','ambiguous-csv','json-reset-restore','no-user-data-in-requests'],pageErrors:errors,requests:requests.length}));await browser.close();
