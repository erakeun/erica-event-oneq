import {
  esc,
  eventHeading,
  fieldAgendaView,
  onsiteView,
} from "./operations-view.js?v=0.5.0";
import {
  assignedRoles,
  locationText,
  buildOnsite,
  buildAfter,
  PARKING_LABELS,
  matches,
} from "./operations.js?v=0.5.0";
import { VENUES, EVENTS, LINKS, FOOD_OPTIONS } from "./data.js?v=0.5.0";
import { selectedAgenda, scenarioText } from "./agenda.js?v=0.5.0";
import {
  rosterGroups,
  cueStale,
  timeWarnings,
  ATTENDEE_LIMIT,
  CUE_LIMIT,
} from "./event-workspace.js?v=0.5.0";

const button = (action, label, cls = "secondary") =>
  `<button class="button ${cls}" data-work="${action}">${label}</button>`;
const input = (kind, r, key, label, max, area = false) =>
  `<div class="field"><label for="${kind}-${key}-${r.id}">${label}</label>${area ? `<textarea rows="2"` : `<input type="text"`} class="input" id="${kind}-${key}-${r.id}" data-record="${kind}" data-id="${r.id}" data-field="${key}" maxlength="${max}" ${key === "time" ? 'inputmode="numeric" placeholder="HH:MM · 미정 가능"' : ""}${area ? `>${esc(r[key])}</textarea>` : ` value="${esc(r[key])}">`}</div>`;
const rowButtons = (kind, r, i, length) =>
  `<div class="row-tools"><button class="icon-button" data-row-move="${r.id}" data-kind="${kind}" data-dir="-1" aria-label="${i + 1}번 ${kind === "attendees" ? "참석자" : "큐"} 위로" ${i === 0 ? "disabled" : ""}>↑</button><button class="icon-button" data-row-move="${r.id}" data-kind="${kind}" data-dir="1" aria-label="${i + 1}번 ${kind === "attendees" ? "참석자" : "큐"} 아래로" ${i === length - 1 ? "disabled" : ""}>↓</button><button class="text-button danger" data-row-delete="${r.id}" data-kind="${kind}" aria-label="${i + 1}번 ${kind === "attendees" ? "참석자" : "큐"} 삭제">삭제</button></div>`;
