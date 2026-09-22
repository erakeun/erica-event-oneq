// 확인한 운영 정보만 등록하세요. null은 미등록 상태입니다.
// V0.1의 저장 내용을 그대로 이어받기 위해 키를 유지합니다. 스키마는 version으로 구분합니다.
export const STORAGE_KEY = "erica-event-oneq:prototype:v0.1";
export const STEPS = [
  "장소",
  "행사 정보",
  "먼저 요청할 일",
  "식순·양식",
  "좌석·명패",
  "화면·안내물",
  "준비표",
];
export const CAMPUSES = [
  {
    id: "seoul",
    name: "서울캠퍼스",
    venues: ["seoul", "department", "other", "unknown"],
  },
  {
    id: "erica",
    name: "ERICA",
    venues: ["prime", "history", "department", "other"],
  },
];
export const VENUES = [
  {
    id: "prime",
    campus: "erica",
    name: "프라임 컨퍼런스홀",
    note: "대관 4415 / 4418 · 세팅 문의 4289",
    symbol: "01",
    seatTool: {
      link: "seat",
      label: "프라임 컨퍼런스홀 좌석배치 만들기",
      note: "프라임 컨퍼런스홀 전용 도면에서 좌석과 동선을 확인하세요.",
    },
    rental: {
      department: null,
      contact: "교내전화 4415 / 4418",
      url: null,
      conditions: null,
    },
    setupContact: "교내전화 4289",
  },
  {
    id: "seoul",
    campus: "seoul",
    name: "서울캠퍼스 신본관 2층 회의실1",
    note: "메인 49석 + 배석 4석 · 전용 좌석배치 도구",
    symbol: "02",
    seatTool: {
      link: "seoulSeat",
      label: "신본관 회의실1 좌석배치 만들기",
      note: "서울캠퍼스 신본관 회의실1 전용 · 메인 49석 + 배석 4석 = 총 53석",
    },
    rental: { department: null, contact: null, url: null, conditions: null },
  },
  {
    id: "history",
    campus: "erica",
    name: "히스토리라운지",
    note: "대관 문의 · 교내전화 4415 / 4418",
    symbol: "03",
    rental: {
      department: null,
      contact: "교내전화 4415 / 4418",
      url: null,
      conditions: null,
    },
  },
  {
    id: "department",
    name: "부서 자체 장소",
    note: "부서에서 사용하는 회의실·행사 공간",
    symbol: "04",
    rental: null,
  },
  {
    id: "other",
    name: "기타 장소",
    note: "사용하실 장소를 직접 적어 주세요",
    symbol: "05",
    rental: { department: null, contact: null, url: null, conditions: null },
  },
  {
    id: "unknown",
    name: "아직 미정",
    note: "장소가 정해지지 않아도 괜찮아요",
    symbol: "…",
    rental: null,
  },
];
export const LINKS = {
  mach: { name: "PROJECT MACH", url: "https://erakeun.github.io/ERICAAI/" },
  seat: {
    name: "프라임 좌석배치",
    url: "https://erakeun.github.io/erica-seat-planner/",
  },
  seoulSeat: {
    name: "신본관 회의실1 좌석배치",
    url: "https://erakeun.github.io/seoul-seat-planner/",
  },
  nameplate: {
    name: "명패 제작기",
    url: "https://erakeun.github.io/nameplate-maker/",
  },
  welcome: {
    name: "웰컴보드 제작기",
    url: "https://erakeun.github.io/welcome-board-maker/",
  },
  signage: {
    name: "디지털 사이니지 제작기",
    url: "https://erakeun.github.io/digital-signage-maker/",
  },
  notice: {
    name: "안내문 제작기",
    url: "https://erakeun.github.io/notice-maker/",
  },
  led: {
    name: "컨퍼런스홀 LED 제작기",
    url: "https://erakeun.github.io/conference-hall-led-maker/",
  },
  pr: {
    name: "보도자료 기초자료 제출",
    url: "https://erakeun.github.io/erica-pr-request/",
  },
  press: {
    name: "촬영·취재 협조 요청",
    url: "https://erakeun.github.io/erica-press/",
  },
};
const seq = (id, title, what, role, check, script) => ({
  id,
  title,
  what,
  role,
  check,
  script,
});
export const EVENTS = [
  {
    id: "mou",
    name: "협약식(MOU)",
    short: "협약식",
    description: "협약서 서명과 교환을 함께 준비해요",
    supplies: [
      "최종 협약서와 서명 위치",
      "서명용 펜·서류 받침",
      "협약서 교환 동선",
    ],
    agenda: [
      {
        id: "open",
        title: "개회사",
        what: "사회자 소개와 전체 순서를 안내합니다.",
        role: "[사회자]",
        check: "행사명·사회자·전체 순서·시작 신호 확인",
        script:
          "안녕하십니까. 오늘 [행사명]의 진행을 맡은 [사회자]입니다. 지금부터 행사를 시작하겠습니다. [전체 식순 안내]",
      },
      {
        id: "introduce",
        title: "참석자 소개",
        what: "대학 측과 상대기관 측 참석자를 소개합니다.",
        role: "[사회자]",
        check: "호칭·대학 측/상대기관 측 소개 순서 사전 협의",
        script:
          "먼저 대학 측 참석자를 소개하겠습니다. [대학 측 참석자 소개]. 이어서 [상대기관명] 측 참석자를 소개하겠습니다. [상대기관 측 참석자 소개]. 바쁘신 가운데 함께해 주신 여러분께 감사드립니다.",
      },
      {
        id: "welcome",
        title: "환영사",
        what: "대학 측 대표의 환영사를 듣습니다.",
        role: "[대학 대표]",
        check: "발언자·호칭·발언 시간·마이크 확인",
        script:
          "다음은 [대학 대표]의 환영사가 있겠습니다. 말씀 부탁드립니다. [환영사 후] 좋은 말씀 감사합니다.",
      },
      {
        id: "reply",
        title: "답사",
        what: "상대기관 대표의 답사를 듣습니다.",
        role: "[상대기관 대표]",
        check: "발언자·호칭·발언 순서 확인",
        script:
          "이어서 [상대기관명]의 [상대기관 대표]께서 답사를 해 주시겠습니다. [답사 후] 귀한 말씀 감사합니다.",
      },
      {
        id: "institution",
        title: "협약기관 소개",
        what: "상대기관의 성격·역할·주요 기능을 소개합니다.",
        role: "[사회자 또는 소개 담당]",
        check: "공개 가능한 기관 소개 내용·영상 또는 자료 사용 여부 확인",
        script:
          "다음은 [상대기관명]을 소개하는 시간입니다. [기관 소개: 성격·역할·주요 기능]. 소개 내용은 상대기관이 확인한 자료를 바탕으로 준비해 주세요.",
      },
      {
        id: "sign",
        title: "협약서 서명 및 교환",
        what: "양 기관 대표가 협약서에 서명하고 교환합니다.",
        role: "[대학 대표] · [상대기관 대표] · 서류 담당",
        check:
          "최종 협약서·서명 권한·서명 위치·부수·펜·서류 배치·교환 동선 확인",
        script:
          "이제 협약서 서명 및 교환을 진행하겠습니다. [대학 대표]와 [상대기관 대표]께서는 안내에 따라 서명 자리로 이동해 주시기 바랍니다. 이번 협약의 주요 협력내용은 [협력내용]입니다. 준비된 협약서에 서명해 주시기 바랍니다. 서명이 끝나면 협약서를 교환해 주시기 바랍니다.",
      },
      {
        id: "photo",
        title: "기념촬영",
        what: "대표 촬영 후 전체 참석자 촬영을 진행합니다.",
        role: "촬영 담당 · 진행 담당",
        check: "대표/전체 촬영 인원·[촬영 위치]·문서 방향·동선 확인",
        script:
          "기념촬영을 진행하겠습니다. 먼저 양 기관 대표께서는 [촬영 위치]에서 정면을 바라봐 주시기 바랍니다. 이어서 전체 참석자 여러분께서는 진행 담당의 안내에 따라 함께 자리해 주시기 바랍니다.",
      },
      {
        id: "close",
        title: "폐회사",
        what: "협약 의미와 참석 감사, 후속 이동을 안내합니다.",
        role: "[사회자]",
        check: "최종 안내·후속 일정·퇴장 동선 확인",
        script:
          "오늘 협약을 계기로 [협력의 의미]를 함께 이어가기를 기대합니다. 참석해 주신 모든 분께 감사드립니다. 양 기관의 지속적인 협력을 바라며 이상으로 [행사명]을 마치겠습니다. [종료 후 이동 안내].",
      },
    ],
  },
  {
    id: "donation",
    name: "기금전달식",
    short: "기금전달식",
    description: "전달 순서와 감사의 자리를 준비해요",
    supplies: [
      "전달용 물품 또는 보드 사용 여부",
      "전달·촬영 위치와 동선",
      "전달 물품 배치 담당",
    ],
    agenda: [
      {
        id: "open",
        title: "개회",
        what: "사회자 소개와 행사 시작을 안내합니다.",
        role: "[사회자]",
        check: "행사명·시작 신호·음향 확인",
        script:
          "안녕하십니까. [행사명]의 진행을 맡은 [사회자]입니다. 함께해 주신 여러분께 감사드리며 지금부터 행사를 시작하겠습니다.",
      },
      {
        id: "introduce",
        title: "내외빈 소개",
        what: "대학 측과 기부기관 측 참석자를 소개합니다.",
        role: "[사회자]",
        check: "참석자 명단은 별도 자료에서 확인·호칭·소개 순서 협의",
        script:
          "먼저 대학 측 참석자를 소개하겠습니다. [대학 측 소개]. 이어서 [기부기관]의 참석자를 소개하겠습니다. [기부기관 측 소개]. 참석해 주신 내외빈 여러분께 감사드립니다.",
      },
      {
        id: "welcome",
        title: "환영사",
        what: "대학 측 대표의 환영사를 듣습니다.",
        role: "[대학 대표]",
        check: "발언자·발언 시간·마이크 확인",
        script:
          "다음은 [대학 대표]의 환영사가 있겠습니다. 말씀 부탁드립니다. [환영사 후] 감사합니다.",
      },
      {
        id: "reply",
        title: "답사",
        what: "기부기관 대표의 답사를 듣습니다.",
        role: "[기부기관 대표]",
        check: "발언자·호칭·발언 시간 확인",
        script:
          "이어서 [기부기관 대표]의 답사가 있겠습니다. [답사 후] 뜻깊은 말씀 감사합니다.",
      },
      {
        id: "purpose",
        title: "기부사 및 기부 배경 소개",
        what: "기부사 소개·기부 내역·기부 배경을 안내합니다.",
        role: "[사회자 또는 소개 담당]",
        check:
          "기부사 소개·기부 목적·기부금 용도·기부액 공개 범위·기부 배경을 별도 자료에서 확인",
        script:
          "[기부기관]을 소개하겠습니다. [기부사 소개]. 이번 기부의 목적은 [기부 목적]이며, [기부금 용도]를 위한 뜻을 담고 있습니다. [기부 배경]을 전해 드립니다. 기부액은 공개 여부를 별도로 확인한 원고에서만 안내해 주세요.",
      },
      {
        id: "handover",
        title: "기부금 및 감사패 전달",
        what: "기부금 전달 순서와 감사패 수여를 진행합니다.",
        role: "[전달자] · [수령자] · 물품 담당",
        check: "[전달 물품]·감사패 문구·전달자/수령자·방향·배치 확인",
        script:
          "기부금 및 감사패 전달 순서를 진행하겠습니다. [전달자]와 [수령자]께서는 안내에 따라 자리해 주시기 바랍니다. 먼저 [전달 물품] 전달을 진행하겠습니다. 이어 감사의 마음을 담아 감사패를 전달하겠습니다.",
      },
      {
        id: "photo",
        title: "기념촬영",
        what: "참석자와 함께 기념촬영을 진행합니다.",
        role: "촬영 담당 · 진행 담당",
        check: "[촬영 위치]·대표/전체 촬영 여부·배경·인원 확인",
        script:
          "기념촬영을 진행하겠습니다. 참석자 여러분께서는 진행 담당의 안내에 따라 [촬영 위치]에 자리해 주시기 바랍니다. 정면을 바라봐 주시면 감사하겠습니다.",
      },
      {
        id: "close",
        title: "오찬 및 환송",
        what: "확정된 오찬 또는 환송 일정을 안내합니다.",
        role: "진행 담당 · 식사/안내 담당",
        check:
          "오찬 진행 여부·장소·시간·식사 담당·환송 동선 확인; 오찬이 없으면 항목명과 멘트 수정",
        script:
          "함께해 주신 여러분께 감사드립니다. [오찬 진행 시: 오찬 장소·시간·이동 안내]. 오찬이 없다면 이 문구를 제외하고 환송 안내로 바꿔 주세요. [환송 동선]에 따라 이동해 주시기 바랍니다. 이상으로 [행사명]을 마치겠습니다.",
      },
    ],
  },
  {
    id: "meeting",
    name: "미팅·간담회",
    short: "미팅·간담회",
    description: "안건과 논의, 후속 조치를 정리해요",
    supplies: ["안건 자료", "메모·기록 수단", "자료 공유 방법"],
    agenda: [
      seq(
        "introduce",
        "참석자 소개",
        "참석자와 역할을 소개합니다.",
        "진행 담당",
        "소개 순서·호칭 확인",
        "시작에 앞서 참석자 여러분을 소개하겠습니다.",
      ),
      seq(
        "agenda",
        "안건 안내",
        "오늘 논의할 안건을 안내합니다.",
        "진행 담당·안건 담당",
        "최종 안건·배포 자료 확인",
        "오늘 논의할 안건을 안내드리겠습니다.",
      ),
      seq(
        "discussion",
        "논의",
        "안건별 의견을 나눕니다.",
        "참석자·진행 담당",
        "진행 방식·기록 담당·화면 점검",
        "안건에 대해 의견을 나누겠습니다.",
      ),
      seq(
        "followup",
        "결정사항·후속 조치 정리",
        "결정된 내용과 후속 담당을 확인합니다.",
        "진행 담당·기록 담당",
        "결정 내용·후속 담당·공유 방법 확인",
        "논의한 내용을 정리하고 후속 조치를 확인하겠습니다.",
      ),
      seq(
        "close",
        "종료",
        "회의를 마무리합니다.",
        "진행 담당",
        "자료 회수 여부·정리 확인",
        "이상으로 오늘 논의를 마치겠습니다. 감사합니다.",
      ),
    ],
  },
  {
    id: "award",
    name: "시상식",
    short: "시상식",
    description: "호명, 시상과 촬영 동선을 준비해요",
    supplies: [
      "상장·상패·부상 준비 여부",
      "호명 순서와 수여 물품 대조",
      "수상자 대기·이동 위치",
    ],
    agenda: [
      seq(
        "open",
        "개회",
        "시상식의 시작을 안내합니다.",
        "사회자",
        "행사명·시작 신호 확인",
        "지금부터 시상식을 시작하겠습니다.",
      ),
      seq(
        "guide",
        "시상 안내",
        "시상 내용과 진행 방법을 소개합니다.",
        "사회자",
        "시상 부문·진행 방식 확인",
        "오늘의 시상 내용과 진행 순서를 안내드리겠습니다.",
      ),
      seq(
        "present",
        "수상자 호명·시상",
        "수상자를 호명하고 상을 수여합니다.",
        "사회자·지정한 시상자·물품 담당",
        "호명 순서·상장 대조·물품 배치·이동 동선 확인",
        "호명되신 분께서는 안내에 따라 앞으로 나와 주시기 바랍니다.",
      ),
      seq(
        "photo",
        "기념촬영",
        "시상 후 기념사진을 촬영합니다.",
        "촬영 담당·진행 담당",
        "촬영 위치·단체 촬영 여부 확인",
        "기념촬영을 진행하겠습니다.",
      ),
      seq(
        "close",
        "마무리",
        "축하와 종료 안내를 전합니다.",
        "사회자",
        "퇴장·물품 전달 누락 확인",
        "수상하신 여러분께 축하드립니다. 이상으로 시상식을 마치겠습니다.",
      ),
    ],
  },
  {
    id: "other",
    name: "기타 행사",
    short: "기타 행사",
    description: "기본 흐름을 행사에 맞게 조정해요",
    supplies: ["주요 순서에 필요한 물품", "진행 역할과 현장 동선"],
    agenda: [
      seq(
        "open",
        "개회",
        "행사의 시작과 취지를 안내합니다.",
        "사회자 또는 진행 담당",
        "행사명·안내 사항 확인",
        "지금부터 행사를 시작하겠습니다.",
      ),
      seq(
        "main",
        "주요 순서",
        "행사 목적에 맞는 주요 순서를 진행합니다.",
        "사전에 지정한 담당",
        "세부 순서·역할·물품을 행사에 맞게 조정",
        "이어서 주요 순서를 진행하겠습니다.",
      ),
      seq(
        "close",
        "마무리",
        "행사를 마치고 후속 안내를 전합니다.",
        "진행 담당",
        "후속 안내·퇴장 동선 확인",
        "함께해 주셔서 감사합니다. 이상으로 행사를 마치겠습니다.",
      ),
    ],
  },
];
// 교체 시 파일과 이 레지스트리의 path / format / status만 수정합니다.
// events는 적용 행사, agendaIds는 관련 식순이 포함된 경우에만 노출하는 선택 필터입니다.
export const TEMPLATES = [
  ...EVENTS.flatMap((e) => [
    {
      id: `agenda-${e.id}`,
      events: [e.id],
      label: `${e.short} 식순지 예시`,
      path: `assets/templates/agenda-${e.id}.${["mou", "donation"].includes(e.id) ? "hwp" : "txt"}`,
      format: ["mou", "donation"].includes(e.id) ? "hwp" : "txt",
      status: ["mou", "donation"].includes(e.id) ? "real" : "sample",
    },
    {
      id: `script-${e.id}`,
      events: [e.id],
      label: `${e.short} 사회자 시나리오 예시`,
      path: `assets/templates/script-${e.id}.txt`,
      format: "txt",
      status: "sample",
    },
  ]),
  {
    id: "agreement-mou",
    events: ["mou"],
    agendaIds: ["sign", "exchange"],
    label: "협약서 구성 예시",
    path: "assets/templates/agreement-mou.txt",
    format: "txt",
    status: "sample",
  },
  {
    id: "welcome-speech",
    events: ["mou", "donation", "meeting", "award", "other"],
    label: "환영사 작성 예시 · 필요할 때 참고",
    path: "assets/templates/welcome-speech.txt",
    format: "txt",
    status: "sample",
  },
];
export const OUTPUTS = [
  {
    id: "welcome",
    title: "방문객 환영 화면 만들기",
    description: "행사명과 환영 문구를 담은 화면을 준비해요.",
    delivery: "현장 화면 송출 확인",
  },
  {
    id: "signage",
    title: "안내 화면 만들기",
    description: "행사 안내를 담은 화면을 준비해요.",
    delivery: "현장 화면 송출 확인",
  },
  {
    id: "notice",
    title: "입구·이동 안내문 만들기",
    description: "참석자가 찾아올 수 있도록 안내문을 준비해요.",
    delivery: "인쇄·부착 위치 확인",
  },
  {
    id: "led",
    title: "컨퍼런스홀 LED 화면 만들기",
    description: "설치 장소와 화면 규격을 먼저 확인해 주세요.",
    delivery: "현장 화면 송출 확인",
  },
];

