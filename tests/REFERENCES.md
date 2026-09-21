# 기존 연결 주소 읽기 전용 대조

확인일: 2026-09-21 (Asia/Seoul)

## 확인 방법과 한계

- 사용자가 지정한 10개 주소와 추가 GitHub 파일 2개에 HTTP GET만 수행했습니다. 모두 HTTP 200을 반환했고 제목과 HTML/문서 내용을 읽었습니다.
- 최초 웹 열기 도구는 접근 불가 또는 캐시 미스로 실패했고, 기본 샌드박스의 HTTP 요청은 DNS 조회가 실패했습니다. 허용된 읽기 전용 네트워크 요청으로 재시도한 결과를 아래에 기록했습니다. 최초 실패를 원본 사이트 장애로 판단하지 않았습니다.
- 로그인, 개인 브라우저 조작, 입력, 제작, 다운로드 버튼 실행, 실제 신청·예약·제출·메일 발송을 하지 않았습니다. 운영 저장소·Apps Script·Sheets·Drive·Firebase 등을 수정하지 않았습니다.
- HTTP 200과 HTML의 설명은 페이지 접근 및 용도 대조의 근거입니다. 실제 제작·출력·접수·지원 확정·현장 송출 기능의 성공 증거는 아닙니다.

## 주소별 결과

| 주소 | 응답 / HTML 제목 | 읽기 전용으로 확인한 용도·제약 |
| --- | --- | --- |
| [MACH](https://erakeun.github.io/ERICAAI/) | 200 / PROJECT MACH | 기존 도구 목록. 아래 제작·요청 도구 8개의 등록 URL이 지시문과 일치합니다. |
| [MACH 저장소](https://github.com/erakeun/ERICAAI) | 200 / GitHub - erakeun/ERICAAI · GitHub | 공개 GitHub 저장소 페이지를 확인했습니다. 원큐 전용 저장소라는 의미는 아닙니다. |
| [프라임 좌석배치](https://erakeun.github.io/erica-seat-planner/) | 200 / ERICA Seat Planner · PRIME Conference Hall | PRIME 컨퍼런스홀 좌석 배치·출력 및 명패 도구 이동 용도. 다른 장소용 도면으로 사용하지 않습니다. |
| [명패](https://erakeun.github.io/nameplate-maker/) | 200 / 행사용 명패 생성기 | 명단을 바탕으로 명패를 구성하고 A4 양면 인쇄/PDF를 준비하는 화면입니다. 개인정보 입력이나 출력을 실행하지 않았습니다. |
| [웰컴보드](https://erakeun.github.io/welcome-board-maker/) | 200 / 웰컴보드 제작기 | 본관 1층 화면에 쓰는 환영 이미지 제작으로 설명합니다. 프라임·히스토리라운지와의 장비 대응은 확인하지 않았습니다. |
| [디지털 사이니지](https://erakeun.github.io/digital-signage-maker/) | 200 / 디지털 사이니지 제작기 | 세로형 디지털 안내 화면 제작으로 설명합니다. 결과물 제작과 장비 재생 설정을 구분하는 안내가 있습니다. 선택 장소에 실제 설치되었는지는 확인하지 않았습니다. |
| [안내문](https://erakeun.github.io/notice-maker/) | 200 / 안내문 제작기 | A4 인쇄용 안내문 제작으로 설명하며, 웰컴보드 제작기와 분리되어 있습니다. 실제 출력은 실행하지 않았습니다. |
| [컨퍼런스홀 LED](https://erakeun.github.io/conference-hall-led-maker/) | 200 / 컨퍼런스홀 LED 현수막 제작기 · Hanyang University ERICA | 컨퍼런스홀 LED용 이미지/PPTX 제작 화면입니다. PRIME 컨퍼런스홀 대응이라는 근거는 확인되지 않았습니다. 프라임 선택 시 자동 추천하지 않습니다. |
| [보도자료 기초자료](https://erakeun.github.io/erica-pr-request/) | 200 / 보도자료 기초자료 제출 | 사실관계·참고자료 등을 받는 보도자료 기초자료 접수 화면입니다. 제출 성공, 메일 전달, 언론/블로그 게재 확정은 검증하지 않았습니다. |
| [촬영·취재 협조](https://erakeun.github.io/erica-press/) | 200 / ERICA 촬영·취재 지원 요청 | Apps Script 주소로 이동시키는 HTML입니다. 이 200은 실제 신청 폼이나 접수 성공의 증거가 아닙니다. 이동 대상의 인증 조건·폼 작동·접수·지원 여부는 미검증입니다. |

## MACH 목록과 추가 파일

[MACH index.html](https://github.com/erakeun/ERICAAI/blob/main/index.html)은 HTTP 200이었으며, 현행 배포 HTML과 GitHub 코드에서 `erica-seat-planner`, `nameplate-maker`, `welcome-board-maker`, `digital-signage-maker`, `notice-maker`, `conference-hall-led-maker`, `erica-pr-request`, `erica-press`의 등록 URL을 모두 대조했습니다. 지시문과 일치하므로 주소를 바꾸지 않습니다.

[좌석배치 README](https://github.com/erakeun/erica-seat-planner/blob/main/README.md)도 HTTP 200이었습니다. 본관 2층 PRIME 컨퍼런스홀 전용이라고 명시되어 있습니다. 명패 연동은 참석자 정보를 URL에 싣지 않는 창 간 메시지 방식이며 수신 명패 창에서 확인하는 절차가 있다고 설명합니다. 이는 기존 좌석 도구의 설명이며 원큐에 자동 전송 기능을 추가하거나 자동 입력을 약속할 근거가 아닙니다.

## 혼동 방지와 남은 확인사항

- 프라임 컨퍼런스홀과 컨퍼런스홀 중강당을 동일한 장소로 취급할 근거를 확인하지 못했습니다. 좌석 도구는 프라임 선택에만 연결합니다.
- LED 페이지에서 출력 규격 안내는 읽었지만 실제 설치 장소와 프라임 공간의 대응을 검증하지 않았습니다. 원큐에서는 다른 제작 도구 안에 두고 설치 장소·화면 규격 확인을 안내하는 것이 적절합니다.
- 방문객 환영 화면·사이니지도 사용자 선택 장소의 설치 장비와 대응 확인이 필요합니다. 읽은 페이지의 설명을 장소별 장비 보유 사실로 확장하지 않습니다.
- 장소별 담당 부서·전화번호·예약 URL·비용·기한·수용 인원·장비·대관 절차는 이번 대조로 확정되지 않았습니다. 원큐에는 null/unknown으로 둡니다. 외부 도구의 좌석 수나 연락처를 대관 정보로 가져오지 않습니다.
- 촬영 요청의 부총장 이상 조건은 원큐에 대한 사용자의 요구사항입니다. 학교 공식 규정·지원 보장·신청 기한으로 표현하지 않습니다.
- 실제 기능, 인증 필요 여부(특히 Apps Script 이동 후), 현장 설치/송출, HWP 원본은 미검증입니다.

## 정적 호스팅 참고

[GitHub Pages 공식 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)를 확인했습니다. HTML/CSS/JavaScript 정적 호스팅과 저장소 하위 경로 프로젝트 사이트를 지원하는 설명에 맞춰 원큐를 구성했습니다. 실제 Pages 배포는 수행하지 않았습니다.
