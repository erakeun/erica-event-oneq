import { selectedAgenda, agendaFingerprint } from "./agenda.js?v=0.5.0";

export const ATTENDEE_LIMIT = 300;
export const CUE_LIMIT = 150;
export const CSV_LIMIT = 1024 * 1024;
export const JSON_LIMIT = 3 * 1024 * 1024;
export const PERSON_FIELDS = {
  group: 120,
  org: 120,
  title: 80,
  name: 80,
  note: 500,
};
export const CUE_FIELDS = {
  time: 5,
  title: 160,
  owner: 160,
  action: 1000,
  note: 500,
};
export const workspaceDefaults = () => ({
  attendees: [],
  cues: [],
  cueBasis: "",
});
const text = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
const safeId = (v) =>
  typeof v === "string" &&
  !["__proto__", "constructor", "prototype"].includes(v) &&
  /^[a-zA-Z0-9_-]{1,80}$/.test(v);
export const newPerson = (id) => ({
  id,
  group: "",
  org: "",
  title: "",
  name: "",
  note: "",
  arrived: false,
});
export const newCue = (id) => ({
  id,
  time: "",
  title: "",
  owner: "",
  action: "",
  note: "",
});
export const validTime = (v) =>
  v === "" || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
export function normalizeRows(raw, kind, strict = false) {
  const fields = kind === "attendees" ? PERSON_FIELDS : CUE_FIELDS;
  const limit = kind === "attendees" ? ATTENDEE_LIMIT : CUE_LIMIT;
  if (!Array.isArray(raw)) {
    if (strict) throw Error("행 목록 형식이 올바르지 않습니다.");
    return [];
  }
  if (strict && raw.length > limit)
    throw Error(`최대 ${limit}행까지 가능합니다.`);
  const ids = new Set();
  return raw.slice(0, limit).map((r, i) => {
    if (!r || typeof r !== "object" || Array.isArray(r))
      throw Error("잘못된 행입니다.");
    if (strict && (!safeId(r.id) || ids.has(r.id)))
      throw Error("행 ID가 없거나 중복되었습니다.");
    const id = safeId(r.id) && !ids.has(r.id) ? r.id : `${kind}-${i}`;
    ids.add(id);
    const row = { id };
    for (const [k, max] of Object.entries(fields)) {
      if (strict && (typeof r[k] !== "string" || r[k].length > max))
        throw Error(`${k} 항목의 형식 또는 길이를 확인하세요.`);
      row[k] = text(r[k], max).replace(/\u0000/g, "");
    }
    if (kind === "cues" && !validTime(row.time)) {
      if (strict) throw Error("시간은 HH:MM 또는 빈칸이어야 합니다.");
      row.time = "";
    }
    if (kind === "attendees") {
      if (strict && typeof r.arrived !== "boolean")
        throw Error("참석 확인 상태가 올바르지 않습니다.");
      row.arrived = r.arrived === true;
    }
    return row;
  });
}
export function moveRow(rows, id, direction) {
  const next = structuredClone(rows),
    from = next.findIndex((r) => r.id === id),
    to = from + direction;
  if (from < 0 || ![-1, 1].includes(direction) || to < 0 || to >= next.length)
    return next;
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
export const rosterFingerprint = (s) =>
  s.attendees?.length
    ? agendaFingerprint(s.attendees.map(({ arrived, ...r }) => r))
    : "";
export const cueSignature = (s) =>
  agendaFingerprint([
    s.event,
    selectedAgenda(s),
    s.date,
    s.campus,
    s.venue,
    s.otherVenue,
    s.venueDetail,
  ]);
export const cueStale = (s) =>
  Boolean(s.cues?.length && s.cueBasis !== cueSignature(s));
export function cuesFromAgenda(s, idFactory = (i) => `cue-${i}`) {
  return selectedAgenda(s).map((a, i) => ({
    ...newCue(idFactory(i)),
    title: a.title,
  }));
}
export function timeWarnings(rows) {
  let last = "",
    previous = -1;
  const warnings = [];
  rows.forEach((r, i) => {
    if (!r.time) return;
    if (last && r.time < last)
      warnings.push(
        `${i + 1}행 ${r.time}이 ${previous + 1}행 ${last}보다 이릅니다. 순서는 유지했습니다. 자정을 넘는 일정이라면 비고에 날짜를 적어 주세요.`,
      );
    last = r.time;
    previous = i;
  });
  return warnings;
}
export const rosterGroups = (s) =>
  [...new Set(s.attendees.map((p) => p.group.trim() || "구분 미입력"))].map(
    (name) => ({
      name,
      count: s.attendees.filter(
        (p) => (p.group.trim() || "구분 미입력") === name,
      ).length,
    }),
  );

// Imported/exported files remain in the browser. Formula escaping is applied at every CSV boundary.
export function csvCell(value) {
  let v = String(value ?? "");
  if (/^[\s\uFEFF]*[=+@\-]/.test(v) || /^[\t\r\n]/.test(v)) v = "'" + v;
  return '"' + v.replace(/"/g, '""') + '"';
}
export function exportAttendeesCSV(rows, target = "oneq") {
  const spec =
    target === "nameplate"
      ? [
          ["이름", "name"],
          ["소속", "org"],
          ["직책", "title"],
        ]
      : [
          ["기관", "group"],
          ["소속", "org"],
          ["직책", "title"],
          ["성명", "name"],
          ["비고", "note"],
        ];
  return (
    "\uFEFF" +
    [
      ...(target === "nameplate" ? [] : [spec.map(([label]) => label)]),
      ...rows.map((r) =>
        spec.map(([, key]) =>
          target === "nameplate"
            ? (key === "org" ? r.org || r.group : r[key]).replace(
                /[\r\n\t]+/g,
                " ",
              )
            : r[key],
        ),
      ),
    ]
      .map((r) => r.map(csvCell).join(","))
      .join("\r\n")
  );
}
function parseCSV(text) {
  const rows = [];
  let row = [],
    cell = "",
    quote = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quote = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell || closed) throw Error("CSV 따옴표 형식을 확인하세요.");
      quote = true;
    } else if (c === "," || c === "\r" || c === "\n") {
      row.push(cell);
      cell = "";
      closed = false;
      if (c !== ",") {
        rows.push(row);
        row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
      }
    } else {
      if (closed) throw Error("닫는 따옴표 뒤에 잘못된 문자가 있습니다.");
      cell += c;
    }
    if (rows.length > ATTENDEE_LIMIT + 1000)
      throw Error("CSV 행 수가 너무 많습니다.");
  }
  if (quote) throw Error("CSV 따옴표가 닫히지 않았습니다.");
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((v) => v.trim()));
}
export function importAttendeesCSV(source, idFactory = (i) => `person-${i}`) {
  if (
    typeof source !== "string" ||
    new TextEncoder().encode(source).length > CSV_LIMIT
  )
    throw Error("CSV는 1MB 이하로 선택하세요.");
  const rows = parseCSV(source.replace(/^\uFEFF/, ""));
  if (!rows.length) throw Error("CSV에 명단이 없습니다.");
  const aliases = {
    기관: "group",
    구분: "group",
    "기관/구분": "group",
    group: "group",
    소속: "org",
    org: "org",
    직책: "title",
    직위: "title",
    title: "title",
    성명: "name",
    이름: "name",
    name: "name",
    비고: "note",
    note: "note",
  };
  const headers = rows.shift().map((v) => v.trim());
  const keys = headers.map((h) =>
    Object.hasOwn(aliases, h) ? aliases[h] : null,
  );
  if (!keys.includes("name"))
    throw Error("첫 행에 성명 또는 이름 컬럼이 필요합니다.");
  if (new Set(keys.filter(Boolean)).size !== keys.filter(Boolean).length)
    throw Error("같은 의미의 컬럼이 중복되었습니다.");
  if (headers.length > 30 || rows.length > ATTENDEE_LIMIT)
    throw Error("CSV는 최대 30열, 참석자 300명까지 가능합니다.");
  const ignored = headers.filter((h, i) => !keys[i]);
  const attendees = rows.map((r, i) => {
    if (r.length !== headers.length)
      throw Error(`${i + 2}행의 컬럼 수가 머리글과 다릅니다.`);
    const p = newPerson(idFactory(i));
    keys.forEach((key, j) => {
      if (!key) return;
      const v = r[j].trim();
      if (
        v.length > PERSON_FIELDS[key] ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)
      )
        throw Error(`${i + 2}행의 길이 또는 문자를 확인하세요.`);
      p[key] = v;
    });
    if (!p.name) throw Error(`${i + 2}행에 성명이 없습니다.`);
    return p;
  });
  if (!attendees.length) throw Error("가져올 참석자가 없습니다.");
  return { attendees, ignored };
}

