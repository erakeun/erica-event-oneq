import {
  VENUES,
  OUTPUTS,
  LINKS,
  FOOD_OPTIONS,
  ROLE_TEMPLATES,
  GUEST_PREP,
  FOOD_PREP,
  ONSITE_ITEMS,
  AFTER_ITEMS,
  PREP_PRIORITY,
} from "./data.js?v=0.3.1";
export const operationDefaults = () => ({
  external: "unknown",
  venueDetail: "",
  guestNeeds: [],
  parkingNote: "",
  arrivalNote: "",
  contactNote: "",
  food: "unknown",
  foodPeople: "",
  foodTime: "",
  foodPlace: "",
  diet: false,
  photography: "auto",
  audio: "later",
  roles: {},
  onsiteChecks: {},
  afterChecks: {},
  borrowed: "unknown",
  followupAdmin: "unknown",
  afterNote: "",
  view: "prep",
});
const agendaIds = (s) => s.agenda.filter((a) => a.included).map((a) => a.id);
export function matches(s, when = "always") {
  const ids = agendaIds(s);
  const conditions = {
    always: true,
    external: s.external === "yes",
    food: ["snacks", "meal", "both"].includes(s.food),
    diet: ["snacks", "meal", "both"].includes(s.food) && s.diet,
    agenda: ids.length > 0,
    vip: s.vip === "yes",
    guests: s.external === "yes" || s.vip === "yes",
    seating: s.seating === "needed",
    nameplates: s.nameplates === "needed",
    seats: s.seating === "needed" || s.nameplates === "needed",
    screen: s.outputs.some((id) => id !== "notice"),
    audio: s.audio === "needed",
    photo:
      s.photography === "needed" ||
      (s.photography === "auto" && ids.some((id) => /photo|exchange/.test(id))),
    materials: ["mou", "award", "donation"].includes(s.event) && ids.length > 0,
    "mou-sign": s.event === "mou" && ids.includes("sign"),
    "mou-exchange":
      s.event === "mou" && ids.some((id) => ["sign", "exchange"].includes(id)),
    award: s.event === "award" && ids.includes("present"),
    donation: s.event === "donation" && ids.includes("handover"),
    meeting: s.event === "meeting" && ids.length > 0,
    "other-materials": s.event === "other" && ids.includes("main"),
    publicity: s.publicity === "needed",
    borrowed: s.borrowed === "yes",
    admin: s.followupAdmin === "yes",
  };
  if (when.startsWith("guest-"))
    return conditions.external && s.guestNeeds.includes(when.slice(6));
  return Boolean(conditions[when]);
}
const signature = (s, fields = []) => JSON.stringify(fields.map((f) => s[f]));
const materialize = (s, items) =>
  items
    .filter((i) => matches(s, i.when))
    .map((i) => ({ ...i, signature: signature(s, i.depends) }));
