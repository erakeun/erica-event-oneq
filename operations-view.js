import { selectedAgenda } from "./agenda.js?v=0.5.0";
import {
  FOOD_OPTIONS,
  GUEST_NEEDS,
  ROLE_TEMPLATES,
  EVENTS,
} from "./data.js?v=0.5.0";
import {
  matches,
  recommendedRoles,
  assignedRoles,
  buildOnsite,
  buildAfter,
  unresolved,
  invitationText,
  locationText,
  nextPreparation,
} from "./operations.js?v=0.5.0";
export const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const choices = (s, name, values) =>
  `<div class="row">${values.map(([value, label]) => `<label class="choice compact"><input type="radio" name="${name}" value="${value}" ${s[name] === value ? "checked" : ""}>${label}</label>`).join("")}</div>`;
const input = (s, name, label, placeholder = "", max = 160) =>
  `<div class="field"><label for="${name}">${label}</label><input class="input" id="${name}" name="${name}" maxlength="${max}" value="${esc(s[name])}" placeholder="${placeholder}"></div>`;
export function logisticsView(s) {
  return `<section class="gap"><h2>참석자와 현장 준비</h2><fieldset><legend>외부 참석자가 있나요?</legend>${choices(
    s,
    "external",
    [
      ["yes", "있음"],
      ["no", "없음"],
      ["unknown", "미정"],
    ],
  )}</fieldset>${
    s.external === "yes"
      ? `<div class="panel"><fieldset><legend>외부 참석자 주차등록은 하셨나요?</legend>${choices(
          s,
          "parkingStatus",
          [
            ["done", "완료"],
            ["pending", "아직 안 함"],
            ["na", "해당 없음"],
            ["unknown", "확인 필요"],
          ],
        )}<p class="small muted">상태만 기록합니다. 차량번호 등 개인 차량정보는 입력하지 마세요.</p></fieldset><h3>방문객에게 안내할 내용</h3><p class="small">행사 일시와 정확한 장소를 확인하세요. 필요한 안내만 선택해 주세요.</p>${input(s, "venueDetail", "건물·층·회의실 등 상세 위치", "확인한 상세 위치만 입력", 120)}${GUEST_NEEDS.map((n) => `<label class="tool-check"><input type="checkbox" data-guest="${n.id}" ${s.guestNeeds.includes(n.id) ? "checked" : ""}>${n.label} 필요</label>${s.guestNeeds.includes(n.id) ? input(s, n.field, n.label + " 내용 · 선택 입력", n.placeholder, 240) : ""}`).join("")}<p class="small muted">주차 가능 여부·출입 방법은 직접 확인한 내용만 적으세요. 참석자 명단은 별도 명단 화면에서 관리해요.</p><label for="invitation">행사 안내문 미리보기</label><textarea class="input message-preview" id="invitation" readonly rows="6">${esc(invitationText(s))}</textarea><p class="small muted" id="invitation-missing">${invitationMissing(s)}</p><button class="button secondary" data-action="copy-invitation">안내문 복사</button><p class="copy-status small" role="status"></p></div>`
      : ""
  }<p class="small">현재 명단 ${s.attendees?.length || 0}명 · 주차 대상과 다과 제공 인원은 별도로 확인하세요.</p><fieldset><legend>다과·식사가 필요한가요?</legend>${choices(s, "food", FOOD_OPTIONS)}</fieldset>${matches(s, "food") ? `<div class="panel"><div class="form-grid">${input(s, "foodPeople", "제공 예상 인원 · 비우면 행사 인원 사용", "예: 20", 9)}${input(s, "foodTime", "수령·배달 시간 · 선택 입력", "예: 행사 당일 13:30", 80)}${input(s, "foodPlace", "배치 장소 · 선택 입력", "예: 회의실 입구 테이블", 120)}</div><p class="error" id="foodPeople-error" aria-live="polite"></p><label class="tool-check"><input type="checkbox" name="diet" ${s.diet ? "checked" : ""}>식이 제한 별도 확인이 필요해요</label><p class="small muted">개인별 알레르기·건강정보는 입력하지 마세요. 주문·예약과 정리 항목은 준비표에 표시해요.</p></div>` : ""}<details class="help"><summary>현장 장비 · 마이크/음향 ${s.audio === "needed" ? "사용" : s.audio === "none" ? "없음" : "미정"}</summary><fieldset><legend>마이크·음향을 사용하나요?</legend>${choices(
    s,
    "audio",
    [
      ["needed", "사용"],
      ["none", "사용 안 함"],
      ["later", "미정"],
    ],
  )}</fieldset></details></section>`;
}
export function invitationMissing(s) {
  const missing = [
    !s.eventName && "행사명",
    !s.date && "일시",
    !locationText(s) && "장소",
    ...GUEST_NEEDS.filter(
      (n) => s.guestNeeds.includes(n.id) && !s[n.field],
    ).map((n) => n.label),
  ].filter(Boolean);
  return missing.length
    ? `아직 입력하지 않은 ${missing.join("·")}는 안내문에 포함되지 않습니다.`
    : "입력한 내용만 복사해요. 직접 확인 후 전달하세요.";
}
export const photoChoices = (s) =>
  `<fieldset><legend>촬영을 준비하나요?</legend>${choices(s, "photography", [
    ["auto", "식순에 맞춰"],
    ["needed", "촬영 필요"],
    ["none", "촬영 없음"],
  ])}<p class="small muted">현재 ${matches(s, "photo") ? "촬영 담당·현장 확인 항목을 포함해요." : "촬영 준비 항목을 제외해요."} 현장 촬영 담당과 방법을 준비하기 위한 선택이에요.</p></fieldset>`;
