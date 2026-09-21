import {
  STORAGE_KEY,
  STEPS,
  VENUES,
  EVENTS,
  LINKS,
  TEMPLATES,
  OUTPUTS,
} from "./data.js?v=0.3";
import {
  operationDefaults,
  operationPrep,
  reconcileOperations,
  buildOnsite,
  buildAfter,
  invitationText,
  fieldSummary,
} from "./operations.js?v=0.3";
import {
  logisticsView,
  photoChoices,
  roleEditor,
  operationTabs,
  unresolvedView,
  onsiteView,
  roleView,
  afterView,
  timelineView,
  invitationMissing,
} from "./operations-view.js?v=0.3";
import { ROLE_TEMPLATES, GUEST_NEEDS } from "./data.js?v=0.3";

export const STATUS_LABELS = {
  todo: "할 일",
  done: "직접 확인 완료",
  na: "해당 없음",
};
const allowed = (value, list, fallback) =>
  list.includes(value) ? value : fallback;
const safeText = (value, max = 160) =>
  typeof value === "string" ? value.slice(0, max) : "";
export const eventFor = (state) =>
  EVENTS.find((e) => e.id === state.event) || EVENTS.at(-1);
export const venueFor = (state) =>
  VENUES.find((v) => v.id === state.venue) || VENUES.at(-1);
export const defaultAgenda = (event) =>
  EVENTS.find((e) => e.id === event).agenda.map((a) => ({
    id: a.id,
    included: true,
  }));
export function createState() {
  return {
    ...operationDefaults(),
    version: 3,
    step: 0,
    venue: "unknown",
    venueStatus: "unknown",
    otherVenue: "",
    event: "other",
    eventName: "",
    date: "",
    people: "",
    vip: "unknown",
    nameplates: "later",
    seating: "later",
    publicity: "later",
    outputs: [],
    outputDecision: "later",
    agenda: defaultAgenda("other"),
    checks: {},
  };
}
export function validDate(value) {
  if (value === "") return true;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
  )
    return false;
  const [year, month, day, hour, minute] = value.split(/[-T:]/).map(Number);
  return (
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= new Date(Date.UTC(year, month, 0)).getUTCDate() &&
    hour < 24 &&
    minute < 60
  );
}
export function validPeople(value) {
  return (
    value === "" ||
    (/^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)))
  );
}
export const selectedAgenda = (state) =>
  state.agenda
    .filter((a) => a.included)
    .map((a) => eventFor(state).agenda.find((row) => row.id === a.id))
    .filter(Boolean);
