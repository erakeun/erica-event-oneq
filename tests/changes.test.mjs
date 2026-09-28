import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,normalizeState,updateState,saveState,loadState,saveWithBackup} from '../app.js';
import {newPerson,exportEventJSON,importEventJSON,duplicateEvent,exportAttendeesCSV} from '../event-workspace.js';
import {activePeople,pendingChanges,substitute,compareUnidentified,applyCompared,personIdentity,recordReceipt} from '../oneq-changes.js';
import {attendeeTable,packetView,dayView} from '../workspace-view.js';
import {changesView} from '../changes-view.js';
import {STORAGE_KEY} from '../data.js';
const person=(id,name='가상 동명')=>({...newPerson(id),name,org:'가상 기관',title:'가상 담당'});
const make=()=>updateState(createState(),'attendees',[person('p1'),person('p2')]);
const store=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};};
test('MACH migration backs up once and keeps generated IDs across repeated reload',()=>{
 const storage=store(),raw=createState();delete raw.mach;raw.attendees=[person(undefined),person(undefined)];
 storage.setItem(STORAGE_KEY,JSON.stringify(raw));
 const a=loadState(storage).state,b=loadState(storage).state;
 assert.equal(a.mach.eventId,b.mach.eventId);assert.deepEqual(a.attendees.map(p=>p.id),b.attendees.map(p=>p.id));assert.notEqual(a.attendees[0].id,a.attendees[1].id);
 assert.equal(storage.getItem(STORAGE_KEY+':before-migration'),JSON.stringify(raw));
});
test('MACH correction preserves identity while substitution registers separate identity and relationship',()=>{
 const s=make(),correct=updateState(s,'attendees',s.attendees.map(p=>p.id==='p1'?{...p,name:'가상 정정'}:p));
 assert.equal(correct.attendees[0].id,'p1');assert.equal(correct.attendees.length,2);
 const rows=substitute(correct,'p1',person('p3','가상 대리'),'inherit');
 assert.equal(rows[0].attendance,'replaced');assert.equal(rows[2].replaces,'p1');assert.equal(rows[2].seatChoice,'inherit');assert.equal(activePeople({...s,attendees:rows}).length,2);
 assert.equal(s.attendees[0].attendance,undefined);
});
test('MACH ambiguous CSV matching is explicit; omitted and unselected people remain untouched',()=>{
 const s=make(),c=compareUnidentified(s,[{...person('csv'),title:'가상 새 직책'}]);
 assert.deepEqual(c[0].candidates,['p1','p2']);assert.deepEqual(applyCompared(s,c,{}),s.attendees);
 const next=applyCompared(s,c,{0:'p2'});assert.deepEqual(next[0],s.attendees[0]);assert.equal(next[1].title,'가상 새 직책');assert.equal(next[1].id,'p2');
});
test('MACH separate per-tool baselines and selection do not mark unaccepted rows applied',()=>{
 let s=make();const payload={eventId:s.mach.eventId,revision:s.mach.revision,transferId:'t1',participants:s.attendees.map(personIdentity)};
 s=recordReceipt(s,'prime',payload,{status:'pending',appliedIds:['p1'],pendingIds:['p2']});
 assert.deepEqual(pendingChanges(s).map(c=>c.id),['p2']);assert.equal(pendingChanges(s,'nameplate').length,2);
 const unchanged=structuredClone(s);s=recordReceipt(s,'prime',payload,{status:'unknown'});assert.deepEqual(s.mach.targets.prime.baseline,unchanged.mach.targets.prime.baseline);
 assert.throws(()=>recordReceipt(s,'prime',payload,{status:'applied',eventId:'other'}));
});
test('MACH immutable sent snapshot remains pending when edited during receiver review',()=>{
 let s=make();const payload={revision:s.mach.revision,transferId:'t2',participants:s.attendees.map(personIdentity)};
 s=updateState(s,'attendees',s.attendees.map(p=>p.id==='p1'?{...p,title:'가상 새 직책'}:p));
 s=recordReceipt(s,'prime',payload,{status:'applied'});assert.deepEqual(pendingChanges(s).map(c=>c.id),['p1']);assert.equal(s.mach.targets.prime.status,'pending');
});
test('MACH attendance is consistent in active counts, operating roster, arrival and CSV',()=>{
 let s=make();s=updateState(s,'attendees',[{...s.attendees[0],name:'가상 불참',attendance:'absent'},s.attendees[1]]);
 assert.equal(activePeople(s).length,1);assert.ok(!attendeeTable(s).includes('가상 불참'));assert.ok(!exportAttendeesCSV(s.attendees).includes('가상 불참'));
 assert.ok(!dayView(s,'attendees',false).includes('가상 불참'));assert.ok(!packetView(s,[]).includes('가상 불참'));
});
test('MACH JSON round trip and duplicate preserve original event while clearing new event receipts',()=>{
 const s=make();s.mach.feedback.nameplate={records:[{participantId:'p1',jobId:'j1',status:'printed'}]};s.mach.receipts=[{transferId:'t',ids:['p1']}];
 const restored=importEventJSON(exportEventJSON(s),normalizeState,createState());assert.deepEqual(restored.mach,s.mach);
 const copy=duplicateEvent(s,true,normalizeState);assert.notEqual(copy.mach.eventId,s.mach.eventId);assert.deepEqual(copy.mach.feedback,{});assert.equal(s.mach.receipts.length,1);
});
test('MACH old JSON envelope without extension stays compatible',()=>{
 const s=make();delete s.mach;const restored=importEventJSON(exportEventJSON(s),normalizeState,createState());assert.ok(restored.mach.eventId);assert.deepEqual(restored.attendees,s.attendees);
});
test('MACH corrupt storage and future extensions cannot be silently overwritten',()=>{
 for(const content of ['{broken',JSON.stringify({...make(),mach:{schemaVersion:99}})]) {const storage=store();storage.setItem(STORAGE_KEY,content);const loaded=loadState(storage).state;assert.equal(saveState(storage,loaded),false);assert.equal(storage.getItem(STORAGE_KEY),content);}
});
test('MACH concurrent save and backup failure prevent application without losing original',()=>{
 const storage=store(),s=make();saveState(storage,s);loadState(storage);const other=JSON.stringify({...s,eventName:'가상 다른 창'});storage.setItem(STORAGE_KEY,other);
 assert.throws(()=>saveWithBackup(storage,{...s,eventName:'old tab'}));assert.equal(storage.getItem(STORAGE_KEY),other);
 const blocked=store();saveState(blocked,s);const raw=blocked.getItem(STORAGE_KEY),set=blocked.setItem;blocked.setItem=(k,v)=>{if(k.endsWith(':before-change'))throw Error('quota');set(k,v);};
 assert.throws(()=>saveWithBackup(blocked,{...s,eventName:'changed'}));assert.equal(blocked.getItem(STORAGE_KEY),raw);
});
test('MACH review renders injected names as text and does not emit developer status jargon',()=>{
 const s=make();s.attendees[0].name='<img src=x onerror=alert(1)>';const html=changesView(s);
 assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('ACK'));assert.ok(!html.includes('revision'));
});
test('MACH hostile extension trees and malformed baselines are rejected',()=>{
 for(const mach of [null,{...make().mach,targets:[]},{...make().mach,targets:{prime:{baseline:[{}]}}},JSON.parse('{"schemaVersion":1,"eventId":"event-x","revision":0,"targets":{"__proto__":{}},"feedback":{},"receipts":[]}')] )assert.throws(()=>normalizeState({...make(),mach}));
});
test('MACH pending preview with no accepted rows does not advance the agreed basis',()=>{
 const s=make(),payload={eventId:s.mach.eventId,revision:s.mach.revision,participants:s.attendees.map(personIdentity),transferId:'wait'};
 const next=recordReceipt(s,'prime',payload,{status:'pending'});assert.equal(next.mach.targets.prime.revision,undefined);assert.equal(pendingChanges(next).length,2);
});
test('MACH frozen print source never marks newer person printed and ignores unrelated global changes',async()=>{
 const {reconcilePrintRecord}=await import('../oneq-changes.js');
 const fp=p=>JSON.stringify([p.participantId,p.name,p.organization,p.position,p.status,p.replacesParticipantId||'']);
 const p=person('p1'),r={participantId:'p1',status:'printed',revision:1,sourceFingerprint:fp(personIdentity(p))};
 assert.equal(reconcilePrintRecord(r,p,fp).status,'printed');assert.equal(reconcilePrintRecord(r,{...p,title:'새 직책'},fp).status,'changed');
 assert.equal(reconcilePrintRecord({...r,sourceFingerprint:undefined},p,fp).status,'changed');
 assert.equal(reconcilePrintRecord({...r,status:'recall'},p,fp).status,'recall');
});
test('MACH explicit validated restore can recover corrupt storage only after retaining original backup',()=>{
 const storage=store();storage.setItem(STORAGE_KEY,'{broken');loadState(storage);const next=make();assert.throws(()=>saveWithBackup(storage,next));assert.equal(saveWithBackup(storage,next,true),next);assert.equal(storage.getItem(STORAGE_KEY+':before-change'),'{broken');assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).mach.eventId,next.mach.eventId);
});
test('MACH late response never regresses newer accepted basis and local edits invalidate print verification',()=>{
 let s=make();const payload={eventId:s.mach.eventId,revision:s.mach.revision,participants:s.attendees.map(personIdentity),transferId:'earlier'};
 const newer={...payload,revision:s.mach.revision+1,transferId:'newer'};s.mach.revision++;s=recordReceipt(s,'prime',newer,{status:'applied'});
 assert.deepEqual(recordReceipt(s,'prime',payload,{status:'applied'}).mach.targets.prime,s.mach.targets.prime);
 const p=s.attendees[0],canonical=personIdentity(p);s.mach.feedback.nameplate={records:[{participantId:p.id,status:'printed',sourceFingerprint:JSON.stringify([canonical.participantId,canonical.name,canonical.organization,canonical.position,canonical.status,canonical.replacesParticipantId])}]};
 const edited=updateState(s,'attendees',s.attendees.map(x=>x.id===p.id?{...x,title:'가상 변경'}:x));assert.equal(edited.mach.feedback.nameplate.records[0].status,'changed');
 const absent=updateState(s,'attendees',s.attendees.map(x=>x.id===p.id?{...x,attendance:'absent'}:x));assert.equal(absent.mach.feedback.nameplate.records[0].status,'recall');
});
test('MACH indirect roster receipt clears only matching current participants independently from printed snapshot',async()=>{
 const {acceptNameplateRosterReceipt,reconcilePrintRecord}=await import('../oneq-changes.js');const fp=p=>JSON.stringify([p.participantId,p.name,p.organization,p.position,p.status,p.replacesParticipantId||'']);
 const s=make(),old=personIdentity(s.attendees[0]);s.attendees[0].title='가상 새 직책';s.mach.revision++;
 const current=personIdentity(s.attendees[0]);const r={participantId:'p1',status:'printed',sourceFingerprint:fp(old),receivedFingerprint:fp(current)};
 const next=acceptNameplateRosterReceipt(s,{baseRevision:s.mach.revision,records:[r,{participantId:'p2',receivedFingerprint:'wrong'}]},fp);
 assert.deepEqual(pendingChanges(next,'nameplate').map(c=>c.id),['p2']);assert.equal(next.mach.targets.nameplate.status,'pending');assert.equal(reconcilePrintRecord(r,s.attendees[0],fp).status,'changed');
 const withoutReceipt=acceptNameplateRosterReceipt(s,{baseRevision:s.mach.revision,records:[{...r,receivedFingerprint:undefined}]},fp);assert.equal(pendingChanges(withoutReceipt,'nameplate').length,2);
 const all=acceptNameplateRosterReceipt(next,{baseRevision:s.mach.revision,records:[{participantId:'p2',receivedFingerprint:fp(personIdentity(s.attendees[1]))}]},fp);assert.equal(all.mach.targets.nameplate.status,'applied');assert.deepEqual(pendingChanges(all,'nameplate'),[]);
});

