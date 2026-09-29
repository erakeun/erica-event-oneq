import { matches } from "./operations.js?v=0.6.0";

export const STAFF_LIMIT = 100;
export const TASK_LIMIT = 300;
export const PHASES = { prep: "행사 전 준비", day: "행사 당일 운영" };
export const TASK_STATUS = {
  unassigned: "미배정",
  planned: "예정",
  active: "진행 중",
  done: "완료",
};
export const roleDefaults = () => ({ staff: [], roleTasks: [] });
export const blankTask = (id) => ({
  id,
  title: "",
  primary: "",
  assistant: "",
  phase: "prep",
  description: "",
  location: "",
  start: "",
  end: "",
  due: "",
  status: "unassigned",
  note: "",
  source: "",
});
const clean = (v, n) =>
  typeof v === "string" ? v.replace(/\u0000/g, "").slice(0, n) : "";
const idOK = (v) =>
  typeof v === "string" &&
  /^[\w-]{1,80}$/.test(v) &&
  !["__proto__", "constructor", "prototype"].includes(v);
const timeOK = (v) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
const dateOK = (v) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
export function normalizeAssignments(raw) {
  const ids = new Set();
  const rows = (value, limit) => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > limit)
      throw Error("역할분담 목록의 형식 또는 개수를 확인하세요.");
    return value.map((r) => {
      if (!r || !idOK(r.id) || ids.has(r.id))
        throw Error("역할분담 ID가 잘못되었거나 중복되었습니다.");
      ids.add(r.id);
      return r;
    });
  };
  const staff = rows(raw.staff, STAFF_LIMIT).map((p) => ({
    id: p.id,
    name: clean(p.name, 80),
    org: clean(p.org, 120),
    contact: clean(p.contact, 120),
  }));
  const known = new Set(staff.map((p) => p.id));
  const roleTasks = rows(raw.roleTasks, TASK_LIMIT).map((r) => {
    const t = blankTask(r.id);
    for (const [key, n] of Object.entries({
      title: 160,
      description: 1000,
      location: 160,
      note: 1000,
      source: 100,
    }))
      t[key] = clean(r[key], n);
    t.phase = Object.hasOwn(PHASES, r.phase) ? r.phase : "prep";
    t.primary = known.has(r.primary) ? r.primary : "";
    t.assistant =
      known.has(r.assistant) && r.assistant !== t.primary ? r.assistant : "";
    t.status = Object.hasOwn(TASK_STATUS, r.status) ? r.status : "unassigned";
    t.start = timeOK(r.start) ? r.start : "";
    t.end = timeOK(r.end) ? r.end : "";
    t.due = dateOK(r.due) ? r.due : "";
    return t;
  });
  if (
    staff.some((p) => !p.name.trim()) ||
    roleTasks.some((t) => !t.title.trim())
  )
    throw Error("담당자 이름과 업무명을 입력하세요.");
  return { staff, roleTasks };
}
const prep = [
  [
    "venue",
    "장소 예약/확인",
    "예약 확정과 준비·철수 가능한 시간을 확인하세요.",
  ],
  [
    "roster",
    "참석자 명단 확인",
    "기관·직책·성명과 최종 참석 여부를 확인하세요.",
  ],
  [
    "vip",
    "VIP 참석 여부 확인",
    "도착 시간, 영접 동선과 대기 공간을 협의하세요.",
  ],
  ["parking", "참석자 주차 등록", "등록 대상과 완료 여부를 확인하세요."],
  ["seating", "좌석배치표 확정", "최종 명단과 좌석배치표를 대조하세요."],
  [
    "nameplates",
    "명패 제작 및 배치",
    "성명·직책, 출력 수량과 거치대를 확인하세요.",
  ],
  [
    "screen",
    "LED 화면 콘텐츠 제작",
    "실제 화면 규격, 최종 파일과 예비 파일을 확인하세요.",
  ],
  ["notice", "안내문 제작", "방문 경로와 행사장 입구의 표기를 확인하세요."],
  [
    "video",
    "PPT/영상 준비",
    "재생 기기에서 미리 재생하고 파일을 별도로 보관하세요.",
  ],
  ["agenda", "식순 확정", "발언자와 각 순서의 소요 시간을 확인하세요."],
  ["script", "시나리오 준비", "호칭·발음·진행 신호를 사회자와 확인하세요."],
  ["publicity", "보도자료 준비", "제출 내용과 담당 창구를 확인하세요."],
  ["photo", "사진촬영 요청", "촬영 가능 여부와 필수 촬영 장면을 협의하세요."],
  ["food", "다과/식사 준비", "인원·수령 시간·배치 장소를 확인하세요."],
  ["gift", "기념품 준비", "수량, 포장과 전달 대상을 확인하세요."],
  [
    "supplies",
    "행사 물품 준비",
    "서명펜, 문서, 테이프와 예비 소모품을 챙기세요.",
  ],
  [
    "setup",
    "행사장 사전 세팅",
    "책상·의자·표지·장비를 배치하고 동선을 점검하세요.",
  ],
  ["other", "기타 준비", "행사에 필요한 추가 준비를 적으세요."],
];
const day = [
  ["lead", "행사 총괄", "전체 진행 상황을 확인하고 결정 사항을 전달하세요."],
  [
    "greet",
    "내빈 영접",
    "도착 지점에서 만나 대기실 또는 행사장으로 안내하세요.",
  ],
  [
    "waiting",
    "대기실 담당",
    "도착 현황과 입장 시점을 진행 담당자에게 알리세요.",
  ],
  ["reception", "등록/접수", "참석 확인과 배부물을 준비하세요."],
  ["guide", "참석자 안내", "입구·화장실·행사장 동선을 안내하세요."],
  ["parking", "주차 대응", "진입 경로와 등록 문제 문의에 대응하세요."],
  [
    "seating",
    "좌석 안내",
    "최종 좌석배치표와 명패를 확인하고 착석을 안내하세요.",
  ],
  ["mc", "사회/진행", "확정 식순과 시나리오에 따라 진행하세요."],
  ["cue", "시나리오 큐", "사회자·음향·화면 담당에게 진행 신호를 전달하세요."],
  [
    "screen",
    "화면 송출 확인",
    "PPT/영상/LED 화면을 전환하고 예비 파일을 준비하세요.",
  ],
  [
    "audio",
    "마이크/음향",
    "마이크와 음량을 확인하고 발언 순서에 맞춰 전달하세요.",
  ],
  ["photo", "사진촬영", "필수 장면과 기념촬영 위치를 확인하세요."],
  ["gift", "기념품 전달", "대상과 수량을 확인하고 전달하세요."],
  ["food", "다과 세팅", "수령·배치·추가 공급과 회수를 담당하세요."],
  ["time", "시간 관리", "발언 시간과 다음 순서 준비 상황을 확인하세요."],
  [
    "cleanup",
    "행사장 정리",
    "반납 물품·분실물·쓰레기와 원상복구를 확인하세요.",
  ],
  [
    "incident",
    "돌발상황 대응",
    "지연·장비 장애 발생 시 총괄에게 알리고 대안을 실행하세요.",
  ],
  ["other", "기타 운영", "행사 당일 추가 업무를 적으세요."],
];
export const TASK_TEMPLATES = [
  ...prep.map((r) => ["prep", ...r]),
  ...day.map((r) => ["day", ...r]),
].map(([phase, key, title, description]) => ({
  ...blankTask("template-" + phase + "-" + key),
  phase,
  title,
  description,
  source: phase + ":" + key,
}));
export function assignmentCandidates(s) {
  const keys = new Set([
    "prep:venue",
    "prep:roster",
    "prep:agenda",
    "prep:script",
  ]);
  const add = (condition, ...values) => {
    if (condition) values.forEach((v) => keys.add(v));
  };
  add(matches(s, "parking"), "prep:parking", "day:parking");
  add(matches(s, "nameplates"), "prep:nameplates");
  add(matches(s, "photo"), "prep:photo", "day:photo");
  add(matches(s, "screen"), "prep:screen", "day:screen");
  add(matches(s, "seating"), "prep:seating", "day:seating");
  add(matches(s, "food"), "prep:food", "day:food");
  add(matches(s, "audio"), "day:audio");
  add(s.outputs.includes("notice"), "prep:notice");
  add(s.publicity === "needed", "prep:publicity");
  add(s.vip === "yes", "prep:vip", "day:greet", "day:waiting");
  return TASK_TEMPLATES.filter((t) => keys.has(t.source));
}
const titleKey = (t) =>
  t.phase + ":" + t.title.normalize("NFKC").replace(/\s/g, "").toLowerCase();
