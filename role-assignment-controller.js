import { esc } from "./operations-view.js?v=0.6.0";
import { roleUI, staffOptions } from "./role-assignment-view.js?v=0.6.0";
import {
  blankTask,
  PHASES,
  TASK_STATUS,
  TASK_TEMPLATES,
  STAFF_LIMIT,
  TASK_LIMIT,
  assignmentCandidates,
  hasTask,
  addAssignmentTasks,
  deleteStaff,
} from "./role-assignment.js?v=0.6.0";
const newId = (kind) => kind + "-" + crypto.randomUUID();
export function assignmentController({
  getState,
  commit,
  render,
  confirm,
  notify,
}) {
  function dialog(title, body, save, label = "저장") {
    const d = document.createElement("dialog");
    d.className = "assignment-dialog";
    d.setAttribute("aria-labelledby", "ra-dialog-title");
    d.innerHTML = `<form><h2 id="ra-dialog-title">${title}</h2>${body}<p class="error" role="alert"></p><div class="row"><button class="button" type="submit">${label}</button><button class="button secondary" type="button" data-ra-cancel>취소</button></div></form>`;
    document.body.append(d);
    const opener = document.activeElement;
    d.querySelector("[data-ra-cancel]").onclick = () => d.close();
    d.addEventListener(
      "close",
      () => {
        d.remove();
        if (opener?.isConnected) opener.focus();
        else document.querySelector('[data-assignment="add-task"]')?.focus();
      },
      { once: true },
    );
    d.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      try {
        if (save(new FormData(e.target)) !== false) d.close();
        else
          d.querySelector(".error").textContent =
            "저장하지 못했습니다. 현재 입력을 유지했어요. 아래 화면의 저장 안내를 확인하세요.";
      } catch (error) {
        d.querySelector(".error").textContent = error.message;
      }
    };
    d.showModal();
  }
  const input = (
    key,
    label,
    value = "",
    type = "text",
    max = 160,
    required = false,
  ) =>
    `<label class="field">${label}<input class="input" name="${key}" type="${type}" value="${esc(value)}" maxlength="${max}" ${required ? "required" : ""}></label>`;
  function editStaff(id) {
    const s = getState(),
      p = s.staff.find((p) => p.id === id) || {
        id: newId("staff"),
        name: "",
        org: "",
        contact: "",
      };
    if (!id && s.staff.length >= STAFF_LIMIT)
      throw Error("담당자는 100명까지 추가할 수 있어요.");
    dialog(
      id ? "담당자 수정" : "담당자 추가",
      `<p>이 행사 안에서만 관리합니다. 이름만 입력해도 돼요.</p>${input("name", "이름", p.name, "text", 80, true)}${input("org", "소속 / 역할 · 선택", p.org, "text", 120)}${input("contact", "연락처 · 선택", p.contact, "text", 120)}`,
      (form) => {
        const row = { ...p, ...Object.fromEntries(form) };
        row.name = row.name.trim();
        if (!row.name) throw Error("이름을 입력하세요.");
        const latest = getState();
        return commit({
          ...latest,
          staff: id
            ? latest.staff.map((r) => (r.id === id ? row : r))
            : [...latest.staff, row],
        });
      },
    );
  }
  function editTask(id) {
    const s = getState(),
      t = s.roleTasks.find((t) => t.id === id) || {
        ...blankTask(newId("task")),
        phase: roleUI.phase === "day" ? "day" : "prep",
      };
    if (!id && s.roleTasks.length >= TASK_LIMIT)
      throw Error("업무는 300개까지 추가할 수 있어요.");
    const select = (key, label, items) =>
      `<label class="field">${label}<select class="input" name="${key}">${Object.entries(
        items,
      )
        .map(
          ([k, v]) =>
            `<option value="${k}" ${t[key] === k ? "selected" : ""}>${v}</option>`,
        )
        .join("")}</select></label>`;
    dialog(
      id ? "업무 수정" : "업무 추가",
      `${input("title", "업무명", t.title, "text", 160, true)}<div class="form-grid">${select("phase", "업무 구분", PHASES)}${select("status", "상태", TASK_STATUS)}<label class="field">담당자<select class="input" name="primary">${staffOptions(s, t.primary)}</select></label><label class="field">보조 담당자<select class="input" name="assistant">${staffOptions(s, t.assistant, "보조 없음")}</select></label></div><p class="small">행사 전은 완료기한, 당일은 시작·종료 시간을 사용해요. 같은 날의 시간으로 입력하세요.</p><div class="form-grid">${input("due", "완료기한 · 행사 전", t.due, "date")}${input("start", "시작 시간 · 행사 당일", t.start, "time")}${input("end", "종료 시간 · 행사 당일", t.end, "time")}${input("location", "장소", t.location)}</div><label class="field">업무 설명<textarea class="input" name="description" rows="3" maxlength="1000">${esc(t.description)}</textarea></label><label class="field">비고<textarea class="input" name="note" rows="2" maxlength="1000">${esc(t.note)}</textarea></label>`,
      (form) => {
        const row = { ...t, ...Object.fromEntries(form) };
        row.title = row.title.trim();
        if (!row.title) throw Error("업무명을 입력하세요.");
        if (row.primary && row.primary === row.assistant)
          throw Error("담당자와 보조 담당자는 서로 다르게 선택하세요.");
        if (row.primary && row.status === "unassigned") row.status = "planned";
        const latest = getState();
        return commit({
          ...latest,
          roleTasks: id
            ? latest.roleTasks.map((r) => (r.id === id ? row : r))
            : [...latest.roleTasks, row],
        });
      },
    );
  }
  function picker(all) {
    const s = getState(),
      list = all ? TASK_TEMPLATES : assignmentCandidates(s);
    dialog(
      all ? "기본 업무 템플릿" : "준비표에서 업무 가져오기",
      `<p>${all ? "필요한 업무만 선택하세요. 추가 후 내용과 배정을 자유롭게 수정할 수 있어요." : "현재 준비 선택에 맞춘 후보예요. 필요한 업무만 선택하세요. 준비표 완료 상태와 업무 진행 상태는 별도로 관리합니다."}</p>${Object.entries(
        PHASES,
      )
        .map(
          ([phase, label]) =>
            `<fieldset><legend>${label}</legend>${
              list
                .filter((t) => t.phase === phase)
                .map((t) => {
                  const duplicate = hasTask(s.roleTasks, t);
                  return `<label class="ra-candidate"><input type="checkbox" name="candidate" value="${t.source}" ${duplicate ? "disabled" : ""}><span><strong>${esc(t.title)}</strong>${duplicate ? ' <span class="tag">이미 추가됨</span>' : ""}<small>${esc(t.description)}</small></span></label>`;
                })
                .join("") || "<p>해당 후보가 없습니다.</p>"
            }</fieldset>`,
        )
        .join("")}`,
      (form) => {
        const chosen = form.getAll("candidate");
        if (!chosen.length) throw Error("추가할 업무를 선택하세요.");
        return commit(
          addAssignmentTasks(
            getState(),
            list.filter((t) => chosen.includes(t.source)),
            () => newId("task"),
          ),
        );
      },
      "선택한 업무 추가",
    );
  }
  function click(button) {
    const action = button.dataset.assignment;
    if (!action) return false;
    try {
      const s = getState(),
        id = button.dataset.id;
      if (action === "add-staff" || action === "edit-staff") editStaff(id);
      else if (action === "add-task" || action === "edit-task") editTask(id);
      else if (action === "templates" || action === "candidates")
        picker(action === "templates");
      else if (action === "delete-staff")
        confirm(
          "담당자를 삭제할까요?",
          "해당 사람의 배정만 해제됩니다. 업무와 기존 역할 메모는 남습니다.",
          () => commit(deleteStaff(getState(), id)),
        );
      else if (action === "delete-task")
        confirm(
          "업무를 삭제할까요?",
          "선택한 업무와 배정 내용을 삭제합니다. 준비표와 식순은 그대로 유지됩니다.",
          () =>
            commit({
              ...getState(),
              roleTasks: getState().roleTasks.filter((t) => t.id !== id),
            }),
        );
      else if (action === "view") {
        roleUI.view = button.dataset.mode;
        roleUI.phase = ["mine", "timeline"].includes(roleUI.view)
          ? "day"
          : "all";
        roleUI.status = "all";
        render();
      } else if (action === "person") {
        Object.assign(roleUI, {
          person: id,
          view: "person",
          phase: "all",
          status: "all",
        });
        render();
      } else if (action === "unassigned") {
        Object.assign(roleUI, {
          person: "unassigned",
          view: "all",
          phase: "all",
          status: "all",
        });
        render();
      } else if (action === "clear-filters") {
        Object.assign(roleUI, {
          person: "all",
          status: "all",
          phase: ["mine", "timeline"].includes(roleUI.view) ? "day" : "all",
        });
        render();
      } else if (action === "print") window.print();
    } catch (error) {
      notify(error.message);
    }
    return true;
  }
  function change(el) {
    if (el.dataset.assignmentFilter) {
      roleUI[el.dataset.assignmentFilter] = el.value;
      render(`[data-assignment-filter="${el.dataset.assignmentFilter}"]`);
      return true;
    }
    const field = el.dataset.assignmentField;
    if (!field) return false;
    const s = getState(),
      t = s.roleTasks.find((t) => t.id === el.dataset.id);
    if (!t || !["primary", "assistant", "status"].includes(field)) return true;
    const row = { ...t, [field]: el.value };
    if (row.primary && row.primary === row.assistant) {
      notify("담당자와 보조 담당자는 서로 다르게 선택하세요.");
      return true;
    }
    if (field === "primary")
      row.status = row.primary
        ? row.status === "unassigned"
          ? "planned"
          : row.status
        : "unassigned";
    commit({
      ...s,
      roleTasks: s.roleTasks.map((r) => (r.id === row.id ? row : r)),
    });
    document
      .querySelector(`[data-assignment-field="${field}"][data-id="${row.id}"]`)
      ?.focus();
    return true;
  }
  return { click, change };
}