const roleInput = (s, r) =>
  `<div class="field"><label for="role-${r.id}">${r.label}</label><input class="input" id="role-${r.id}" data-role="${r.id}" maxlength="60" value="${esc(s.roles[r.id] || "")}" placeholder="이름 또는 담당팀 · 생략 가능"></div>`;
export function roleEditor(s) {
  const recommended = recommendedRoles(s),
    other = ROLE_TEMPLATES.filter((r) => !recommended.includes(r));
  return `<details class="help role-editor"><summary>행사 전체 역할분담 · 선택 입력</summary><p class="small">이름 대신 팀·역할명을 써도 돼요. 이 브라우저에만 저장됨. 비워 두면 역할표에서 제외하며, 입력 없이 다음으로 넘어가도 돼요.</p><div class="form-grid">${recommended.map((r) => roleInput(s, r)).join("")}</div>${other.length ? `<details class="help"><summary>그 밖의 역할 추가</summary><div class="form-grid">${other.map((r) => roleInput(s, r)).join("")}</div></details>` : ""}<button class="button secondary" data-view="roles">입력한 현장 역할표 보기</button></details>`;
}
export function operationTabs(s) {
  return `<nav class="operation-tabs no-print" aria-label="행사 운영 화면">${[
    ["prep", "준비표"],
    ["attendees", "참석자"],
    ["cues", "큐시트"],
    ["packet", "운영본"],
    ["day", "당일 모드"],
    ["files", "저장·복원"],
    ["onsite", "현장점검"],
    ["roles", "역할표"],
    ["after", "사후정리"],
  ]
    .map(
      ([key, label]) =>
        `<button data-view="${key}" ${s.view === key ? 'aria-current="page"' : ""}>${label}</button>`,
    )
    .join("")}</nav>`;
}
export function unresolvedView(s) {
  const items = unresolved(s);
  return items.length
    ? `<details class="help unresolved no-print"><summary>아직 정할 내용 ${items.length}개</summary><p class="small">미정이어도 계속 준비할 수 있어요. 항목을 누르면 해당 단계로 이동해요.</p><div class="row">${items.map((i) => `<button class="button subtle" data-step="${i.step}">${i.label}</button>`).join("")}</div></details>`
    : "";
}
export const eventHeading = (s) =>
  `<div class="field-event"><strong>${esc(s.eventName) || "행사명 미정"}</strong><span>${esc(s.date.replace("T", " · ")) || "일시 미정"}<br>${esc(locationText(s)) || "정확한 장소 미정"}</span></div>`;