const affectedPrep = (id) =>
  [
    "seat",
    "nameplate-file",
    "nameplate-placement",
    "parking-registration",
    "food-count",
    "food-order",
    "attendee-intro",
  ].includes(id) || /^material-.*-(introduce|photo)$/.test(id);
export function rosterDependency(s, items, onsite = false) {
  const stamp = rosterFingerprint(s);
  return items.map((i) =>
    stamp &&
    (onsite
      ? [
          "seats",
          "nameplates",
          "parking-registration",
          "food",
          "photo",
          "guests",
          "vip",
        ].includes(i.id)
      : affectedPrep(i.id))
      ? { ...i, signature: `${i.signature}|roster:${stamp}` }
      : i,
  );
}
export function packetSignature(s) {
  const {
    checks,
    onsiteChecks,
    afterChecks,
    step,
    view,
    cueBasis,
    ...content
  } = s;
  return agendaFingerprint({
    ...content,
    attendees: s.attendees.map(({ arrived, ...p }) => p),
  });
}
export function workspacePrep(s) {
  const items = [];
  if (s.attendees.length)
    items.push({
      id: "attendee-intro",
      group: "식순·현장 준비",
      title: "참석자 명단·소개 순서 확인",
      detail: `입력 ${s.attendees.length}명 · 기관/직책/성명과 소개 순서를 확인하세요.`,
      signature: rosterFingerprint(s),
    });
  if (s.cues.length)
    items.push({
      id: "cue-review",
      group: "식순·현장 준비",
      title: "진행 큐시트 재확인",
      detail: cueStale(s)
        ? "식순·일시·장소가 바뀌었습니다. 기존 큐시트를 보존했으니 대조 후 확인하세요."
        : "시간·담당·현장 행동을 최종 대조하세요.",
      signature: cueSignature(s) + "|" + agendaFingerprint(s.cues),
    });
  items.push({
    id: "operation-pack",
    group: "식순·현장 준비",
    title: "행사 운영본 최종 확인",
    detail: "명단·식순·큐시트·역할을 운영본에서 함께 확인하세요.",
    signature: packetSignature(s),
  });
  return items;
}
export function changeExplanation(field) {
  if (field === "attendees")
    return "참석자 명단이 바뀌어 소개·명패·좌석·주차·다과 인원·단체촬영·운영본을 다시 확인해야 해요. 기존 자료는 보존했어요.";
  if (["agenda", "event"].includes(field))
    return "식순이 바뀌었어요. 시나리오에 반영했고, 기존 큐시트는 보존했어요. 큐시트·운영본·관련 현장점검을 다시 확인하세요.";
  if (field === "date")
    return "일시가 바뀌어 안내문·큐시트·화면/안내물·관련 현장점검을 다시 확인해야 해요.";
  if (["campus", "venue", "otherVenue", "venueDetail"].includes(field))
    return "장소가 바뀌어 좌석·방문안내·연락처·화면/안내물·큐시트·현장점검을 다시 확인해야 해요. 기존 큐시트는 보존했어요.";
  if (field === "cues")
    return "큐시트를 수정했어요. 운영본과 최종 현장 진행을 다시 확인하세요.";
  return "";
}