test('MACH editing an acknowledged person reopens stages while retaining unknown or conflict and ignoring noncanonical notes',()=>{
 let s=make();const payload={eventId:s.mach.eventId,revision:s.mach.revision,transferId:'acknowledged',participants:s.attendees.map(personIdentity)};
 s=recordReceipt(s,'prime',payload,{status:'applied'});s=recordReceipt(s,'nameplate',payload,{status:'applied'});assert.equal(s.mach.targets.prime.status,'applied');assert.equal(s.mach.targets.nameplate.status,'applied');
 const notes=updateState(s,'attendees',s.attendees.map(p=>({...p,note:'가상 운영 메모'})));assert.equal(notes.mach.targets.prime.status,'applied');assert.equal(notes.mach.targets.nameplate.status,'applied');
 const edited=updateState(s,'attendees',s.attendees.map(p=>p.id==='p1'?{...p,title:'가상 새 직책'}:p));assert.equal(edited.mach.targets.prime.status,'pending');assert.equal(edited.mach.targets.nameplate.status,'pending');
 s.mach.targets.prime.status='unknown';s.mach.targets.nameplate.status='conflict';const uncertain=updateState(s,'attendees',s.attendees.map(p=>({...p,title:'가상 변경'})));assert.equal(uncertain.mach.targets.prime.status,'unknown');assert.equal(uncertain.mach.targets.nameplate.status,'conflict');
});
