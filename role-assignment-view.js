import { esc, eventHeading } from "./operations-view.js?v=0.6.0";
import {
  PHASES,
  TASK_STATUS,
  sortedTasks,
  assignmentConflicts,
  taskTimeIssue,
  assignmentTimeline,
  taskPeople,
} from "./role-assignment.js?v=0.6.0";
import { cueStale } from "./event-workspace.js?v=0.6.0";
export const roleUI = {
  view: "all",
  phase: "all",
  person: "all",
  status: "all",
};
const btn = (action, label, extra = "") =>
  `<button class="button secondary" data-assignment="${action}" ${extra}>${label}</button>`;
export const personName = (s, id) =>
  s.staff.find((p) => p.id === id)?.name || "미배정";
const personLabel = (p) => p.name + (p.org ? " · " + p.org : "");
export const staffOptions = (s, value = "", empty = "미배정") =>
  `<option value="">${empty}</option>${s.staff.map((p) => `<option value="${esc(p.id)}" ${value === p.id ? "selected" : ""}>${esc(personLabel(p))}</option>`).join("")}`;
const timeLabel = (t) =>
  t.phase === "prep"
    ? t.due || "기한 미정"
    : `${t.start || "미정"}–${t.end || "미정"}`;
const options = (items, value) =>
  Object.entries(items)
    .map(
      ([key, label]) =>
        `<option value="${key}" ${value === key ? "selected" : ""}>${label}</option>`,
    )
    .join("");
export const taskSelect = (s, t, key, label) =>
  `<label class="ra-quick"><span class="sr-only">${esc(t.title)} ${label}</span><select class="input" data-assignment-field="${key}" data-id="${esc(t.id)}" aria-label="${esc(t.title)} ${label}">${key === "status" ? options(TASK_STATUS, t.status) : staffOptions(s, t[key], key === "assistant" ? "보조 없음" : "미배정")}</select></label>`;