function guardTree(v, depth = 0, budget = { n: 0 }) {
  if (++budget.n > 40000 || depth > 16)
    throw Error("파일 구조가 너무 복잡합니다.");
  if (!v || typeof v !== "object") return;
  for (const key of Object.keys(v)) {
    if (["__proto__", "prototype", "constructor"].includes(key))
      throw Error("허용하지 않는 파일 구조입니다.");
    guardTree(v[key], depth + 1, budget);
  }
}
export function exportEventJSON(s) {
  return JSON.stringify(
    {
      app: "erica-event-oneq",
      schemaVersion: 5,
      exportedAt: new Date().toISOString(),
      state: s,
    },
    null,
    2,
  );
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])]),
    );
  return value;
}
export function importEventJSON(source, normalize, defaults) {
  if (
    typeof source !== "string" ||
    new TextEncoder().encode(source).length > JSON_LIMIT
  )
    throw Error("JSON은 3MB 이하로 선택하세요.");
  let payload;
  try {
    payload = JSON.parse(source.replace(/^\uFEFF/, ""));
  } catch {
    throw Error("손상된 JSON입니다. 현재 행사는 유지됩니다.");
  }
  guardTree(payload);
  if (
    payload?.app !== "erica-event-oneq" ||
    payload.schemaVersion !== 5 ||
    payload.state?.version !== 5
  )
    throw Error("지원하는 원큐 V0.5 저장 파일이 아닙니다.");
  const raw = payload.state;
  if (!raw || Array.isArray(raw))
    throw Error("행사 정보 형식이 잘못되었습니다.");
  for (const [key, sample] of Object.entries(defaults)) {
    const value = raw[key];
    if (
      Array.isArray(sample)
        ? !Array.isArray(value)
        : sample && typeof sample === "object"
          ? !value || typeof value !== "object" || Array.isArray(value)
          : typeof value !== typeof sample
    )
      throw Error(`${key}의 데이터 형식이 올바르지 않습니다.`);
  }
  normalizeRows(raw.attendees, "attendees", true);
  normalizeRows(raw.cues, "cues", true);
  for (const key of ["checks", "onsiteChecks", "afterChecks"])
    for (const item of Object.values(raw[key]))
      if (
        !item ||
        typeof item !== "object" ||
        !["todo", "done", "na"].includes(item.status) ||
        typeof item.signature !== "string" ||
        item.signature.length > 12000
      )
        throw Error("준비 상태 형식이 잘못되었습니다.");
  if (raw.agenda.length > 50) throw Error("식순은 50개까지 가능합니다.");
  const normalized = normalize(raw);
  // Reject invalid enums, dates, lengths, IDs and malformed arrays instead of silently replacing user data.
  for (const key of Object.keys(defaults)) {
    if (["checks", "onsiteChecks", "afterChecks"].includes(key)) continue;
    if (
      JSON.stringify(canonical(raw[key])) !==
      JSON.stringify(canonical(normalized[key]))
    )
      throw Error(`${key}의 값 또는 길이를 확인하세요.`);
  }
  return normalized;
}
export function duplicateEvent(s, keepAttendees, normalize) {
  const next = structuredClone(s);
  Object.assign(next, {
    eventName: s.eventName ? `${s.eventName.slice(0, 145)} (새 행사)` : "",
    date: "",
    venueStatus: "unknown",
    parkingStatus: "unknown",
    checks: {},
    onsiteChecks: {},
    afterChecks: {},
    afterNote: "",
    foodTime: "",
    arrivalNote: "",
    foodPeople: "",
    people: "",
    borrowed: "unknown",
    followupAdmin: "unknown",
    roles: {},
    step: 1,
    view: "prep",
  });
  next.agenda = s.agenda.map((a) => ({ ...a, role: "" }));
  next.attendees = keepAttendees
    ? s.attendees.map((p) => ({ ...p, arrived: false }))
    : [];
  next.cues = s.cues.map((c) => ({ ...c, time: "", owner: "" }));
  next.cueBasis = "";
  return normalize(next);
}
