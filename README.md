# AI-ONE Platform Prototype

공통 UI 자산과 화면별 자산으로 구성된 정적 HTML 프로젝트입니다.

## 폴더

- `pages`: 공통 마크업을 파일 안에 직접 포함한 독립 화면 HTML
- `css`: 테마 전용 `ai-theme.css`, 공통 UI 통합 `common.css`, 화면별 CSS
- `js`: 테마 전용 `ai-theme.js`, 공통 UI 통합 `common.js`, 화면별 JavaScript
- `assets`: 화면에서 사용하는 아이콘 등의 정적 자산
- `images`: 화면에서 사용하는 이미지 자산

## 화면 목록

- 전체 화면 목록: `filelist.html`
- 메인: `pages/ai-home.html`
- 국회질의분류: `pages/ai-workspace.html`
- 국회 답변서 초안: `pages/ai-answer.html`
- 국회 답변서 초안 9월 15일 이후 버전: `pages/ai-answer-after.html`
- AI-ONE 챗봇: `pages/ai-chatbot.html` (준비 중 화면)
- 로그인: `pages/login.html`

## 전달 범위

현재 전달본은 정적 프로토타입 실행에 필요한 파일만 포함합니다.

화면에 표시되는 로그인, 파일 업로드, 검색, AI 채팅, 분류 및 문서 생성 결과는 퍼블리싱 검토를 위한 예시 동작입니다. 실제 인증, 파일 저장, 데이터 영속화 및 업무 시스템 연동은 포함하지 않습니다.

## 로컬 실행

`pages/*.html`은 필요한 마크업을 각 파일에 직접 포함하므로 `file://` 방식으로도 열 수 있습니다. 페이지 간 이동까지 함께 확인할 때는 프로젝트 루트에 로컬 웹 서버를 연결해 실행해 주세요.

```bash
python -m http.server 8000
```

서버 실행 후 브라우저에서 필요한 화면에 접속합니다.

- 전체 화면 목록: `http://localhost:8000/filelist.html`
- 메인 화면: `http://localhost:8000/pages/ai-home.html`
- 국회질의분류 화면: `http://localhost:8000/pages/ai-workspace.html`

개발 도구의 Live Server를 사용하는 경우에도 프로젝트 루트를 서버 기준 경로로 지정해 주세요.

## 공통 자산 사용

공통 스타일과 동작은 `css/common.css`, `js/common.js`에 포함되어 있습니다. 페이지에서는 `ai-theme.css` → `common.css` → 화면별 CSS 순서로 불러오며, JavaScript는 `ai-theme.js` → `common.js` → 화면별 JavaScript 순서로 불러옵니다.

페이지 마크업은 각 `pages/*.html` 파일에서 관리하고, 공통 UI 변경은 `css/common.css`와 `js/common.js`에 직접 반영합니다.

## Mock 및 API 연동

`pages/ai-answer-after.html`은 `js/ai-answer-after.js`의 `window.AIOneAgentBridge`를 통해 API 연동 지점을 제공합니다. 기본 모드는 `mock`이며, 이 상태에서는 네트워크 요청 없이 HTML과 JavaScript에 작성된 예시 데이터로 동작합니다.

현재 제공하는 API 키와 용도는 다음과 같습니다.

- `questionUpload`: 질의 파일 OCR·파싱·질의 추출·분류
- `questionReclassify`: 질의 재분류
- `notificationSend`: 확정 결과 및 실국 알림 전달
- `chatPrompt`: AI 채팅 프롬프트 전송
- `referenceSearch`: AI 참조 소스 검색
- `referenceImport`: 선택한 참조 소스 등록·청킹
- `draftVersionGet`: 선택한 답변서 초안 버전 조회
- `similarAnswerGet`: 선택한 유사답변서 조회
- `draftDifferenceAnalyze`: 초안 버전 간 차이점 분석
- `answerDifferenceAnalyze`: 유사답변서와 초안 버전 간 차이점 분석

실제 API를 연결할 때는 `ai-answer-after.js`를 불러온 다음 별도 연동 스크립트에서 모드와 endpoint를 설정합니다.

```js
const agentBridge = window.AIOneAgentBridge;

agentBridge.config.mode = 'live';
Object.assign(agentBridge.config.endpoints, {
  chatPrompt: '/api/ai/chat',
  referenceSearch: '/api/ai/references/search',
  referenceImport: '/api/ai/references/import',
  draftVersionGet: '/api/ai/drafts/version',
  similarAnswerGet: '/api/ai/answers/similar',
  draftDifferenceAnalyze: '/api/ai/drafts/difference',
  answerDifferenceAnalyze: '/api/ai/answers/difference'
});
```

API 요청은 JSON 본문을 사용하는 `POST` 방식이며 쿠키를 포함합니다. 성공 응답은 JSON이어야 하고, 응답 필드 구조는 백엔드 API 규격 확정 후 각 호출부의 화면 데이터 형식에 맞춰 최종 매핑해야 합니다. 서버에서 받은 문자열을 HTML로 출력하는 경우에는 화면에 넣기 전에 반드시 이스케이프 또는 정제해 주세요.

나머지 페이지의 동작은 현재 정적 프로토타입 범위이며 별도의 실서비스 API 어댑터는 포함하지 않습니다.