// V0.3 운영 항목. when은 operations.js의 공통 조건, depends는 재확인 근거입니다.
export const FOOD_OPTIONS = [
  ["none", "필요 없음"],
  ["snacks", "다과"],
  ["meal", "식사"],
  ["both", "다과 + 식사"],
  ["unknown", "미정"],
];
export const GUEST_NEEDS = [
  {
    id: "parking",
    label: "주차 안내 확인",
    field: "parkingNote",
    placeholder: "직접 확인한 주차 안내만 입력",
  },
  {
    id: "arrival",
    label: "도착 예정시간 확인",
    field: "arrivalNote",
    placeholder: "예: 시작 10분 전 도착 요청",
  },
  {
    id: "contact",
    label: "담당자 연락 방법 안내",
    field: "contactNote",
    placeholder: "공유 가능한 업무 연락 방법만 입력",
  },
];
export const ROLE_TEMPLATES = [
  { id: "lead", label: "총괄", when: "always" },
  { id: "host", label: "사회 / 진행", when: "agenda" },
  { id: "guests", label: "주요 참석자·내빈 안내", when: "guests" },
  { id: "seats", label: "좌석 / 명패", when: "seats" },
  { id: "screen", label: "화면 / 발표자료", when: "screen" },
  { id: "materials", label: "실물자료 / 전달물", when: "materials" },
  { id: "photo", label: "촬영", when: "photo" },
  { id: "food", label: "다과 / 식사", when: "food" },
  { id: "record", label: "회의 기록", when: "meeting" },
  { id: "support", label: "현장 지원", when: "always" },
  { id: "other", label: "기타", when: "always" },
];
export const GUEST_PREP = [
  {
    id: "guest-invite",
    title: "외부 참석자에게 행사 일시·정확한 장소 안내",
    detail: "안내문을 검토한 뒤 직접 전달하세요. 복사는 발송이 아닙니다.",
    when: "external",
    depends: ["eventName", "date", "venue", "otherVenue", "venueDetail"],
  },
  ...GUEST_NEEDS.map((n) => ({
    id: `guest-${n.id}`,
    title: n.label,
    detail: "확인한 내용만 안내하고 필요 시 참석자와 별도로 협의하세요.",
    when: `guest-${n.id}`,
    depends: [
      "external",
      "guestNeeds",
      n.field,
      "date",
      "venue",
      "otherVenue",
      "venueDetail",
    ],
  })),
];
export const FOOD_PREP = [
  {
    id: "food-count",
    title: "다과·식사 예상 인원 확인",
    detail: "전체 참석 인원과 실제 제공 인원을 확인하세요.",
    depends: ["food", "foodPeople", "people"],
  },
  {
    id: "food-order",
    title: "주문 / 예약 확인",
    detail: "필요한 준비가 실제로 확정됐는지 직접 확인하세요.",
    depends: ["food", "foodPeople", "people", "date"],
  },
  {
    id: "food-arrival",
    title: "수령·배달 시간과 배치 장소 확인",
    detail: "현장 진행에 맞춰 수령 담당과 위치를 정하세요.",
    depends: [
      "food",
      "foodTime",
      "foodPlace",
      "date",
      "venue",
      "otherVenue",
      "venueDetail",
    ],
  },
  {
    id: "food-cleanup",
    title: "종료 후 다과·식사 정리 방법 준비",
    detail: "남은 음식과 사용 물품의 정리 방법을 확인하세요.",
    depends: ["food", "venue", "otherVenue"],
  },
  {
    id: "food-diet",
    title: "식이 제한 별도 확인",
    detail:
      "필요 여부만 기록합니다. 개인별 알레르기·건강정보는 입력하지 마세요.",
    when: "diet",
    depends: ["food", "diet"],
  },
];
export const ONSITE_ITEMS = [
  {
    id: "parking-registration",
    title: "외부 참석자 주차등록을 확인했나요?",
    when: "parking",
    depends: ["external", "parkingStatus", "venue", "otherVenue", "date"],
  },
  {
    id: "place",
    title: "행사 장소가 실제로 사용 가능한가요?",
    detail: "출입·조명·준비 공간과 이동 통로를 현장에서 확인하세요.",
    when: "always",
    depends: ["venue", "otherVenue", "venueDetail", "date"],
  },
  {
    id: "seats",
    title: "좌석이 실제 배치되어 있나요?",
    when: "seating",
    depends: [
      "venue",
      "otherVenue",
      "venueDetail",
      "date",
      "seating",
      "people",
    ],
  },
  {
    id: "nameplates",
    title: "명패를 실제 좌석과 대조해 배치했나요?",
    when: "nameplates",
    depends: [
      "venue",
      "otherVenue",
      "venueDetail",
      "date",
      "nameplates",
      "people",
    ],
  },
  {
    id: "audio",
    title: "마이크·음향을 실제로 테스트했나요?",
    when: "audio",
    depends: ["venue", "otherVenue", "venueDetail", "date", "audio"],
  },
  {
    id: "agenda",
    title: "진행 담당이 최종 식순을 갖고 있나요?",
    when: "agenda",
    depends: ["event", "agenda", "date", "roles"],
  },
  {
    id: "vip",
    title: "주요 참석자 도착 여부를 확인했나요?",
    when: "vip",
    depends: ["vip", "date", "venue", "otherVenue"],
  },
  {
    id: "photo",
    title: "촬영 담당·방법과 촬영 위치를 확인했나요?",
    when: "photo",
    depends: [
      "photography",
      "event",
      "agenda",
      "roles",
      "date",
      "venue",
      "otherVenue",
      "venueDetail",
    ],
  },
  {
    id: "guests",
    title: "외부 방문객을 맞이할 안내가 준비됐나요?",
    when: "external",
    depends: [
      "external",
      "date",
      "venue",
      "otherVenue",
      "venueDetail",
      "guestNeeds",
      "parkingNote",
      "arrivalNote",
      "contactNote",
      "roles",
    ],
  },
  {
    id: "food",
    title: "다과·식사가 예정된 장소에 실제 배치됐나요?",
    when: "food",
    depends: [
      "food",
      "foodPeople",
      "people",
      "foodTime",
      "foodPlace",
      "date",
      "venue",
      "otherVenue",
      "venueDetail",
    ],
  },
  {
    id: "mou-docs",
    title: "최종 협약서와 배치 방향을 확인했나요?",
    when: "mou-exchange",
    depends: ["event", "agenda", "date", "venue", "otherVenue", "venueDetail"],
  },
  {
    id: "mou-pen",
    title: "서명펜이 준비되어 있나요?",
    when: "mou-sign",
    depends: ["event", "agenda", "date", "venue", "otherVenue", "venueDetail"],
  },
  {
    id: "mou-flow",
    title: "서명·교환 동선을 현장에서 확인했나요?",
    when: "mou-exchange",
    depends: ["event", "agenda", "date", "venue", "otherVenue", "venueDetail"],
  },
  {
    id: "award",
    title: "상장·상패와 수상자, 수여순서·이동동선을 대조했나요?",
    when: "award",
    depends: ["event", "agenda", "date", "venue", "otherVenue", "venueDetail"],
  },
  {
    id: "donation",
    title: "전달물품·전달자·수령자와 촬영위치를 확인했나요?",
    when: "donation",
    depends: ["event", "agenda", "date", "venue", "otherVenue", "venueDetail"],
  },
  {
    id: "meeting",
    title: "회의자료와 기록 담당을 확인했나요?",
    when: "meeting",
    depends: ["event", "agenda", "date", "roles"],
  },
  {
    id: "materials",
    title: "필요한 실물 문서·물품이 현장에 있나요?",
    when: "other-materials",
    depends: ["event", "agenda", "date"],
  },
];
export const AFTER_ITEMS = [
  {
    id: "photos",
    title: "행사 사진·촬영자료 확보",
    when: "photo",
    depends: ["date", "photography", "event"],
  },
  {
    id: "publicity",
    title: "보도자료·블로그 활용 여부 확인",
    when: "publicity",
    depends: ["publicity", "date"],
  },
  {
    id: "return",
    title: "빌린 장비·물품 반납",
    when: "borrowed",
    depends: ["borrowed", "date"],
  },
  {
    id: "cleanup",
    title: "다과·식사와 사용 공간 정리",
    when: "food",
    depends: ["food", "date", "venue"],
  },
  {
    id: "archive",
    title: "행사자료 보관",
    when: "always",
    depends: ["event", "date"],
  },
  {
    id: "admin",
    title: "비용·증빙 등 필요한 후속 행정 처리",
    when: "admin",
    depends: ["followupAdmin", "date"],
  },
];

// 일정을 고정하지 않고, 먼저 협의할 일을 안내하는 표시 순서입니다.
export const PREP_PRIORITY = [
  "date",
  "venue",
  "rental",
  "vip-confirm",
  "press-request",
  "press-support",
  "guest-decision",
  "food-decision",
  "food-count",
  "food-order",
  "agenda",
  "roles",
  "attendee-guide",
  "guest-invite",
  "guest-parking",
  "parking-registration",
  "guest-arrival",
  "guest-contact",
  "photo-plan",
  "food-arrival",
];