export function buildChecklist(state) {
  const items = [],
    place = `${state.venue}|${state.otherVenue}|${state.venueStatus}|${state.date}${state.venueDetail ? "|" + state.venueDetail : ""}`,
    flow = `${state.event}|${state.agenda
      .filter((a) => a.included)
      .map((a) => a.id)
      .join(",")}`;
  const add = (id, group, title, detail, signature = "shared", link = null) =>
    items.push({ id, group, title, detail, signature, link });
  add(
    "venue",
    "장소·기본 준비",
    state.venue === "unknown" ? "행사 장소 정하기" : "장소 확보 여부 직접 확인",
    state.venue === "department"
      ? "부서 내 사용 가능 여부와 준비 시간을 확인하세요."
      : "선택은 예약이나 허가가 아닙니다. 확보 여부를 직접 확인하세요.",
    place,
  );
  if (state.venue !== "unknown" && state.venue !== "department")
    add(
      "rental",
      "장소·기본 준비",
      "대관 안내·이용 조건 확인",
      "확인된 담당 창구와 이용 조건을 확인하세요. 미등록 정보는 별도 확인이 필요합니다.",
      place,
    );
  add(
    "equipment",
    "장소·기본 준비",
    "필요한 장비·연결 규격 사전 확인",
    "사용할 장비와 케이블·전원 등을 준비하세요. 실제 작동은 현장점검에서 확인해요.",
    `${place}|${state.outputs.join(",")}`,
  );
  add(
    "attendee-guide",
    "장소·기본 준비",
    "참석자에게 장소·일정 안내",
    "일시와 도착 경로, 현장 안내 담당을 확인하세요.",
    `${state.venue}|${state.otherVenue}|${state.date}`,
  );
  if (!state.date)
    add(
      "date",
      "장소·기본 준비",
      "행사 일시 정하기",
      "아직 미정인 행사 일시를 확인하세요.",
    );
  add(
    "agenda",
    "식순·현장 준비",
    "최종 식순 확인",
    "포함한 순서와 진행 흐름을 내부 확인 사항에 맞게 검토하세요.",
    flow,
  );
  add(
    "roles",
    "식순·현장 준비",
    "발언·진행 역할 확인",
    "발언자, 순서와 진행 역할을 사전에 협의하세요. 예시는 공식 의전 지침이 아닙니다.",
    flow,
  );
  selectedAgenda(state).forEach((a) =>
    add(
      `material-${state.event}-${a.id}`,
      "식순·현장 준비",
      `${a.title} 준비`,
      `${a.role} · ${a.check}`,
      flow,
    ),
  );
  const seatTool = venueFor(state).seatTool;
  if (state.seating === "later")
    add(
      "seat-decision",
      "좌석·명패",
      "좌석 배치 필요 여부 정하기",
      "지정 좌석이나 배치 조정이 필요한지 확인하세요.",
      place,
    );
  if (state.seating === "needed")
    add(
      "seat",
      "좌석·명패",
      "좌석 배치 확인",
      seatTool
        ? seatTool.note
        : "전용 도면이 연결되지 않은 장소입니다. 현장 좌석과 이동 동선을 직접 확인하세요.",
      place,
      seatTool?.link || null,
    );
  if (state.nameplates === "later")
    add(
      "nameplate-decision",
      "좌석·명패",
      "명패 필요 여부 정하기",
      "명패가 필요 없다면 좌석·명패 단계에서 선택해 주세요.",
      place,
    );
  if (state.nameplates === "needed") {
    add(
      "nameplate-file",
      "좌석·명패",
      "명패 파일 만들기",
      "명단과 표기를 기존 제작기에서 직접 확인하세요.",
      `${place}|${state.nameplates}`,
      "nameplate",
    );
    add(
      "nameplate-placement",
      "좌석·명패",
      "명패 인쇄·거치대 준비",
      "출력 상태와 수량·거치대를 준비하세요. 실제 좌석 배치는 현장점검에서 확인해요.",
      `${place}|${state.nameplates}`,
    );
  }
  if (state.outputDecision === "later")
    add(
      "output-decision",
      "화면·안내물",
      "필요한 화면·안내물 정하기",
      "필요 없으면 화면·안내물 단계에서 전체 건너뛰기를 선택하세요.",
      place,
    );
  OUTPUTS.filter((o) => state.outputs.includes(o.id)).forEach((o) => {
    add(
      `output-${o.id}-file`,
      "화면·안내물",
      o.title,
      "설치 장소·규격을 확인하고 기존 도구에서 파일을 만드세요.",
      `${place}|${o.id}`,
      o.id,
    );
    add(
      `output-${o.id}-onsite`,
      "화면·안내물",
      `${LINKS[o.id].name.replace(" 제작기", "")} · 전달·설치 계획 준비`,
      "담당자에게 전달할 파일과 설치 위치를 확인하세요. 실제 송출·부착은 현장점검에서 확인해요.",
      `${place}|${o.id}`,
    );
  });
  if (state.vip === "yes") {
    add(
      "press-request",
      "홍보·촬영 협조",
      "촬영·취재 협조 요청 여부 확인",
      "요청 화면을 열어도 접수되지 않습니다. 요청 여부를 직접 확인하세요.",
      `${state.vip}|${state.date}`,
      "press",
    );
    add(
      "press-support",
      "홍보·촬영 협조",
      "촬영·취재 지원 확정 여부 확인",
      "요청 여부와 지원 확정 여부를 별도로 확인하세요.",
      `${state.vip}|${state.date}`,
    );
  } else if (state.vip === "unknown")
    add(
      "vip-confirm",
      "홍보·촬영 협조",
      "부총장 이상 참석 여부 확인",
      "참석 여부가 정해지면 촬영·취재 협조 요청 안내를 확인해 주세요.",
      state.vip,
    );
  if (state.publicity === "later")
    add(
      "pr-decision",
      "홍보·촬영 협조",
      "보도자료 제출 필요 여부 정하기",
      "부총장 이상 참석 여부와 별개로 홍보 필요 여부를 검토하세요.",
    );
  if (state.publicity === "needed")
    add(
      "pr-submit",
      "홍보·촬영 협조",
      "보도자료 제출 여부 확인",
      "기초자료를 실제 제출했는지 직접 확인하세요. 제출이 보도·게시 확정을 뜻하지는 않습니다.",
      "shared",
      "pr",
    );
  return [...items, ...operationPrep(state)];
}
export function reconcile(state) {
  const next = {};
  for (const item of buildChecklist(state)) {
    const old = state.checks[item.id];
    next[item.id] =
      old &&
      old.signature === item.signature &&
      Object.hasOwn(STATUS_LABELS, old.status)
        ? old
        : { status: "todo", signature: item.signature };
  }
  state.checks = next;
  return reconcileOperations(state);
}
export function normalizeState(raw) {
  if (!raw || typeof raw !== "object" || ![1, 2, 3].includes(raw.version))
    throw new Error("unsupported-state");
  const s = createState();
  s.step =
    Number.isInteger(raw.step) && raw.step >= 0 && raw.step < 7 ? raw.step : 0;
  s.venue = allowed(
    raw.venue,
    VENUES.map((v) => v.id),
    "unknown",
  );
  s.venueStatus = allowed(
    raw.venueStatus,
    ["secured", "needed", "unknown"],
    "unknown",
  );
  s.otherVenue = safeText(raw.otherVenue, 80);
  s.event = allowed(
    raw.event,
    EVENTS.map((e) => e.id),
    "other",
  );
  s.eventName = safeText(raw.eventName);
  s.date = validDate(raw.date) ? raw.date : "";
  s.people = validPeople(raw.people) ? raw.people : "";
  s.vip = allowed(raw.vip, ["yes", "no", "unknown"], "unknown");
  s.seating = allowed(raw.seating, ["needed", "none", "later"], "later");
  s.publicity = allowed(raw.publicity, ["needed", "none", "later"], "later");
  s.nameplates = allowed(raw.nameplates, ["needed", "none", "later"], "later");
  s.outputs = OUTPUTS.map((o) => o.id).filter(
    (id) => Array.isArray(raw.outputs) && raw.outputs.includes(id),
  );
  s.outputDecision = s.outputs.length
    ? "chosen"
    : allowed(raw.outputDecision, ["later", "none"], "later");
  const defaults = defaultAgenda(s.event),
    ids = defaults.map((a) => a.id),
    seen = new Set();
  s.agenda = (Array.isArray(raw.agenda) ? raw.agenda : [])
    .filter((a) => a && ids.includes(a.id) && !seen.has(a.id) && seen.add(a.id))
    .map((a) => ({ id: a.id, included: a.included !== false }));
  s.agenda.push(...defaults.filter((a) => !seen.has(a.id)));
  s.checks = raw.checks && typeof raw.checks === "object" ? raw.checks : {};
  for (const [field, values] of Object.entries({
    external: ["yes", "no", "unknown"],
    food: ["none", "snacks", "meal", "both", "unknown"],
    photography: ["auto", "needed", "none"],
    audio: ["needed", "none", "later"],
    borrowed: ["yes", "no", "unknown"],
    followupAdmin: ["yes", "no", "unknown"],
    view: ["prep", "onsite", "roles", "after"],
  }))
    s[field] = allowed(raw[field], values, s[field]);
  for (const [field, max] of Object.entries({
    venueDetail: 120,
    parkingNote: 240,
    arrivalNote: 240,
    contactNote: 240,
    foodTime: 80,
    foodPlace: 120,
    afterNote: 600,
  }))
    s[field] = safeText(raw[field], max);
  s.foodPeople = validPeople(raw.foodPeople) ? raw.foodPeople : "";
  s.guestNeeds = GUEST_NEEDS.map((n) => n.id).filter(
    (id) => Array.isArray(raw.guestNeeds) && raw.guestNeeds.includes(id),
  );
  s.diet = raw.diet === true;
  s.roles = Object.fromEntries(
    ROLE_TEMPLATES.filter((r) => safeText(raw.roles?.[r.id], 60).trim()).map(
      (r) => [r.id, safeText(raw.roles[r.id], 60)],
    ),
  );
  s.onsiteChecks =
    raw.onsiteChecks && typeof raw.onsiteChecks === "object"
      ? raw.onsiteChecks
      : {};
  s.afterChecks =
    raw.afterChecks && typeof raw.afterChecks === "object"
      ? raw.afterChecks
      : {};
  return reconcile(s);
}
export function loadState(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return {
      state: raw ? normalizeState(JSON.parse(raw)) : reconcile(createState()),
      message: raw
        ? "저장한 선택을 불러왔어요."
        : "선택하면 이 브라우저에 저장해요.",
    };
  } catch {
    return {
      state: reconcile(createState()),
      message: "저장한 내용을 불러오지 못했어요. 새 선택으로 계속할 수 있어요.",
    };
  }
}
export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
export function clearState(storage) {
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
export function updateState(state, field, value) {
  const next = structuredClone(state);
  if (field === "event" && value !== state.event)
    next.agenda = defaultAgenda(value);
  if (value !== state[field] && ["venue", "otherVenue"].includes(field)) {
    next.venueStatus = "unknown";
    next.venueDetail = "";
    next.parkingNote = "";
    if (field === "venue") next.otherVenue = "";
  }
  next[field] = value;
  return reconcile(next);
}
export async function verifyTemplate(template, fetcher = globalThis.fetch) {
  const path =
    typeof template === "object" && template ? template.path : template;
  const format =
    typeof template === "object" && template ? template.format : "hwp";
  if (path === null) return { ready: false, reason: "자료 준비 중" };
  if (
    typeof path !== "string" ||
    !/^assets\/templates\/[\p{L}\p{N}_ /.-]+\.(hwp|txt|docx)$/u.test(path) ||
    !["hwp", "txt", "docx"].includes(format) ||
    !path.endsWith(`.${format}`) ||
    path.split("/").some((p) => p === "." || p === "..") ||
    path.includes("//")
  )
    return { ready: false, reason: "자료 경로 확인 필요" };
  try {
    const response = await fetcher(`./${path}`, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ready: false, reason: "자료 파일 확인 필요" };
    const bytes = new Uint8Array(await response.arrayBuffer());
    const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    let valid = false;
    if (format === "hwp")
      valid = bytes.length >= 512 && signature.every((b, i) => bytes[i] === b);
    if (format === "docx")
      valid =
        bytes.length >= 100 &&
        bytes[0] === 0x50 &&
        bytes[1] === 0x4b &&
        bytes[2] === 3 &&
        bytes[3] === 4;
    if (format === "txt") {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      valid =
        text.trim().length > 30 && !/<(?:!doctype|html|body)\b/i.test(text);
      if (template.status === "sample")
        valid &&=
          text.includes("V0.2 프로토타입용 임시 샘플") &&
          text.includes("실제 양식으로 추후 교체 예정");
    }
    if (!valid)
      return { ready: false, reason: `${format.toUpperCase()} 파일 확인 필요` };
    return { ready: true, path: `./${path}` };
  } catch {
    return { ready: false, reason: "자료 연결 확인 필요" };
  }
}

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const ext = (id, label, cls = "button secondary") =>
  `<a class="${cls}" href="${LINKS[id].url}" target="_blank" rel="noopener noreferrer">${label}<span aria-hidden="true"> ↗</span><span class="sr-only"> (새 탭)</span></a>`;
const vipLabel = (s) =>
  ({ yes: "참석", no: "해당 없음", unknown: "아직 미정" })[s.vip];
const placeLabel = (s) =>
  ["other", "department"].includes(s.venue) && s.otherVenue
    ? s.otherVenue
    : venueFor(s).name;
const dateLabel = (s) => (s.date ? s.date.replace("T", " · ") : "아직 미정");
let onlyRemaining = false,
  resetNotice = "",
  storageFailed = false;
let state,
  storage,
  storageMessage,
  templateStatus = new Map();
function radios(name, values) {
  return `<div class="row">${values.map(([value, label]) => `<label class="choice compact"><input type="radio" name="${name}" value="${value}" ${state[name] === value ? "checked" : ""}>${label}</label>`).join("")}</div>`;
}
function rentalInfo() {
  const venue = venueFor(state),
    info = venue.rental;
  if (state.venue === "department")
    return '<div class="note">부서 내 사용 가능 여부와 준비 시간을 확인해 주세요.</div>';
  if (state.venue === "unknown")
    return '<div class="note">장소가 정해지지 않아도 이후 안내를 살펴볼 수 있어요. 준비표에 장소 확인을 남겨 드릴게요.</div>';
  if (!info || !Object.values(info).some(Boolean))
    return '<div class="note"><strong>대관 안내 정보 확인 필요</strong><br>확인된 담당 창구와 이용 조건을 아직 등록하지 않았어요.</div>';
  return `<div class="note"><strong>확인된 대관 안내</strong>${info.department ? `<p>담당 부서: ${esc(info.department)}</p>` : ""}${info.contact ? `<p>연락처: ${esc(info.contact)}</p>` : ""}${info.conditions ? `<p>${esc(info.conditions)}</p>` : ""}${info.url && /^https:\/\//.test(info.url) ? `<a href="${esc(info.url)}" target="_blank" rel="noopener noreferrer">예약 창구 안내 열기 ↗</a>` : ""}</div>`;
}
function venueView() {
  return `<h1>어디에서 진행하시나요?</h1><p class="intro">장소와 행사 종류를 선택하면<br>준비 순서와 필요한 도구를 안내해 드립니다.</p><fieldset style="margin:0"><legend class="sr-only">행사 장소</legend><div class="card-grid">${VENUES.map((v) => `<label class="choice ${v.id === "unknown" ? "wide" : ""}"><input type="radio" name="venue" value="${v.id}" ${v.id === state.venue ? "checked" : ""}><span class="symbol" aria-hidden="true">${v.symbol}</span><span><strong>${v.name}</strong><span class="description">${v.note}</span></span></label>`).join("")}</div></fieldset>${["other", "department"].includes(state.venue) ? `<div class="field"><label for="otherVenue">장소명 <span class="muted small">· 선택 입력</span></label><input class="input" id="otherVenue" name="otherVenue" maxlength="80" value="${esc(state.otherVenue)}" placeholder="장소가 정해지면 적어 주세요"></div>` : ""}<fieldset><legend>${state.venue === "department" ? "부서 내 장소를 확보하셨나요?" : "장소 확보 상태를 알려 주세요"}</legend>${radios(
    "venueStatus",
    [
      ["secured", "이미 확보했어요"],
      ["needed", "예약·협의가 필요해요"],
      ["unknown", "아직 확인하지 않았어요"],
    ],
  )}</fieldset>${rentalInfo()}<p class="footnote">장소 선택은 예약 처리나 이용 허가가 아닙니다.</p>`;
}
function eventView() {
  return `<h1>어떤 행사를 준비하시나요?</h1><p class="intro">정해진 내용만 알려 주세요. 나머지는 나중에 정하셔도 돼요.</p><fieldset style="margin:0"><legend class="field-label">행사 종류</legend><div class="card-grid">${EVENTS.map((e) => `<label class="choice ${e.id === "other" ? "wide" : ""}"><input type="radio" name="event" value="${e.id}" ${e.id === state.event ? "checked" : ""}><span><strong>${e.name}</strong><span class="description">${e.description}</span></span></label>`).join("")}</div></fieldset><div class="form-grid"><div class="field full"><label for="eventName">행사명 <span class="small muted">· 선택 입력</span></label><input class="input" name="eventName" id="eventName" maxlength="160" placeholder="예: 교류 협력 협약식" value="${esc(state.eventName)}"></div><div class="field"><label for="date">행사 일시 <span class="small muted">· 미정이면 비워 두세요</span></label><input class="input" type="datetime-local" name="date" id="date" value="${esc(state.date)}"></div><div class="field"><label for="people">예상 인원 <span class="small muted">· 선택 입력</span></label><input class="input" type="text" inputmode="numeric" name="people" id="people" value="${esc(state.people)}" placeholder="예: 20" aria-describedby="people-error"><div class="error" id="people-error" aria-live="polite"></div></div></div><fieldset><legend>부총장 이상 참석 여부</legend>${radios(
    "vip",
    [
      ["yes", "참석"],
      ["no", "해당 없음"],
      ["unknown", "아직 미정"],
    ],
  )}</fieldset><details class="help"><summary>이 정보는 어디에 쓰이나요?</summary><p>참석 여부에 맞춰 촬영·취재 협조 요청 경로를 안내해요. 이 분기는 원큐의 안내 기준이며, 확인된 학교 공식 규정을 뜻하지 않습니다.</p><p>실제 참석자 명단·서명자 개인정보·기부금액은 입력하지 마세요. 명단 작업은 필요한 기존 제작기에서 진행해 주세요.</p></details>${logisticsView(state)}`;
}
function requestsView() {
  return `<h1>먼저 요청할 일을 살펴보세요</h1><p class="intro">촬영 지원과 보도자료 제출은 서로 다른 일이에요.</p>${photoChoices(state)}${state.vip === "yes" ? `<article class="panel featured"><span class="tag">먼저 확인 · 부총장 이상 참석</span><h2>촬영·취재 협조 요청을 확인하세요</h2><p>행사 전에 협조 가능 여부를 확인하세요. 요청과 지원 확정은 별도로 확인해야 해요.</p>${ext("press", "촬영·취재 협조 요청 화면 열기", "button")}</article>` : state.vip === "unknown" ? '<div class="note"><strong>부총장 이상 참석 여부가 아직 미정이에요</strong><br>정해지면 행사 정보에서 바꿔 주세요. 필요한 촬영·취재 안내를 이어 드릴게요.</div>' : '<div class="note">촬영이 필요한 순서를 포함했다면 촬영 담당과 장비를 직접 준비해 주세요.</div>'}<article class="panel"><span class="tag">참석 여부와 관계없이 별도로 선택</span><h2>행사 소식을 알리고 싶으신가요?</h2><fieldset><legend>보도자료 제출을 검토하시나요?</legend>${radios(
    "publicity",
    [
      ["needed", "제출을 검토할게요"],
      ["none", "홍보가 필요 없어요"],
      ["later", "아직 미정이에요"],
    ],
  )}</fieldset>${state.publicity === "needed" ? `<p>행사 홍보를 위한 기초자료 제출 화면을 이용하세요.</p>${ext("pr", "보도자료 제출 화면 열기")}<p class="footnote">제출이 보도나 게시 확정을 뜻하지는 않습니다.</p>` : `<p class="small muted">${state.publicity === "none" ? "보도자료 제출을 준비표에서 제외했어요." : "준비표에 홍보 필요 여부 확인을 남겨 둘게요."}</p><details class="help"><summary>보도자료 제출 경로 참고</summary>${ext("pr", "보도자료 제출 화면 열기")}</details>`}</article><div class="note">링크를 열어도 요청·제출이 완료되지 않아요. 실제 처리 후 준비표에 직접 표시해 주세요.</div>`;
}
export function templatesFor(s) {
  const included = selectedAgenda(s).map((a) => a.id);
  return TEMPLATES.filter(
    (t) =>
      t.events.includes(s.event) &&
      (!t.agendaIds || t.agendaIds.some((id) => included.includes(id))),
  );
}
function templatesView() {
  return `<section class="gap"><h2>내려받아 참고하기</h2><p class="small muted">V0.2 프로토타입용 임시 샘플 · 실제 양식으로 추후 교체 예정</p><p class="small">학교 공식 문서나 확정된 진행문이 아닙니다. 다운로드는 기본 예시이며, 화면에서 바꾼 식순은 준비표 인쇄에 반영돼요.</p>${templatesFor(
    state,
  )
    .map((t) => {
      const result = templateStatus.get(t.id);
      return `<div class="template"><span><strong>${t.label}</strong><br><span class="muted small">${t.format.toUpperCase()} · ${t.status === "sample" ? "임시 샘플" : "등록 양식"}</span></span>${result?.ready ? `<a href="${esc(result.path)}" download class="button subtle" aria-label="${t.label} 다운로드">다운로드</a>` : `<span class="pending" aria-disabled="true">${result?.reason || "파일 확인 중"}</span>`}</div>`;
    })
    .join(
      "",
    )}<details class="help"><summary>환영사·사회자 예시 활용 방법</summary><p>내려받은 예시에서 행사 목적, 확인된 호칭과 발언 순서, 진행 시간을 직접 바꿔 주세요. 학교 공식 인사말이나 최종 대본이 아니며, 자동 생성 기능은 없습니다.</p></details></section>`;
}
function agendaView() {
  const event = eventFor(state);
  return `<h1>${event.short}의 흐름을 잡아 보세요</h1><p class="intro">필요한 순서만 남기고, 위아래로 옮겨 조정해 보세요.</p><div class="note warning"><strong>검토 전 진행 예시</strong><br>실제 행사와 내부 확인 사항에 맞게 조정하세요.</div><ol class="agenda-list">${state.agenda
    .map((row, i) => {
      const a = event.agenda.find((a) => a.id === row.id);
      return `<li class="agenda-item ${row.included ? "" : "excluded"}"><div class="agenda-top"><span class="agenda-order">${String(i + 1).padStart(2, "0")}</span><label><input type="checkbox" data-agenda="${a.id}" ${row.included ? "checked" : ""}><span class="agenda-title">${a.title}</span><span class="sr-only"> 포함</span></label><button class="icon-button" data-move="${a.id}" data-direction="-1" aria-label="${a.title} 위로" ${i === 0 ? "disabled" : ""}>↑</button><button class="icon-button" data-move="${a.id}" data-direction="1" aria-label="${a.title} 아래로" ${i === state.agenda.length - 1 ? "disabled" : ""}>↓</button></div>${row.included ? `<p>${a.what}</p><dl><dt>역할 예시</dt><dd>${a.role}</dd><dt>미리 확인</dt><dd>${a.check}</dd></dl><details><summary>사회자 진행 멘트 예시</summary><p class="script">“${a.script}”</p></details>` : "<p>준비표에서 제외했어요.</p>"}</li>`;
    })
    .join(
      "",
    )}</ol><button class="text-button" data-action="restore-agenda">기본 예시로 복원</button><details class="help"><summary>현장 준비물 한눈에 보기</summary>${
    selectedAgenda(state).length
      ? `<ul>${selectedAgenda(state)
          .map(
            (a) =>
              `<li class="small"><strong>${a.title}</strong> · ${a.check}</li>`,
          )
          .join("")}</ul>`
      : "<p>포함한 식순이 없어요. 필요한 순서를 선택해 주세요.</p>"
  }</details>${templatesView()}${roleEditor(state)}<p class="footnote">발언 순서·서명권자·의전 서열은 자동으로 정하지 않아요.</p>`;
}
function seatsView() {
  const venue = venueFor(state),
    tool = venue.seatTool;
  return `<h1>좌석과 명패를 준비해 볼까요?</h1><p class="intro">좌석 배치와 명패는 각각 필요한 것만 선택하세요.</p><fieldset><legend>좌석 배치를 정해야 하나요?</legend>${radios(
    "seating",
    [
      ["needed", "좌석 배치가 필요해요"],
      ["none", "좌석 배치가 필요 없어요"],
      ["later", "좌석은 나중에 정할게요"],
    ],
  )}</fieldset>${state.seating === "needed" ? (tool ? `<article class="panel featured"><span class="tag">${venue.name} 전용</span><h2>선택한 장소의 좌석 배치</h2><p>${tool.note}</p>${ext(tool.link, tool.label, "button")}</article>` : '<div class="note">이 장소의 전용 좌석 도면은 연결되어 있지 않아요. 현장 좌석과 동선을 직접 확인해 주세요.</div>') : ""}<fieldset><legend>명패가 필요하신가요?</legend>${radios(
    "nameplates",
    [
      ["needed", "명패가 필요해요"],
      ["none", "명패가 필요 없어요"],
      ["later", "명패는 나중에 정할게요"],
    ],
  )}</fieldset>${state.nameplates === "needed" ? `<article class="panel"><h2>명패 만들기</h2><p>좌석 도면 없이도 사용할 수 있어요. 필요한 이름과 직함은 기존 제작기에서 직접 입력해 주세요.</p>${ext("nameplate", "명패 제작기 열기")}</article>` : state.nameplates === "none" ? '<div class="note">명패 파일 제작과 인쇄·배치 항목을 준비표에서 제외했어요.</div>' : ""}<p class="footnote">새 탭에서 기존 도구가 열려요. 원큐의 입력 내용은 자동으로 전달되지 않습니다.</p>`;
}
function outputCard(o) {
  return `<article class="panel"><h2>${o.title}</h2><p>${o.description}</p><span class="small muted">${LINKS[o.id].name}</span><label class="tool-check"><input type="checkbox" data-output="${o.id}" ${state.outputs.includes(o.id) ? "checked" : ""}>이 결과물이 필요해요</label>${state.outputs.includes(o.id) ? ext(o.id, `${LINKS[o.id].name} 열기`) : ""}</article>`;
}
function outputsView() {
  return `<h1>어떤 화면과 안내물이 필요한가요?</h1><p class="intro">필요한 결과물만 골라 주세요. 파일 준비는 준비표에, 실제 송출·부착은 현장점검에 담아 드려요.</p><div class="row gap"><button class="button secondary" data-action="skip-outputs">화면·안내물 필요 없어요</button><button class="text-button" data-action="later-outputs">나중에 선택할게요</button></div><div class="note output-note">장소와 장비의 대응 정보는 아직 확인되지 않았어요. 설치 장소·화면 규격을 먼저 확인해 주세요.</div><div class="tool-grid">${OUTPUTS.slice(0, 3).map(outputCard).join("")}</div><details class="help"><summary>다른 제작 도구 보기</summary>${outputCard(OUTPUTS[3])}<p class="footnote">현재 선택한 장소와의 호환 여부가 확인되지 않았어요. 필요한 경우 규격을 확인한 뒤 선택하세요.</p></details>${state.outputDecision === "none" ? '<p class="small muted">화면·안내물 단계를 건너뛰었어요.</p>' : ""}<p class="footnote">제작한 파일은 원큐에 업로드하거나 보관하지 않아요.</p>`;
}
function checklistView() {
  if (state.view === "onsite")
    return operationTabs(state) + onsiteView(state, onlyRemaining);
  if (state.view === "roles") return operationTabs(state) + roleView(state);
  if (state.view === "after") return operationTabs(state) + afterView(state);
  const items = buildChecklist(state),
    groups = [...new Set(items.map((i) => i.group))],
    done = items.filter((i) => state.checks[i.id].status === "done").length;
  return `${operationTabs(state)}<h1>내 행사 준비표</h1>${timelineView()}${unresolvedView(state)}<p class="intro">행사 전에 무엇을 준비해야 하는지 확인해요.<br>실제 배치·작동은 별도의 현장점검에서 확인하세요.</p><dl class="event-facts"><div><dt>행사명</dt><dd>${esc(state.eventName) || "아직 미정"}</dd></div><div><dt>일시</dt><dd>${esc(dateLabel(state))}</dd></div><div><dt>장소</dt><dd>${esc(placeLabel(state))}</dd></div><div><dt>행사 종류</dt><dd>${eventFor(state).name}</dd></div><div><dt>예상 인원</dt><dd>${state.people ? esc(state.people) + "명" : "아직 미정"}</dd></div><div><dt>부총장 이상 참석</dt><dd>${vipLabel(state)}</dd></div></dl><div class="row no-print"><button class="button" data-view="onsite">행사 시작 전 최종점검 →</button><button class="button secondary" data-action="print">준비표 인쇄</button><button class="button secondary" data-step="0">선택 내용 수정</button></div><p class="check-summary">직접 확인 완료 <strong>${done}개</strong> · 할 일 ${items.filter((i) => state.checks[i.id].status === "todo").length}개 · 해당 없음 ${items.filter((i) => state.checks[i.id].status === "na").length}개</p>${groups
    .map(
      (group) =>
        `<section class="checklist-group"><div class="group-heading"><h2>${group}</h2><button class="text-button no-print" data-step="${{ "장소·기본 준비": 0, "식순·현장 준비": 3, "좌석·명패": 4, "화면·안내물": 5, "홍보·촬영 협조": 2, "외부 참석자 안내": 1, "다과·식사": 1 }[group]}">선택 수정</button></div>${items
          .filter((i) => i.group === group)
          .map(
            (i) =>
              `<div class="check-row" data-status="${state.checks[i.id].status}" data-item="${i.id}"><div><h3>${i.title}</h3><p>${esc(i.detail)}</p>${i.link ? `<p class="no-print">${ext(i.link, `${LINKS[i.link].name} 열기`, "small")}</p>` : ""}</div><label class="sr-only" for="check-${i.id}">${i.title} 상태</label><select id="check-${i.id}" data-check="${i.id}">${Object.entries(
                STATUS_LABELS,
              )
                .map(
                  ([key, label]) =>
                    `<option value="${key}" ${state.checks[i.id].status === key ? "selected" : ""}>${label}</option>`,
                )
                .join(
                  "",
                )}</select><span class="print-status">${STATUS_LABELS[state.checks[i.id].status]}</span></div>`,
          )
          .join("")}</section>`,
    )
    .join(
      "",
    )}<section class="selected-agenda"><h2>내가 선택한 식순</h2><ol>${selectedAgenda(
    state,
  )
    .map((a) => `<li class="small">${a.title}</li>`)
    .join(
      "",
    )}</ol></section><div class="note">이 준비표는 직접 확인을 돕는 안내입니다. 실제 예약·접수·지원 상태와 행사 준비 완료를 자동으로 확인하지 않습니다.</div>`;
}
function summaryRender() {
  const alert = document.querySelector("#storage-alert");
  if (alert) {
    alert.hidden = !storageFailed;
    alert.textContent = storageFailed
      ? "이 브라우저에 저장하지 못했어요. 창을 닫거나 새로고침하면 입력을 잃을 수 있어요. 필요한 내용을 인쇄·복사해 보관하세요."
      : "";
  }
  document.querySelector("#summary").innerHTML =
    `<div class="summary-card"><div class="summary-head"><h2>선택한 내용</h2><span>MY EVENT</span></div><div class="summary-body"><dl><div><dt>장소</dt><dd>${esc(placeLabel(state))}</dd></div><div><dt>행사 종류</dt><dd>${eventFor(state).name}</dd></div><div><dt>부총장 이상 참석</dt><dd>${vipLabel(state)}</dd></div>${state.eventName ? `<div><dt>행사명</dt><dd>${esc(state.eventName)}</dd></div>` : ""}</dl><button class="text-button" data-view="prep">내 행사 준비표 보기 →</button><button class="text-button" data-view="onsite">행사 당일 현장점검 →</button></div></div><div class="storage" role="status"><strong>${esc(storageMessage)}</strong><p>이 브라우저에만 보관해요.<br>다른 기기와 자동으로 공유되지 않아요.</p></div><details class="help"><summary>원큐는 어떤 도구인가요?</summary><p>PROJECT MACH에 속한 독립 도구예요. 기존 도구와 필요한 준비를 연결해 드립니다.</p>${ext("mach", "PROJECT MACH 살펴보기", "small")}</details>`;
}
function render(focus = null) {
  const openDetails = new Set(
    [...document.querySelectorAll("details[open]")].map(
      (el) => el.querySelector("summary")?.textContent,
    ),
  );
  document.querySelector("#steps").innerHTML =
    `<p class="eyebrow">행사 준비 길잡이</p><ol>${STEPS.map((label, i) => `<li><button data-step="${i}" ${state.step === i ? 'aria-current="step"' : ""}><span class="number">${i + 1}</span>${label}</button></li>`).join("")}</ol><p class="nav-note">단계는 안내 순서예요.<br>준비 완료율을 뜻하지 않아요.<br>원하는 단계로 이동할 수 있어요.</p>`;
  const views = [
    venueView,
    eventView,
    requestsView,
    agendaView,
    seatsView,
    outputsView,
    checklistView,
  ];
  document.querySelector("#main").innerHTML =
    `<div class="content"><p class="eyebrow">${String(state.step + 1).padStart(2, "0")} / ${STEPS[state.step]}</p>${resetNotice ? `<div class="note warning no-print" role="status">${esc(resetNotice)}</div>` : ""}${views[state.step]()}</div><div class="footer-nav">${state.step > 0 ? `<button class="button secondary" data-step="${state.step - 1}">← 이전</button>` : ""}${state.step < 6 ? `<button class="button next" data-step="${state.step + 1}">${state.step === 5 ? "준비표 보기" : `다음: ${STEPS[state.step + 1]}`} <span aria-hidden="true">→</span></button>` : ""}</div>`;
  summaryRender();
  for (const el of document.querySelectorAll("details"))
    if (openDetails.has(el.querySelector("summary")?.textContent))
      el.open = true;
  if (focus) document.querySelector(focus)?.focus({ preventScroll: true });
}
function persist() {
  storageFailed = !saveState(storage, state);
  storageMessage = !storageFailed
    ? "이 브라우저에 저장했어요."
    : "브라우저에 저장하지 못했어요. 현재 화면에서는 계속 이용할 수 있어요.";
}
function announce(message) {
  document.querySelector("#announce").textContent = message;
}
function change(field, value, focus) {
  updateWithNotice(field, value);
  persist();
  render(focus);
}
function updateWithNotice(field, value) {
  const before = state.onsiteChecks;
  state = updateState(state, field, value);
  const count = Object.entries(before).filter(
    ([id, v]) =>
      v.status === "done" && state.onsiteChecks[id]?.status === "todo",
  ).length;
  if (count)
    resetNotice = `선택이 바뀌어 관련 현장점검 ${count}개를 미확인으로 되돌렸어요.`;
}
function navigate(step, record = true, view = "prep") {
  if (step < 0 || step > 6) return;
  if (record && (step !== state.step || view !== state.view))
    history.pushState(
      { oneqStep: step, oneqView: view },
      "",
      `#step-${step + 1}${step === 6 ? "/" + view : ""}`,
    );
  state.step = step;
  state.view = view;
  persist();
  render();
  document.querySelector("#main").focus();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function confirmation(title, description, action) {
  const dialog = document.querySelector("#confirm-dialog");
  document.querySelector("#dialog-title").textContent = title;
  document.querySelector("#dialog-description").textContent = description;
  dialog.returnValue = "";
  dialog.addEventListener(
    "close",
    () => {
      if (dialog.returnValue === "confirm") action();
    },
    { once: true },
  );
  dialog.showModal();
}
function handleInput(e) {
  const el = e.target;
  if (el.dataset.role) {
    const roles = { ...state.roles };
    if (el.value.trim()) roles[el.dataset.role] = el.value.slice(0, 60);
    else delete roles[el.dataset.role];
    updateWithNotice("roles", roles);
    persist();
    summaryRender();
    if (state.step === 6 && state.view === "roles")
      document.querySelector(".role-sheet").innerHTML = ROLE_TEMPLATES.filter(
        (r) => state.roles[r.id]?.trim(),
      )
        .map(
          (r) =>
            `<div><dt>${r.label}</dt><dd>${esc(state.roles[r.id])}</dd></div>`,
        )
        .join("");
    const emptyRoleNotice = document.querySelector(".roles-empty");
    if (emptyRoleNotice)
      emptyRoleNotice.hidden = Object.values(state.roles).some((value) =>
        value.trim(),
      );
    return;
  }
  if (
    ![
      "otherVenue",
      "eventName",
      "date",
      "people",
      "venueDetail",
      "parkingNote",
      "arrivalNote",
      "contactNote",
      "foodPeople",
      "foodTime",
      "foodPlace",
      "afterNote",
    ].includes(el.name)
  )
    return;
  if (["people", "foodPeople"].includes(el.name)) {
    const valid = validPeople(el.value);
    el.setAttribute("aria-invalid", String(!valid));
    document.querySelector(
      `#${el.name === "people" ? "people" : el.name}-error`,
    ).textContent = valid
      ? ""
      : "1 이상의 정수를 입력해 주세요. 올바르지 않은 값은 저장하지 않아요.";
    if (!valid) {
      updateWithNotice(el.name, "");
      persist();
      summaryRender();
      return;
    }
  }
  updateWithNotice(el.name, el.value);
  if (el.name === "otherVenue") {
    document.querySelectorAll('input[name="venueStatus"]').forEach((input) => {
      input.checked = input.value === state.venueStatus;
    });
  }
  persist();
  summaryRender();
  const preview = document.querySelector("#invitation");
  if (preview) {
    preview.value = invitationText(state);
    document.querySelector("#invitation-missing").textContent =
      invitationMissing(state);
  }
  if (el.name === "afterNote")
    document.querySelector(".print-note").textContent = el.value;
}
function handleChange(e) {
  const el = e.target;
  if (
    el.type === "radio" &&
    [
      "venue",
      "venueStatus",
      "event",
      "vip",
      "nameplates",
      "seating",
      "publicity",
      "external",
      "food",
      "photography",
      "audio",
      "borrowed",
      "followupAdmin",
    ].includes(el.name)
  ) {
    const before = state;
    change(el.name, el.value, `input[name="${el.name}"][value="${el.value}"]`);
    if (
      ["venue", "event", "vip"].includes(el.name) &&
      before[el.name] !== el.value
    )
      announce(
        "선택에 맞춰 준비표를 갱신했어요. 관련 항목을 다시 확인해 주세요.",
      );
    return;
  }
  if (el.dataset.guest) {
    change(
      "guestNeeds",
      GUEST_NEEDS.map((n) => n.id).filter((id) =>
        id === el.dataset.guest ? el.checked : state.guestNeeds.includes(id),
      ),
      `[data-guest="${el.dataset.guest}"]`,
    );
    return;
  }
  if (el.name === "diet") {
    change("diet", el.checked, '[name="diet"]');
    return;
  }
  if (el.id === "remaining-only") {
    onlyRemaining = el.checked;
    render("#remaining-only");
    return;
  }
  if (el.dataset.onsite || el.dataset.after) {
    const key = el.dataset.onsite ? "onsiteChecks" : "afterChecks",
      id = el.dataset.onsite || el.dataset.after;
    state[key][id].status = el.checked ? "done" : "todo";
    persist();
    const top = scrollY;
    render(`[data-${key === "onsiteChecks" ? "onsite" : "after"}="${id}"]`);
    if (key === "onsiteChecks" && onlyRemaining)
      document
        .querySelector(".field-check:not(.filtered) input, #remaining-only")
        ?.focus({ preventScroll: true });
    window.scrollTo({ top, behavior: "instant" });
    return;
  }
  if (el.dataset.agenda) {
    const agenda = state.agenda.map((a) =>
      a.id === el.dataset.agenda ? { ...a, included: el.checked } : a,
    );
    change("agenda", agenda, `[data-agenda="${el.dataset.agenda}"]`);
  }
  if (el.dataset.output) {
    const outputs = OUTPUTS.map((o) => o.id).filter((id) =>
      id === el.dataset.output ? el.checked : state.outputs.includes(id),
    );
    state.outputDecision = outputs.length ? "chosen" : "none";
    change("outputs", outputs, `[data-output="${el.dataset.output}"]`);
  }
  if (el.dataset.check) {
    state.checks[el.dataset.check].status = el.value;
    persist();
    render(`[data-check="${el.dataset.check}"]`);
  }
}
function handleClick(e) {
  const button = e.target.closest("button");
  if (!button) return;
  if (button.dataset.view) {
    navigate(6, true, button.dataset.view);
    return;
  }
  if (button.dataset.step !== undefined) {
    navigate(Number(button.dataset.step));
    return;
  }
  if (button.dataset.move) {
    const list = structuredClone(state.agenda),
      from = list.findIndex((a) => a.id === button.dataset.move),
      to = from + Number(button.dataset.direction);
    if (to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    change("agenda", list, `[data-agenda="${button.dataset.move}"]`);
    announce("식순을 이동했어요.");
    return;
  }
  switch (button.dataset.action) {
    case "copy-invitation":
      copyText(invitationText(state));
      break;
    case "copy-field":
      copyText(fieldSummary(state));
      break;
    case "restore-agenda":
      confirmation(
        "기본 식순으로 되돌릴까요?",
        "바꾸신 식순 순서와 포함 여부가 사라지고, 관련 준비 항목을 다시 확인하게 됩니다.",
        () => {
          change("agenda", defaultAgenda(state.event));
          announce("기본 예시로 복원했어요.");
        },
      );
      break;
    case "skip-outputs":
      state.outputDecision = "none";
      change("outputs", []);
      navigate(6);
      break;
    case "later-outputs":
      state.outputDecision = "later";
      change("outputs", []);
      navigate(6);
      break;
    case "print":
      window.print();
      break;
  }
  if (button.id === "reset")
    confirmation(
      "처음부터 다시 준비할까요?",
      "원큐에 저장한 선택과 체크 상태가 지워집니다. 다른 제작기에 저장한 내용은 그대로 유지됩니다.",
      () => {
        const success = clearState(storage);
        state = reconcile(createState());
        onlyRemaining = false;
        resetNotice = "";
        storageFailed = !success;
        history.replaceState({ oneqStep: 0 }, "", "#step-1");
        storageMessage = success
          ? "원큐의 저장 내용만 지웠어요."
          : "저장 내용을 지우지 못했어요. 새로고침하면 이전 선택이 다시 나타날 수 있어요.";
        render();
        document.querySelector("#main").focus();
        window.scrollTo({ top: 0, behavior: "instant" });
      },
    );
}
async function copyText(text) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    const box = document.createElement("textarea");
    box.value = text;
    box.setAttribute("aria-label", "복사할 내용");
    box.style.position = "fixed";
    box.style.left = "-9999px";
    document.body.append(box);
    box.select();
    try {
      ok = document.execCommand("copy");
    } catch {}
    box.remove();
  }
  document
    .querySelectorAll(".copy-status")
    .forEach(
      (el) =>
        (el.textContent = ok
          ? "복사했어요. 내용을 확인한 뒤 직접 전달하세요."
          : "복사하지 못했어요. 아래 내용을 직접 선택해 복사하세요."),
    );
  if (!ok) {
    const area = document.createElement("textarea");
    area.className = "input";
    area.readOnly = true;
    area.value = text;
    area.setAttribute("aria-label", "직접 복사할 내용");
    document.querySelector(".copy-status")?.after(area);
    area.focus();
    area.select();
  }
}
async function boot() {
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  ({ state, message: storageMessage } = loadState(storage));
  const hashStep = /^#step-([1-7])(?:\/(prep|onsite|roles|after))?$/.exec(
    location.hash,
  );
  if (hashStep) {
    state.step = Number(hashStep[1]) - 1;
    if (hashStep[2]) state.view = hashStep[2];
  }
  history.replaceState(
    { oneqStep: state.step, oneqView: state.view },
    "",
    `#step-${state.step + 1}${state.step === 6 ? "/" + state.view : ""}`,
  );
  window.addEventListener("popstate", (e) => {
    if (Number.isInteger(e.state?.oneqStep))
      navigate(e.state.oneqStep, false, e.state.oneqView || "prep");
  });
  render();
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleChange);
  document.addEventListener("click", handleClick);
  document.querySelector(".brand").addEventListener("click", (e) => {
    e.preventDefault();
    navigate(0);
  });
  await Promise.all(
    TEMPLATES.map(async (t) =>
      templateStatus.set(t.id, await verifyTemplate(t)),
    ),
  );
  if (state.step === 3) render();
}
if (typeof document !== "undefined") boot();