export function onsiteView(s, onlyRemaining) {
  const items = buildOnsite(s),
    done = items.filter((i) => s.onsiteChecks[i.id].status === "done").length;
  return `<h1>행사 시작 전 최종점검</h1><p class="intro">준비한 것이 현장에 있고, 실제로 작동하는지 확인하세요.</p>${eventHeading(s)}${unresolvedView(s)}${fieldAgendaView(s)}<div class="field-progress"><p role="status">완료 <strong>${done}</strong> / ${items.length}개 · 남음 <strong>${items.length - done}</strong>개</p><progress max="${items.length}" value="${done}" aria-label="현장점검 완료"></progress><label class="tool-check no-print"><input type="checkbox" id="remaining-only" ${onlyRemaining ? "checked" : ""}>미완료만 보기</label></div><div class="field-checks">${items.map((i) => `<label class="field-check ${s.onsiteChecks[i.id].status === "done" ? "checked" : ""} ${onlyRemaining && s.onsiteChecks[i.id].status === "done" ? "filtered" : ""}"><input type="checkbox" data-onsite="${i.id}" ${s.onsiteChecks[i.id].status === "done" ? "checked" : ""}><span><strong>${i.title}</strong>${i.detail ? `<small>${esc(i.detail)}</small>` : ""}<span class="print-status">${s.onsiteChecks[i.id].status === "done" ? "확인 완료" : "미확인"}</span></span></label>`).join("")}</div>${done === items.length ? '<p class="note" role="status">선택한 항목을 모두 확인했어요. 변경된 사항이 없는지 행사 시작 전에 한 번 더 살펴보세요.</p>' : ""}<div class="row gap no-print"><button class="button" data-action="print">현장점검 인쇄</button><button class="button secondary" data-action="copy-field">현장 요약 복사</button></div><p class="copy-status small" role="status"></p><p class="footnote">일반적인 확인 예시입니다. 학교 공식 의전규정이 아닙니다.</p>`;
}
export function roleView(s) {
  const roles = assignedRoles(s);
  return `<h1>현장 역할표</h1><p class="intro">직접 입력한 역할만 모았어요.</p>${eventHeading(s)}<dl class="role-sheet">${roles.map((r) => `<div><dt>${r.label}</dt><dd>${esc(r.name)}</dd></div>`).join("")}</dl>${`<div class="note roles-empty" ${roles.length ? "hidden" : ""}>아직 입력한 역할이 없어요. 역할 입력은 선택사항입니다.</div>`}<div class="no-print">${roleEditor(s)}</div><div class="row gap no-print"><button class="button" data-action="print">역할표 인쇄</button><button class="button secondary" data-action="copy-field">현장 요약 복사</button></div><p class="copy-status small" role="status"></p><p class="footnote">이 브라우저에만 저장됨 · 다른 기기와 자동 공유되지 않습니다.</p>`;
}
export function afterView(s) {
  const items = buildAfter(s),
    done = items.filter((i) => s.afterChecks[i.id].status === "done").length;
  return `<h1>행사 종료 후 정리</h1><p class="intro">자료를 챙기고, 다음 행사에 남길 내용을 적어 두세요.</p>${eventHeading(s)}<div class="no-print"><fieldset><legend>빌린 장비·물품이 있나요?</legend>${choices(
    s,
    "borrowed",
    [
      ["yes", "있음"],
      ["no", "없음"],
      ["unknown", "확인 필요"],
    ],
  )}</fieldset><fieldset><legend>비용·증빙 등 후속 행정 처리가 필요한가요?</legend>${choices(
    s,
    "followupAdmin",
    [
      ["yes", "필요"],
      ["no", "없음"],
      ["unknown", "확인 필요"],
    ],
  )}</fieldset></div>${s.borrowed === "unknown" || s.followupAdmin === "unknown" ? `<p class="note">${s.borrowed === "unknown" ? "빌린 물품 여부" : ""}${s.borrowed === "unknown" && s.followupAdmin === "unknown" ? " · " : ""}${s.followupAdmin === "unknown" ? "후속 행정 필요 여부" : ""}를 확인해 주세요.</p>` : ""}<p class="check-summary">완료 ${done}개 · 남음 ${items.length - done}개</p>${items.map((i) => `<label class="field-check"><input type="checkbox" data-after="${i.id}" ${s.afterChecks[i.id].status === "done" ? "checked" : ""}><span>${i.title}<span class="print-status">${s.afterChecks[i.id].status === "done" ? "완료" : "미완료"}</span></span></label>`).join("")}<div class="field"><label for="afterNote">다음 행사 참고사항 · 선택 입력</label><textarea class="input" id="afterNote" name="afterNote" rows="4" maxlength="600" placeholder="다음에는 무엇을 유지하거나 바꾸면 좋을까요? 개인정보는 적지 마세요.">${esc(s.afterNote)}</textarea><p class="small muted">최대 600자 · 이 브라우저에만 저장됨</p></div><p class="print-note">${esc(s.afterNote)}</p><button class="button no-print" data-action="print">사후정리 인쇄</button>`;
}
export const timelineView = () =>
  `<div class="timeline" aria-label="준비 시기 안내"><span>미리 준비<small>장소·지원 협의</small></span><span>행사 전까지<small>자료·역할·안내</small></span><button data-view="onsite">행사 직전 현장<small>실물·작동 확인 →</small></button><button data-view="after">행사 종료 후<small>자료·물품 정리 →</small></button></div>`;

export function nextPreparationView(s, items) {
  const next = nextPreparation(s, items);
  return `<section class="next-preparation no-print" aria-labelledby="next-preparation-title"><h2 id="next-preparation-title">먼저 확인할 일</h2><p class="small muted">일정·장소와 사전 협의가 필요한 일을 먼저 모았어요. 행사 상황에 맞춰 순서를 조정하세요.</p>${next.length ? `<ol>${next.map((item) => `<li><button data-item-focus="${item.id}">${esc(item.title)} <span aria-hidden="true">↓</span></button></li>`).join("")}</ol>` : "<p>준비표에 남은 할 일이 없어요. 행사 직전에는 실제 배치·작동을 따로 확인하세요.</p>"}</section>`;
}
export function fieldAgendaView(s) {
  const rows = selectedAgenda(s);
  if (!rows.length) return "";
  return `<details class="help field-agenda"><summary>선택한 식순 펼쳐보기 · ${rows.length}개</summary><p class="small muted">${s.checks.agenda?.status === "done" ? "준비표에서 확인한 식순이에요." : "준비표의 최종 식순 확인이 아직 남아 있어요."} 확정된 진행문은 따로 확인하세요.</p><ol>${rows.map((row) => `<li><strong>${esc(row.title)}</strong><p class="small">${esc(row.role) || "역할 미정"} · ${esc(row.check) || "준비 사항 확인"}</p></li>`).join("")}</ol><button class="text-button no-print" data-step="3">식순 수정하기 →</button></details>`;
}