export function rosterSummary(s) {
  return `<div class="roster-summary"><strong>입력한 참석자 ${s.attendees.length}명</strong><span>${rosterGroups(
    s,
  )
    .map((g) => `${esc(g.name)} ${g.count}명`)
    .join(
      " · ",
    )}</span>${s.people ? `<span>예상 ${esc(s.people)}명${Number(s.people) !== s.attendees.length ? " · 명단 인원과 다릅니다. 미입력 참석자가 있는지 확인하세요." : ""}</span>` : ""}</div>`;
}
export function attendeeTable(s, arrival = false) {
  if (!s.attendees.length)
    return '<p class="muted">입력한 참석자가 없습니다. 명단 입력은 선택사항입니다.</p>';
  return `${rosterSummary(s)}<table class="work-table attendees-table"><caption>참석자 명단 · 입력 순서</caption><thead><tr>${["순서", "기관 / 구분", "소속", "직책", "성명", "비고", ...(arrival ? ["현장 확인"] : [])].map((t) => `<th scope="col">${t}</th>`).join("")}</tr></thead><tbody>${s.attendees.map((p, i) => `<tr>${[i + 1, p.group, p.org, p.title, p.name || "성명 미입력", p.note].map((v, j) => `<td data-label="${["순서", "기관 / 구분", "소속", "직책", "성명", "비고"][j]}">${esc(v) || "—"}</td>`).join("")}${arrival ? `<td data-label="현장 확인"><label class="arrival-check"><input type="checkbox" data-arrived="${p.id}" ${p.arrived ? "checked" : ""}>${esc(p.name) || `${i + 1}번 참석자`} 도착 확인</label></td>` : ""}</tr>`).join("")}</tbody></table>`;
}
export function attendeesView(s, pending = null) {
  return `<h1>참석자 명단</h1><p class="intro">한 번 입력한 명단을 소개 순서·운영본·당일 확인에 함께 사용해요.</p><p class="note">입력은 선택사항입니다. 이 브라우저에만 저장됨 · 서버로 전송하지 않습니다. 차량번호·민감정보는 적지 마세요.</p>${rosterSummary(s)}<div class="row gap no-print">${button("add-person", "+ 참석자 추가")}${button("csv-import", "CSV 가져오기")}${button("csv-export", "참석자 CSV 내보내기")}</div><p class="small">Excel에서는 CSV UTF-8로 저장하세요. 최대 300명 · 1MB. 성명/이름 컬럼이 필요하며 빈 행은 제외합니다. 가져온 뒤 추가 또는 교체를 선택해요.</p>${pending ? `<section class="import-preview panel" aria-labelledby="csv-preview-title"><h2 id="csv-preview-title">가져오기 미리보기 · ${pending.attendees.length}명</h2>${pending.ignored.length ? `<p>제외할 컬럼: ${pending.ignored.map(esc).join(", ")}</p>` : ""}${attendeeTable({ ...s, attendees: pending.attendees, people: "" })}<div class="row">${button("csv-append", "현재 명단에 추가")}${button("csv-replace", "현재 명단 전체 교체")}${button("csv-cancel", "가져오기 취소", "subtle")}</div></section>` : ""}<p class="small muted">아래 순서가 소개 순서와 운영본에 반영됩니다. 기관 구분은 자동으로 의전 순위를 정하지 않습니다.</p><ol class="record-list">${s.attendees.map((r, i) => `<li class="record-card"><div class="record-heading"><span class="badge">${i + 1}</span><strong data-record-heading="${r.id}">${esc(r.name) || "성명 입력"}</strong><span class="group-badge" data-group-heading="${r.id}">${esc(r.group) || "구분 미입력"}</span>${rowButtons("attendees", r, i, s.attendees.length)}</div><details data-detail-key="person-${r.id}" ${!r.name ? "open" : ""}><summary>${i + 1}번 참석자 편집</summary><div class="form-grid">${input("attendees", r, "group", "기관 / 구분", 120)}${input("attendees", r, "org", "소속", 120)}${input("attendees", r, "title", "직책", 80)}${input("attendees", r, "name", "성명", 80)}${input("attendees", r, "note", "비고 · 민감정보 제외", 500, true)}</div></details></li>`).join("")}</ol>${!s.attendees.length ? '<p class="empty-state">직접 추가하거나 Excel 명단을 CSV로 가져오세요.</p>' : ""}<details class="help"><summary>명패·좌석 도구에 명단 전달하기</summary><p>입력한 명단을 자동 전송하지 않습니다. CSV를 내려받은 뒤 기존 도구의 파일 가져오기를 직접 사용하세요.</p><div class="row">${button("csv-nameplate", "명패용 CSV 내보내기")}${button("csv-export", "좌석용 CSV 내보내기")}</div><p class="small">명패용은 머리글 없이 이름·소속·직책 순서입니다. 좌석용은 기관·소속·직책·성명·비고를 사용합니다. 기관별 순위·고정석은 좌석 도구에서 직접 정하세요.</p><p>${toolLink("nameplate")}${s.venue === "prime" ? toolLink("seat") : s.venue === "seoul" ? toolLink("seoulSeat") : ""}</p></details>`;
}
export function cueTable(s) {
  if (!s.cues.length) return '<p class="muted">작성한 큐시트가 없습니다.</p>';
  return `<table class="work-table"><caption>진행 큐시트 · 작성한 순서</caption><thead><tr>${["예정시간", "식순 / 업무", "담당", "현장 행동 / 준비", "비고"].map((x) => `<th scope="col">${x}</th>`).join("")}</tr></thead><tbody>${s.cues.map((c) => `<tr>${[c.time || "미정", c.title || "업무 미입력", c.owner || "미정", c.action, c.note].map((x, i) => `<td data-label="${["예정시간", "식순 / 업무", "담당", "현장 행동 / 준비", "비고"][i]}">${esc(x) || "—"}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
export function cueNotice(s) {
  return `${cueStale(s) ? '<p class="note warning">식순·일시·장소가 바뀌어 큐시트 재확인이 필요합니다. 기존 입력은 보존했습니다. 서로 대조한 뒤 확인하거나 초안을 다시 만드세요.</p>' : ""}${timeWarnings(
    s.cues,
  )
    .map((w) => `<p class="note warning">${esc(w)}</p>`)
    .join("")}`;
}
export function cuesView(s) {
  return `<h1>진행 큐시트</h1><p class="intro">식순은 행사 순서, 시나리오는 사회자 멘트, 큐시트는 시간별 현장 행동표예요.</p><div id="cue-notices">${cueNotice(s)}</div><div class="row gap">${button("cue-from-agenda", "식순에서 큐시트 초안 다시 만들기")}${button("add-cue", "+ 운영행 추가")}${s.cues.length ? button("cue-reviewed", "대조 완료 · 큐시트 확인") : ""}</div><p class="small muted">시간·담당·행동은 직접 입력하세요. 시간은 HH:MM 또는 빈칸. 세팅·영접·마이크 점검·촬영 준비·환송 등도 추가할 수 있어요. 최대 ${CUE_LIMIT}행.</p><ol class="record-list">${s.cues.map((r, i) => `<li class="record-card"><div class="record-heading"><span class="badge">${i + 1}</span><strong data-record-heading="${r.id}">${esc(r.title) || "업무 입력"}</strong>${rowButtons("cues", r, i, s.cues.length)}</div><div class="form-grid">${input("cues", r, "time", "예정시간", 5)}${input("cues", r, "title", "식순 / 업무", 160)}${input("cues", r, "owner", "담당", 160)}${input("cues", r, "action", "현장 행동 / 준비", 1000, true)}${input("cues", r, "note", "비고", 500, true)}</div><p class="error" data-time-error="${r.id}" role="status"></p></li>`).join("")}</ol>${!s.cues.length ? '<p class="empty-state">식순을 초안으로 가져오거나 운영행부터 추가하세요.</p>' : ""}`;
}
const section = (title, body) =>
  body
    ? `<section class="packet-section"><h2>${title}</h2>${body}</section>`
    : "";
const status = (s, id) =>
  ({ done: "확인 완료", na: "해당 없음", todo: "재확인 / 준비 필요" })[
    s.checks[id]?.status
  ] || "확인 필요";
const toolLink = (id) =>
  `<a class="button secondary" href="${LINKS[id].url}" target="_blank" rel="noopener noreferrer">${LINKS[id].name} 열기 ↗</a>`;
export function packetView(s, items) {
  const venue = VENUES.find((v) => v.id === s.venue),
    roles = assignedRoles(s),
    agenda = selectedAgenda(s),
    onsite = buildOnsite(s),
    after = buildAfter(s);
  const contact = [
    venue?.rental?.contact ? `대관 문의: ${venue.rental.contact}` : "",
    venue?.setupContact
      ? `세팅 지원: ${venue.setupContact} · 세팅이 필요한 경우 문의`
      : "",
  ].filter(Boolean);
  return `<article class="operation-packet"><h1>행사 운영본</h1>${eventHeading(s)}<p>${esc(EVENTS.find((e) => e.id === s.event)?.name)}${s.people ? ` · 예상 ${esc(s.people)}명` : ""}${s.attendees.length ? ` · 명단 ${s.attendees.length}명` : ""}</p><div class="row gap no-print">${button("packet-reviewed", "운영본 확인 완료")}<button class="button" data-action="print">운영본 인쇄 / PDF 저장</button><button class="button secondary" data-view="day">행사 당일 모드</button></div><p class="small no-print">인쇄 창에서 A4와 PDF 저장을 선택하세요. 참석자 정보가 포함될 수 있으니 보관·공유에 주의하세요.</p><p class="packet-status">운영본: ${status(s, "operation-pack")}</p>${section("장소 및 연락처", contact.length ? contact.map((c) => `<p>${esc(c)}</p>`).join("") : "")}${section("참석자 명단 · 소개 순서", s.attendees.length ? attendeeTable(s) : "")}${section("역할분담", roles.length ? `<dl class="role-sheet">${roles.map((r) => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.name)}</dd></div>`).join("")}</dl>` : "")}${section("최종 식순", agenda.length ? `<ol>${agenda.map((r) => `<li><strong>${esc(r.title)}</strong>${r.role ? ` · ${esc(r.role)}` : ""}</li>`).join("")}</ol>` : "")}${section("진행 큐시트", s.cues.length ? cueNotice(s) + cueTable(s) : "")}${section(
    "주요 준비물",
    agenda.some((r) => r.check)
      ? `<ul>${agenda
          .filter((r) => r.check)
          .map(
            (r) =>
              `<li><strong>${esc(r.title)}</strong> · ${esc(r.check)}</li>`,
          )
          .join("")}</ul>`
      : "",
  )}${section(
    "외부 참석자 / 주차",
    s.external === "yes"
      ? `<p>주차등록: ${PARKING_LABELS[s.parkingStatus]} · 명단 ${s.attendees.length}명 (주차 대상 수는 별도 확인)</p>${[
          s.parkingNote,
          s.arrivalNote,
          s.contactNote,
        ]
          .filter(Boolean)
          .map((t) => `<p>${esc(t)}</p>`)
          .join("")}`
      : "",
  )}${section("다과·식사", matches(s, "food") ? `<p>${FOOD_OPTIONS.find(([id]) => id === s.food)[1]} · 제공 ${esc(s.foodPeople || s.people) || "미정"}${s.foodPeople || s.people ? "명" : ""} · 입력 명단 ${s.attendees.length}명</p><p>인원: ${status(s, "food-count")} · 주문/예약: ${status(s, "food-order")}</p>${s.foodTime ? `<p>수령: ${esc(s.foodTime)}</p>` : ""}${s.foodPlace ? `<p>배치: ${esc(s.foodPlace)}</p>` : ""}` : "")}${section("촬영·보도자료", [s.vip === "yes" ? `<p>촬영·취재 요청: ${status(s, "press-request")} · 지원 확정: ${status(s, "press-support")}</p>` : "", matches(s, "photo") ? `<p>현장 촬영: ${s.onsiteChecks.photo?.status === "done" ? "확인 완료" : "확인 필요"}</p>` : "", s.publicity === "needed" ? `<p>보도자료 제출: ${status(s, "pr-submit")}</p>` : ""].join(""))}${section("현장점검", `<p>${onsite.filter((i) => s.onsiteChecks[i.id]?.status === "done").length} / ${onsite.length}개 확인</p><ul>${onsite.map((i) => `<li>${s.onsiteChecks[i.id]?.status === "done" ? "☑" : "□"} ${esc(i.title)}</li>`).join("")}</ul>`)}${section("사후정리", after.length ? `<ul>${after.map((i) => `<li>${s.afterChecks[i.id]?.status === "done" ? "☑" : "□"} ${esc(i.title)}</li>`).join("")}</ul>${s.afterNote ? `<p>${esc(s.afterNote)}</p>` : ""}` : "")}</article>`;
}
export function filesView() {
  return `<h1>행사 저장·복원</h1><p class="intro">행사 전체를 로컬 파일로 보관하고, 지난 행사를 새 준비의 시작점으로 사용하세요.</p><section class="panel"><h2>JSON 저장 / 불러오기</h2><p>이 파일에는 참석자 이름 등 행사정보가 포함될 수 있습니다. 보관·공유에 주의하세요.</p><div class="row">${button("json-export", "현재 행사 JSON 내보내기")}${button("json-import", "JSON 저장본 불러오기")}</div><p class="small">서버로 업로드하지 않습니다. 원큐 V0.5 JSON · 최대 3MB. 파일을 검증한 뒤 현재 행사 교체 여부를 확인합니다. 현재 행사를 먼저 내보내 두면 안전하게 되돌릴 수 있어요.</p></section><section class="panel"><h2>지난 행사 복제</h2><p>현재 또는 불러온 행사를 새 행사로 복제합니다. 날짜·완료 상태·담당자 배정·도착 확인·큐시트 시간은 비우고 장소·식순·큐시트 구조·출력물 종류는 유지합니다.</p><div class="row">${button("duplicate-keep", "참석자 유지해서 복제")}${button("duplicate-clear", "참석자 비우고 복제")}</div><p class="small">기존 행사는 자동으로 별도 보관되지 않으니 JSON으로 먼저 저장하세요.</p></section>`;
}
export function dayView(s, panel, onlyRemaining) {
  const tabs = [
    ["home", "한눈에"],
    ["agenda", "식순·시나리오"],
    ["cues", "큐시트"],
    ["attendees", "참석자"],
    ["roles", "역할표"],
    ["onsite", "현장점검"],
  ];
  let content = "";
  if (panel === "agenda")
    content =
      fieldAgendaView(s) +
      `<details class="help"><summary>사회자 시나리오 펼치기</summary><pre class="day-script">${esc(scenarioText(s))}</pre></details>`;
  else if (panel === "cues") content = cueNotice(s) + cueTable(s);
  else if (panel === "attendees") content = attendeeTable(s, true);
  else if (panel === "roles")
    content = assignedRoles(s).length
      ? `<dl class="role-sheet">${assignedRoles(s)
          .map(
            (r) => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.name)}</dd></div>`,
          )
          .join("")}</dl>`
      : "<p>입력한 담당 역할이 없습니다.</p>";
  else if (panel === "onsite") content = onsiteView(s, onlyRemaining);
  else
    content = `<p class="note">${s.attendees.length}명 입력 · ${s.attendees.filter((p) => p.arrived).length}명 도착 확인 · 큐시트 ${s.cues.length}행</p>${cueNotice(s)}<p>현장점검 ${buildOnsite(s).filter((i) => s.onsiteChecks[i.id]?.status === "done").length} / ${buildOnsite(s).length}개 확인</p><div class="row">${s.seating === "needed" && s.venue === "prime" ? toolLink("seat") : s.seating === "needed" && s.venue === "seoul" ? toolLink("seoulSeat") : ""}${s.nameplates === "needed" ? toolLink("nameplate") : ""}</div><p class="small">도구를 열어도 명단이나 완료 상태는 자동 전달되지 않습니다.</p><button class="button secondary" data-view="packet">행사 운영본 보기</button>`;
  return `<h1>행사 당일 모드</h1>${eventHeading(s)}<button class="text-button no-print" data-view="prep">준비 화면으로 돌아가기</button><nav class="day-tabs no-print" aria-label="당일 빠른 이동">${tabs.map(([key, label]) => `<button data-day="${key}" ${panel === key ? 'aria-current="page"' : ""}>${label}</button>`).join("")}</nav><section class="day-content" aria-live="polite">${content}</section>`;
}