export function hasTask(tasks, candidate) {
  return tasks.some(
    (t) =>
      (candidate.source && t.source === candidate.source) ||
      titleKey(t) === titleKey(candidate),
  );
}
export function addAssignmentTasks(s, candidates, makeId) {
  const next = structuredClone(s);
  for (const c of candidates)
    if (!hasTask(next.roleTasks, c))
      next.roleTasks.push({ ...c, id: makeId() });
  if (next.roleTasks.length > TASK_LIMIT)
    throw Error(`업무는 ${TASK_LIMIT}개까지 추가할 수 있어요.`);
  return next;
}
export function deleteStaff(s, id) {
  return {
    ...s,
    staff: s.staff.filter((p) => p.id !== id),
    roleTasks: s.roleTasks.map((t) => ({
      ...t,
      primary: t.primary === id ? "" : t.primary,
      assistant: t.assistant === id ? "" : t.assistant,
      status: t.primary === id ? "unassigned" : t.status,
    })),
  };
}
export const taskPeople = (t) => [
  ...new Set([t.primary, t.assistant].filter(Boolean)),
];
export function taskTimeIssue(t) {
  if (t.phase !== "day") return "";
  if (!t.start || !t.end)
    return "시간 미정 · 시작과 종료를 모두 입력하면 충돌을 확인해요.";
  if (t.end <= t.start)
    return "종료는 시작 이후로 입력하세요. 자정을 넘으면 업무를 나누세요.";
  return "";
}
export function assignmentConflicts(s) {
  const pairs = [];
  const tasks = s.roleTasks.filter(
    (t) => t.phase === "day" && !taskTimeIssue(t),
  );
  for (let i = 0; i < tasks.length; i++)
    for (let j = i + 1; j < tasks.length; j++) {
      const a = tasks[i],
        b = tasks[j];
      if (a.start < b.end && b.start < a.end)
        for (const person of taskPeople(a).filter((p) =>
          taskPeople(b).includes(p),
        ))
          pairs.push({ person, a, b });
    }
  return pairs;
}
export function sortedTasks(tasks) {
  return [...tasks].sort(
    (a, b) =>
      (a.phase === b.phase ? 0 : a.phase === "prep" ? -1 : 1) ||
      (a.phase === "prep" ? a.due || "9999" : a.start || "99").localeCompare(
        b.phase === "prep" ? b.due || "9999" : b.start || "99",
      ) ||
      a.title.localeCompare(b.title, "ko"),
  );
}
export function assignmentTimeline(s, tasks = s.roleTasks) {
  return [
    ...tasks
      .filter((t) => t.phase === "day")
      .map((t) => ({ ...t, kind: "운영", time: t.start })),
    ...s.cues.map((c) => ({
      ...c,
      kind: "식순·큐",
      description: c.action,
      location: "",
    })),
  ].sort(
    (a, b) =>
      (a.time || "99").localeCompare(b.time || "99") ||
      (a.kind === b.kind ? 0 : a.kind === "식순·큐" ? -1 : 1),
  );
}