export function operationPrep(s) {
  const items = materialize(s, GUEST_PREP).map((i) => ({
    ...i,
    group: "외부 참석자 안내",
  }));
  if (s.external === "unknown")
    items.push({
      id: "guest-decision",
      group: "외부 참석자 안내",
      title: "외부 참석 여부 정하기",
      detail: "정해지면 행사 정보에서 변경하세요.",
      signature: "unknown",
    });
  if (matches(s, "food"))
    items.push(
      ...materialize(s, FOOD_PREP).map((i) => ({
        ...i,
        group: "다과·식사",
        detail: [foodDetails(s), i.detail].filter(Boolean).join(" · "),
      })),
    );
  if (s.food === "unknown")
    items.push({
      id: "food-decision",
      group: "다과·식사",
      title: "다과·식사 필요 여부 정하기",
      detail: "필요 없으면 행사 정보에서 선택하세요.",
      signature: "unknown",
    });
  if (matches(s, "photo"))
    items.push({
      id: "photo-plan",
      group: "홍보·촬영 협조",
      title: "촬영 담당·방법 준비",
      detail: "지원 요청과 별개로 실제 촬영 담당과 방법을 확인하세요.",
      signature: signature(s, ["photography", "event", "agenda", "date"]),
    });
  if (s.audio === "later")
    items.push({
      id: "audio-decision",
      group: "장소·기본 준비",
      title: "마이크·음향 필요 여부 정하기",
      detail: "행사 정보의 현장 장비에서 선택하세요.",
      signature: "later",
    });
  return items;
}
export const foodDetails = (s) =>
  [
    FOOD_OPTIONS.find(([id]) => id === s.food)?.[1],
    s.foodPeople || s.people ? `${s.foodPeople || s.people}명` : "인원 미정",
    s.foodTime ? `수령: ${s.foodTime}` : "",
    s.foodPlace ? `배치: ${s.foodPlace}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
export const buildOnsite = (s) => [
  ...materialize(s, ONSITE_ITEMS).map((i) =>
    i.id === "food" ? { ...i, detail: foodDetails(s) } : i,
  ),
  ...OUTPUTS.filter((o) => s.outputs.includes(o.id)).map((o) => ({
    id: `output-${o.id}`,
    title:
      o.id === "notice"
        ? "안내문이 실제 입구·이동 위치에 부착됐나요?"
        : `${LINKS[o.id].name.replace(" 제작기", "")}를 실제 화면에 정상 송출했나요?`,
    detail:
      o.id === "notice"
        ? "방문객의 이동 방향에서 읽히는지 확인하세요."
        : "파일 열기, 화면 비율·글자와 케이블 연결을 확인하세요.",
    signature: signature(s, [
      "venue",
      "otherVenue",
      "venueDetail",
      "date",
      "eventName",
    ]),
  })),
];
export const buildAfter = (s) => materialize(s, AFTER_ITEMS);
export const recommendedRoles = (s) =>
  ROLE_TEMPLATES.filter((r) => matches(s, r.when));
export const assignedRoles = (s) =>
  ROLE_TEMPLATES.filter((r) => s.roles[r.id]?.trim()).map((r) => ({
    ...r,
    name: s.roles[r.id].trim(),
  }));
export function reconcileOperations(s) {
  for (const [key, items] of [
    ["onsiteChecks", buildOnsite(s)],
    ["afterChecks", buildAfter(s)],
  ]) {
    s[key] = Object.fromEntries(
      items.map((i) => [
        i.id,
        {
          status:
            s[key]?.[i.id]?.signature === i.signature &&
            s[key][i.id].status === "done"
              ? "done"
              : "todo",
          signature: i.signature,
        },
      ]),
    );
  }
  return s;
}
export function unresolved(s) {
  return [
    [
      s.venue === "unknown" ||
        (["other", "department"].includes(s.venue) && !s.otherVenue),
      "정확한 장소",
      0,
    ],
    [s.venueStatus !== "secured", "장소 확보", 0],
    [!s.eventName, "행사명", 1],
    [!s.date, "행사 일시", 1],
    [!s.people, "예상 인원", 1],
    [s.external === "unknown", "외부 참석 여부", 1],
    [s.food === "unknown", "다과·식사", 1],
    [s.vip === "unknown", "주요 참석 여부", 1],
    [s.audio === "later", "마이크·음향", 1],
    [s.seating === "later", "좌석 배치", 4],
    [s.nameplates === "later", "명패", 4],
    [s.publicity === "later", "홍보", 2],
    [s.outputDecision === "later", "화면·안내물", 5],
  ]
    .filter(([yes]) => yes)
    .map(([, label, step]) => ({ label, step }));
}
export function locationText(s) {
  const base = ["other", "department"].includes(s.venue)
    ? s.otherVenue
    : s.venue === "unknown"
      ? ""
      : VENUES.find((v) => v.id === s.venue)?.name;
  return [base, s.venueDetail].filter(Boolean).join(" · ");
}
export function invitationText(s) {
  if (s.external !== "yes") return "";
  return [
    s.eventName ? `[${s.eventName} 안내]` : "[행사 안내]",
    s.date ? `일시: ${s.date.replace("T", " ")}` : "",
    locationText(s) ? `장소: ${locationText(s)}` : "",
    s.guestNeeds.includes("parking") && s.parkingNote
      ? `주차 안내: ${s.parkingNote}`
      : "",
    s.guestNeeds.includes("arrival") && s.arrivalNote
      ? `도착 안내: ${s.arrivalNote}`
      : "",
    s.guestNeeds.includes("contact") && s.contactNote
      ? `문의: ${s.contactNote}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
export function fieldSummary(s) {
  return [
    s.eventName || "행사 현장 요약",
    s.date?.replace("T", " "),
    locationText(s),
    ...assignedRoles(s).map((r) => `${r.label}: ${r.name}`),
    "남은 현장점검",
    ...buildOnsite(s)
      .filter((i) => s.onsiteChecks[i.id]?.status !== "done")
      .map((i) => `□ ${i.title}`),
  ]
    .filter(Boolean)
    .join("\n");
}

// 준비 상태만 참고합니다. 링크 열기와 현장 확인은 완료로 계산하지 않습니다.
export function nextPreparation(s, items) {
  return items
    .filter((item) => s.checks[item.id]?.status === "todo")
    .map((item, index) => ({
      item,
      index,
      rank: PREP_PRIORITY.indexOf(item.id),
    }))
    .sort(
      (a, b) =>
        (a.rank < 0 ? PREP_PRIORITY.length : a.rank) -
          (b.rank < 0 ? PREP_PRIORITY.length : b.rank) || a.index - b.index,
    )
    .slice(0, 3)
    .map(({ item }) => item);
}
