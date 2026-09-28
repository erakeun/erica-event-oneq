/** OneQ-owned event identity and review helpers. No user content leaves this module. */
export const uid = (prefix = 'id') => `${prefix}-${crypto.randomUUID()}`;
export const activePeople = (s) => s.attendees.filter(p => !['absent', 'replaced'].includes(p.attendance));
export const newMach = () => ({schemaVersion:1,eventId:uid('event'),revision:0,targets:{},feedback:{},receipts:[]});
const plain = v => v && typeof v==='object' && !Array.isArray(v) && Object.getPrototypeOf(v)===Object.prototype;
const identifier = v => typeof v==='string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(v) && !['__proto__','constructor','prototype'].includes(v);
function safeTree(v,depth=0,budget={n:0}) {
  if(depth>15 || ++budget.n>40000) throw Error('연동 저장본 구조가 너무 큽니다.');
  if(v===null || ['string','boolean','number'].includes(typeof v))return;
  if(!Array.isArray(v) && !plain(v))throw Error('연동 저장본 구조를 확인하세요.');
  for(const key of Object.keys(v)){if(['__proto__','constructor','prototype'].includes(key))throw Error('허용하지 않는 저장본 구조입니다.');safeTree(v[key],depth+1,budget);}
}
function checkPeople(rows) {
  if(!Array.isArray(rows)||rows.length>300)throw Error('연동 명단 형식을 확인하세요.');
  const ids=new Set();for(const p of rows){
    if(!plain(p)||!identifier(p.participantId)||ids.has(p.participantId)||!['name','organization','position'].every(k=>typeof p[k]==='string'&&p[k].length<=500)||!['attending','absent','replaced'].includes(p.status))throw Error('연동 명단 ID 또는 내용을 확인하세요.');
    ids.add(p.participantId);
  }
}
export function normalizeMach(raw) {
  if (raw===undefined) return newMach();
  safeTree(raw);
  if (!plain(raw)||raw.schemaVersion !== 1 || !identifier(raw.eventId) || !Number.isSafeInteger(raw.revision) || raw.revision < 0 || !plain(raw.targets)||!plain(raw.feedback)||!Array.isArray(raw.receipts)) throw Error('연동 저장본의 형식 또는 버전을 확인하세요.');
  if (JSON.stringify(raw).length > 1500000) throw Error('연동 저장본이 너무 큽니다.');
  if(Object.keys(raw).some(k=>!['schemaVersion','eventId','revision','targets','feedback','receipts'].includes(k)))throw Error('지원하지 않는 연동 저장 항목입니다.');
  for(const [app,target] of Object.entries(raw.targets)) {
    if(!['prime','nameplate'].includes(app)||!plain(target))throw Error('연동 대상 형식을 확인하세요.');
    if(target.baseline!==undefined)checkPeople(target.baseline);
    if(target.status!==undefined&&!['preparing','received','pending','applied','cancelled','conflict','unknown'].includes(target.status))throw Error('도구 확인 상태를 확인하세요.');
    if(target.revision!==undefined&&(!Number.isSafeInteger(target.revision)||target.revision<0||target.revision>raw.revision))throw Error('도구 기준본을 확인하세요.');
    if(target.sent!==undefined){if(target.sent.eventId!==raw.eventId||!identifier(target.sent.transferId))throw Error('다른 행사의 보낸 내용입니다.');checkPeople(target.sent.participants);}
  }
  for(const [app,feedback] of Object.entries(raw.feedback)) {
    if(!['prime','nameplate'].includes(app)||!plain(feedback))throw Error('도구 결과 형식을 확인하세요.');
    if(feedback.eventId!==undefined&&feedback.eventId!==raw.eventId)throw Error('다른 행사 결과입니다.');
    if(feedback.seats!==undefined)checkPeople(feedback.seats);
    if(feedback.records!==undefined&&(!Array.isArray(feedback.records)||feedback.records.length>1000||feedback.records.some(r=>!plain(r)||!identifier(r.participantId)||!['printed','recall','recalled','unknown','changed','new'].includes(r.status))))throw Error('출력 확인 결과를 확인하세요.');
  }
  if(raw.receipts.length>100||raw.receipts.some(r=>!plain(r)||!identifier(r.transferId)||!Array.isArray(r.ids)||r.ids.length>300||r.ids.some(id=>!identifier(id))))throw Error('수신 이력을 확인하세요.');
  return structuredClone(raw);
}
export const personIdentity = p => ({participantId:p.id,name:p.name,organization:p.org || p.group,position:p.title,status:p.attendance || 'attending',replacesParticipantId:p.replaces || '',seatId:'',seatLocked:false});
export const samePerson = (a,b) => !!a && !!b && ['participantId','name','organization','position','status','replacesParticipantId'].every(k=>String(a[k]||'').trim().replace(/\s+/g,' ')===String(b[k]||'').trim().replace(/\s+/g,' '));
export function pendingChanges(s, target='prime') {
  const basis = s.mach?.targets?.[target]?.baseline || [];
  const old = new Map(basis.map(p => [p.participantId,p]));
  return s.attendees.map(p => {
    const before = old.get(p.id), after = personIdentity(p);
    if (samePerson(before,after)) return null;
    const type = after.status === 'absent' ? '불참' : after.status === 'replaced' || after.replacesParticipantId ? '대리참석' : !before ? '추가' : '정보 정정';
    return {id:p.id,before,after,type,seat:s.mach?.feedback?.prime?.seats?.find(x=>x.participantId===p.id)?.seatId || '미배정',impact:type==='불참'||after.status==='replaced'?'해당 자리 비우기 · 기존 명패 회수 확인':type==='추가'?'미배정으로 추가 · 새 명패 출력':'좌석 유지 · 실제 표시 변경 시 명패 재출력'};
  }).filter(Boolean);
}
export function reconcileTargetStatuses(s) {
  for (const target of ['prime','nameplate']) {
    const stage=s.mach.targets[target];
    if(stage?.status==='applied' && pendingChanges(s,target).length) stage.status='pending';
  }
  return s;
}
export function substitute(s, originalId, replacement, choice='unassigned') {
  const old=s.attendees.find(p=>p.id===originalId);
  if(!old || ['absent','replaced'].includes(old.attendance)) throw Error('참석 중인 원 참석자를 선택하세요.');
  if(!replacement.name.trim()) throw Error('대리참석자 이름을 입력하세요.');
  if(s.attendees.length>=300) throw Error('최대 300명까지 저장할 수 있습니다.');
  const next=structuredClone(s);
  next.attendees=next.attendees.map(p=>p.id===originalId?{...p,attendance:'replaced',arrived:false}:p);
  next.attendees.push({...replacement,attendance:'attending',replaces:originalId,seatChoice:choice,arrived:false});
  return next.attendees;
}
export function compareUnidentified(s, rows) {
  // Even a unique name is merely a candidate: a human must choose the identity.
  return rows.map(row=>({row,candidates:s.attendees.filter(p=>p.name.trim().normalize('NFC')===row.name.trim().normalize('NFC')).map(p=>p.id)}));
}
export function applyCompared(s, candidates, decisions) {
  const next=structuredClone(s.attendees), used=new Set();
  for(let i=0;i<candidates.length;i++) {
    const chosen=decisions[i]; if(!chosen) continue;
    const incoming=candidates[i].row;
    if(chosen==='new') { next.push({...incoming,id:uid('person')}); continue; }
    if(used.has(chosen)) throw Error('한 참석자에게 두 행을 동시에 적용할 수 없습니다.');
    const at=next.findIndex(p=>p.id===chosen); if(at<0) throw Error('매칭할 참석자를 다시 확인하세요.');
    used.add(chosen);
    next[at]={...next[at],...Object.fromEntries(['group','org','name','title','note'].map(k=>[k,incoming[k]])),arrived:false};
  }
  if(next.length>300) throw Error('최대 300명까지 가능합니다.');
  return next;
}
export function recordReceipt(s, target, sent, receipt) {
  if((sent.eventId && sent.eventId!==s.mach.eventId) || (receipt.eventId && receipt.eventId!==s.mach.eventId)) throw Error('다른 행사 확인 결과입니다.');
  const next=structuredClone(s), previous=next.mach.targets[target]||{};
  if(previous.revision>sent.revision) return next;
  if(!['applied','pending'].includes(receipt.status)) { next.mach.targets[target]={...previous,status:receipt.status}; return next; }
  const accepted=new Set(receipt.appliedIds || (receipt.status==='applied' ? sent.participants.map(p=>p.participantId) : []));
  const baseline=new Map((previous.baseline||[]).map(p=>[p.participantId,p]));
  for(const p of sent.participants) if(accepted.has(p.participantId)) baseline.set(p.participantId,structuredClone(p));
  next.mach.targets[target]={...previous,status:receipt.status==='applied' && accepted.size!==sent.participants.length?'pending':receipt.status,baseline:[...baseline.values()],...(accepted.size ? {revision:sent.revision} : {}),transferId:sent.transferId};
  return reconcileTargetStatuses(next);
}
export function changeSummary(s) {
  return pendingChanges(s).map(c=>`${c.after.name}: ${c.type} / ${c.impact}`).join('\n') || '전달할 참석자 변경이 없습니다.';
}
export function reconcilePrintRecord(record, person, fingerprint) {
  const matches=person && typeof record.sourceFingerprint==='string' && record.sourceFingerprint===fingerprint(personIdentity(person));
  return record.status==='printed' && !matches ? {...record,status:person && ['absent','replaced'].includes(person.attendance)?'recall':'changed'} : {...record};
}
/** A current roster receipt is independent of the immutable source that was physically printed. */
export function acceptNameplateRosterReceipt(s, payload, fingerprint) {
  const next=structuredClone(s), previous=next.mach.targets.nameplate||{};
  const baseline=new Map((previous.baseline||[]).map(p=>[p.participantId,p]));
  let accepted=0;
  for(const record of payload.records||[]) {
    const person=next.attendees.find(p=>p.id===record.participantId);
    if(!person || typeof record.receivedFingerprint!=='string')continue;
    const canonical=personIdentity(person);
    if(record.receivedFingerprint!==fingerprint(canonical))continue;
    baseline.set(person.id,canonical);accepted++;
  }
  if(accepted) {
    next.mach.targets.nameplate={...previous,baseline:[...baseline.values()],revision:Math.max(previous.revision||0,payload.baseRevision),rosterReceipt:true};
    next.mach.targets.nameplate.status=pendingChanges(next,'nameplate').length?'pending':'applied';
  }
  return next;
}