export function assignmentTable(s, tasks, edit = false) {
  return `<div class="ra-table-wrap"><table class="ra-table"><thead><tr>${["업무", "담당", "보조", "시간/기한", "장소", "상태", "비고"].map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${tasks.map((t) => `<tr data-task-row="${esc(t.id)}"><td><strong>${esc(t.title)}</strong><small>${PHASES[t.phase]}</small>${t.description ? `<div class="ra-description">${esc(t.description)}</div>` : ""}${edit ? `<div class="no-print">${btn("edit-task", "수정", `data-id="${esc(t.id)}"`)} ${btn("delete-task", "삭제", `data-id="${esc(t.id)}"`)}</div>` : ""}</td><td>${edit ? `<span class="ra-print-only">${esc(personName(s, t.primary))}</span><span class="no-print">${taskSelect(s, t, "primary", "담당")}</span>` : esc(personName(s, t.primary))}</td><td>${edit ? `<span class="ra-print-only">${t.assistant ? esc(personName(s, t.assistant)) : "—"}</span><span class="no-print">${taskSelect(s, t, "assistant", "보조")}</span>` : t.assistant ? esc(personName(s, t.assistant)) : "—"}</td><td>${esc(timeLabel(t))}</td><td>${esc(t.location) || "장소 미정"}</td><td>${edit ? `<span class="ra-print-only">${TASK_STATUS[t.status]}</span><span class="no-print">${taskSelect(s, t, "status", "상태")}</span>` : TASK_STATUS[t.status]}</td><td>${esc(t.note) || "—"}</td></tr>`).join("")}</tbody></table></div>`;
}
function taskCard(s, t, person) {
  return `<article class="ra-card"><p class="ra-time">${esc(timeLabel(t))} <span class="tag">${TASK_STATUS[t.status]}</span></p><h3>${esc(t.title)}${t.assistant === person ? ' <span class="tag">보조</span>' : ""}</h3><p><strong>장소</strong> ${esc(t.location) || "미정"}</p><p>${esc(t.description) || "업무 설명을 아직 입력하지 않았어요."}</p><p class="small">담당 ${esc(personName(s, t.primary))}${t.assistant ? " · 보조 " + esc(personName(s, t.assistant)) : ""}</p>${t.note ? `<p class="ra-note">${esc(t.note)}</p>` : ""}</article>`;
}
export function assignmentReport(s, tasks, ui = roleUI, edit = false) {
  if (ui.view === "mine") {
    if (ui.person === "all" || ui.person === "unassigned")
      return '<div class="note">담당자를 선택하면 행사 당일의 내 업무가 시간순으로 보여요. 보조 업무도 함께 표시해요.</div>';
    const day = sortedTasks(tasks.filter((t) => t.phase === "day"));
    return `<h2>${esc(personName(s, ui.person))} · 내 업무 보기</h2><p class="small">행사일 ${esc(s.date?.slice(0, 10)) || "미정"} 기준 · 당일 ${day.length}건</p><div class="ra-cards">${day.map((t) => taskCard(s, t, ui.person)).join("") || "<p>배정된 당일 업무가 없습니다.</p>"}</div>`;
  }
  if (ui.view === "person") {
    const conflictPeople = new Set(assignmentConflicts(s).map((c) => c.person));
    const people = s.staff.filter(
      (p) => ui.person === "all" || p.id === ui.person,
    );
    const groups = people.map((p) => ({
      p,
      tasks: sortedTasks(tasks.filter((t) => taskPeople(t).includes(p.id))),
    }));
    if (ui.person === "all" || ui.person === "unassigned")
      groups.push({
        p: { id: "unassigned", name: "미배정" },
        tasks: sortedTasks(tasks.filter((t) => !t.primary)),
      });
    return (
      groups
        .map(
          ({ p, tasks: list }) =>
            `<section class="ra-person-sheet"><p class="ra-print-only ra-person-context">${esc(s.eventName) || "행사명 미정"} · ${esc(s.date.replace("T", " ")) || "일시 미정"} · 사람별 업무표 · ${PHASES[ui.phase] || "모든 업무"} / ${TASK_STATUS[ui.status] || "모든 상태"}</p><h2>${esc(personLabel(p))} <span class="small">${list.length}건</span></h2>${p.contact ? `<p class="small">연락처 ${esc(p.contact)}</p>` : ""}${conflictPeople.has(p.id) ? '<p class="ra-print-only">⚠ 업무 시간이 겹칩니다. 담당·보조 업무 시간을 확인하세요.</p>' : ""}${list.length ? assignmentTable(s, list) : "<p>배정된 업무가 없습니다.</p>"}</section>`,
        )
        .join("") || "<p>담당자를 추가하거나 미배정 업무를 확인하세요.</p>"
    );
  }
  if (ui.view === "timeline") {
    const rows = assignmentTimeline(s, tasks);
    return `<h2>행사 당일 시간순 운영표</h2><p class="small">업무와 기존 식순·큐시트를 함께 표시합니다. 식순·큐는 담당자/상태 필터와 관계없이 전체 표시하며, 시간 미정은 맨 아래에 모았어요.</p>${cueStale(s) ? '<p class="note">식순 또는 행사 정보가 변경됐어요. 기존 큐시트를 다시 확인하세요.</p>' : ""}${!s.cues.length ? '<p class="note">식순 시간을 함께 보려면 큐시트에서 식순을 가져온 뒤 시간을 입력하세요. 업무로 복제하지 않습니다. <button class="button secondary no-print" data-view="cues">큐시트 열기</button></p>' : ""}<div class="ra-table-wrap"><table class="ra-table ra-timeline"><thead><tr><th>시간</th><th>구분 / 할 일</th><th>담당 / 보조</th><th>장소 / 설명</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.kind === "운영" ? esc(timeLabel(r)) : esc(r.time) || "시간 미정"}</td><td><span class="tag">${r.kind}</span><strong>${esc(r.title) || "제목 미정"}</strong>${r.kind === "운영" ? `<small>${TASK_STATUS[r.status]}</small>` : ""}</td><td>${r.kind === "운영" ? `${esc(personName(s, r.primary))}${r.assistant ? "<br>보조 " + esc(personName(s, r.assistant)) : ""}` : esc(r.owner) || "미정"}</td><td>${esc(r.location)}${r.description ? "<p>" + esc(r.description) + "</p>" : ""}${r.note ? "<p>" + esc(r.note) + "</p>" : ""}</td></tr>`).join("")}</tbody></table></div>`;
  }
  return `<h2>전체 역할분담표 <span class="small">${tasks.length}건</span></h2>${tasks.length ? assignmentTable(s, sortedTasks(tasks), edit) : '<div class="note">표시할 업무가 없어요. 업무를 추가하거나 필터를 확인하세요.</div>'}`;
}
export function assignmentView(s, legacy = "") {
  const ui = roleUI;
  if (!["all", "unassigned", ...s.staff.map((p) => p.id)].includes(ui.person))
    ui.person = "all";
  const tasks = s.roleTasks.filter(
    (t) =>
      (ui.phase === "all" || t.phase === ui.phase) &&
      (ui.person === "all" ||
        (ui.person === "unassigned"
          ? !t.primary
          : taskPeople(t).includes(ui.person))) &&
      (ui.status === "all" || t.status === ui.status),
  );
  const conflicts = assignmentConflicts(s);
  const issues = s.roleTasks.filter(
    (t) => t.phase === "day" && taskTimeIssue(t),
  );
  const unassigned = s.roleTasks.filter((t) => !t.primary).length;
  return `<article class="assignment-workspace ra-view-${ui.view}"><h1>역할분담</h1><p class="intro no-print">사람 추가 → 할 일 가져오기 → 담당자 배정 → 출력</p>${eventHeading(s)}<div class="ra-tools no-print"><div class="ra-stats"><span><strong>${s.staff.length}</strong> 담당자</span><span><strong>${s.roleTasks.length}</strong> 전체 업무</span><button data-assignment="unassigned"><strong>${unassigned}</strong> 미배정 업무</button><span><strong>${conflicts.length}</strong> 시간 충돌</span></div><div class="row">${btn("add-staff", "＋ 담당자 추가")}${btn("candidates", "준비표에서 업무 가져오기")}${btn("templates", "기본 업무 템플릿")}${btn("add-task", "＋ 직접 업무 추가")}</div><p class="small">이 브라우저에만 저장돼요. 다른 기기에서 보려면 행사 JSON을 저장·복원하세요. 담당자 최대 100명 · 업무 최대 300개</p><details class="help" id="ra-staff"><summary>담당자 관리 · ${s.staff.length}명</summary><div class="ra-staff-list">${s.staff.map((p) => `<div><button class="text-button" data-assignment="person" data-id="${esc(p.id)}">${esc(personLabel(p))}</button><span class="small">${s.roleTasks.filter((t) => taskPeople(t).includes(p.id)).length}건</span>${btn("edit-staff", "수정", `data-id="${esc(p.id)}"`)}${btn("delete-staff", "삭제", `data-id="${esc(p.id)}"`)}</div>`).join("") || "<p>이름만 입력해도 사용할 수 있어요. 참석자 명단과 별도로 관리합니다.</p>"}</div></details></div>${
    conflicts.length
      ? `<details class="ra-conflicts note" id="ra-conflicts-${ui.view}" ${ui.view === "mine" ? "" : "open"}><summary>업무 시간이 겹칩니다 · ${conflicts.length}건</summary><ul>${conflicts
          .slice(0, 50)
          .map(
            (c) =>
              `<li>${esc(personName(s, c.person))}: ${esc(c.a.title)} (${timeLabel(c.a)}) ↔ ${esc(c.b.title)} (${timeLabel(c.b)})</li>`,
          )
          .join(
            "",
          )}</ul>${conflicts.length > 50 ? "<p>앞의 50건을 표시합니다. 시간을 조정하면 남은 충돌이 이어서 표시됩니다.</p>" : ""}<p class="small">담당·보조 모두 확인합니다. 경고가 있어도 저장할 수 있어요.</p></details>`
      : ""
  }${issues.length ? `<details class="help no-print"><summary>충돌 확인에 필요한 시간 정보 · ${issues.length}건</summary><ul>${issues.map((t) => `<li>${esc(t.title)}: ${taskTimeIssue(t)}</li>`).join("")}</ul></details>` : ""}<nav class="ra-views no-print" aria-label="역할분담 보기">${Object.entries(
    {
      all: "전체 역할분담표",
      person: "사람별 업무표",
      timeline: "시간순 운영표",
      mine: "내 업무 보기",
    },
  )
    .map(([key, label]) =>
      btn(
        "view",
        label,
        `data-mode="${key}" aria-pressed="${ui.view === key}"`,
      ),
    )
    .join(
      "",
    )}</nav><div class="ra-filters no-print"><label>업무 구분<select class="input" data-assignment-filter="phase" ${["mine", "timeline"].includes(ui.view) ? "disabled" : ""}>${options({ all: "모든 업무", ...PHASES }, ui.phase)}</select></label><label>담당자<select class="input" data-assignment-filter="person"><option value="all" ${ui.person === "all" ? "selected" : ""}>모든 담당자</option><option value="unassigned" ${ui.person === "unassigned" ? "selected" : ""}>미배정 업무</option>${staffOptions(s, ui.person).replace('<option value="">미배정</option>', "")}</select></label><label>상태<select class="input" data-assignment-filter="status">${options({ all: "모든 상태", ...TASK_STATUS }, ui.status)}</select></label>${btn("clear-filters", "필터 초기화")}</div><p class="ra-filter-label small">${PHASES[ui.phase] || "모든 업무"} · ${ui.person === "all" ? "모든 담당자" : ui.person === "unassigned" ? "미배정 업무" : esc(personName(s, ui.person))} · ${TASK_STATUS[ui.status] || "모든 상태"}</p><div class="ra-report">${assignmentReport(s, tasks, ui, true)}</div><div class="row no-print">${btn("print", "현재 보기 인쇄 / PDF 저장")}<button class="button secondary" data-view="files">행사 JSON 저장·복원</button></div><p class="small no-print">인쇄에는 현재 필터가 적용됩니다. 사람별 업무표는 담당자마다 새 페이지로 시작하며 분량이 많으면 다음 장으로 이어집니다.</p>${legacy ? `<details class="help no-print" id="legacy-role-notes"><summary>기존 간단 역할 메모 · 그대로 보관됨</summary>${legacy}</details>` : ""}</article>`;
}
