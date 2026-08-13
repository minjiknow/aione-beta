# Pages

`pages` 폴더의 각 HTML은 실행 시점에 외부 마크업을 조립하지 않는 독립 화면입니다. Sidebar, Topbar, Panel, Modal, SidePop 등의 실제 마크업이 각 페이지 파일에 포함되어 있으므로 HTML만 열어도 전체 구조를 확인할 수 있습니다.

## 공통 자산

페이지는 아래 순서로 공통 자산과 화면별 자산을 불러옵니다.

- CSS: `ai-theme.css` → `common.css` → 화면별 CSS
- JavaScript: `ai-theme.js` → `common.js` → 화면별 JavaScript

공통 UI의 스타일과 동작은 `css/common.css`, `js/common.js`에 포함되어 있습니다. 테마·강조 컬러 상태와 설정 컨트롤 동작은 `js/ai-theme.js`가 전담하고, `js/common.js`에는 알림 설정과 공통 UI 런타임이 남습니다.

화면 마크업은 대상 `pages/*.html` 파일에서 수정하고, 공통 스타일과 동작은 `css/common.css`, `js/common.js`에서 관리합니다.

## 실행

개별 페이지는 `file://` 방식으로 직접 열 수 있습니다. 페이지 간 이동까지 함께 확인할 때는 프로젝트 루트에서 로컬 서버를 실행하는 편이 안정적입니다.

```bash
python -m http.server 8000
```

```text
http://localhost:8000/pages/ai-workspace.html
```
