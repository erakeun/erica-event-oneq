import { EVENTS } from "./data.js?v=0.4.0";
import { LEGACY_AGENDAS } from "./legacy-agendas.js?v=0.4.0";
export const AGENDA_LIMIT = 50;
const clean = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
const fields = { title: 100, role: 160, what: 400, check: 600, script: 2400 };
export const defaultAgenda = (event) =>
  EVENTS.find((e) => e.id === event).agenda.map((a) => ({
    id: a.id,
    included: true,
    title: a.title,
    role: a.role,
    what: a.what,
    check: a.check,
    script: a.script,
  }));
export function resolveAgendaRow(s, row) {
  const source = EVENTS.find((e) => e.id === s.event)?.agenda.find(
    (a) => a.id === row.id,
  );
  return {
    id: row.id,
    included: row.included !== false,
    title: row.title?.trim() || source?.title || "제목 미입력",
    role: row.role ?? source?.role ?? "",
    what: row.what ?? source?.what ?? "",
    check: row.check ?? source?.check ?? "",
    script: row.script ?? source?.script ?? "",
  };
}
export const selectedAgenda = (s) =>
  s.agenda.filter((a) => a.included).map((a) => resolveAgendaRow(s, a));
export function normalizeAgenda(raw, event, version) {
  const seen = new Set(),
    legacy = LEGACY_AGENDAS[event] || [],
    defaults = defaultAgenda(event);
  const source = version < 4 ? legacy : defaults;
  const rows = (Array.isArray(raw) ? raw : source)
    .slice(0, AGENDA_LIMIT)
    .filter(
      (a) =>
        a &&
        typeof a.id === "string" &&
        /^[a-zA-Z0-9_-]{1,80}$/.test(a.id) &&
        !seen.has(a.id) &&
        seen.add(a.id),
    )
    .map((a) => {
      const base =
        source.find((x) => x.id === a.id) ||
        defaults.find((x) => x.id === a.id) ||
        legacy.find((x) => x.id === a.id);
      if (!base && !a.id.startsWith("custom-")) return null;
      const next = { id: a.id, included: a.included !== false };
      for (const [key, max] of Object.entries(fields))
        next[key] = clean(a[key] ?? base?.[key], max);
      return next;
    })
    .filter(Boolean);
  // Older versions stored IDs only and always had the whole list. Preserve their original flow.
  if (
    version < 4 &&
    !(Array.isArray(raw) && raw.some((a) => typeof a?.title === "string"))
  )
    rows.push(
      ...legacy
        .filter((a) => !seen.has(a.id))
        .map((a) => ({
          id: a.id,
          included: true,
          title: a.title,
          role: a.role,
          what: a.what,
          check: a.check,
          script: a.script,
        })),
    );
  return rows;
}
export function newAgendaRow(id) {
  return {
    id,
    included: true,
    title: "새 식순",
    role: "",
    what: "",
    check: "",
    script: "",
  };
}
export function editAgendaRow(s, id, field, value) {
  if (!Object.hasOwn(fields, field)) return s.agenda;
  return s.agenda.map((a) =>
    a.id === id
      ? { ...resolveAgendaRow(s, a), [field]: clean(value, fields[field]) }
      : a,
  );
}
export function scenarioText(s) {
  const rows = selectedAgenda(s);
  return [
    "진행 시나리오 · 작성 참고용",
    "수정한 식순 순서에 맞춘 참고 원고입니다. 확정 공식 원고가 아니며 호칭·시간·현장 여건을 직접 확인하세요.",
    "",
    ...rows.map(
      (a, i) =>
        `${String(i + 1).padStart(2, "0")}. ${a.title}\n역할/담당: ${a.role || "직접 정하세요"}\n${a.script ? a.script.replaceAll("[전체 식순 안내]", `오늘은 ${rows.map((r) => r.title).join(", ")} 순으로 진행하겠습니다.`) : "진행 멘트를 직접 작성하세요."}`,
    ),
  ].join("\n\n");
}

// Change detection only, not a security digest. Avoid copying entire scripts into every checklist signature.
export function agendaFingerprint(rows) {
  const text = JSON.stringify(rows);
  let first = 2166136261,
    second = 5381;
  for (let i = 0; i < text.length; i++) {
    const n = text.charCodeAt(i);
    first = Math.imul(first ^ n, 16777619);
    second = Math.imul(second, 33) ^ n;
  }
  return `${text.length}:${first >>> 0}:${second >>> 0}`;
}
