/* ============================ 시작: AI 답변 완료 화면 ============================ */

(() => {
    "use strict";

    /* 파일 구성: 비교/문서 뷰어 -> 추천 자료 -> 초안 검증 -> 지능형 소스 검색 -> 공통 컨트롤러. */

    let workspaceStarted = false;

    // 아이콘 경로 보정
    function hydrateIcons(root = document) {
        root.querySelectorAll?.("img[data-icon]").forEach((icon) => {
            if (icon.src) return;
            icon.src = new URL(`../assets/icons/${icon.dataset.icon}.svg`, document.baseURI).href;
        });
    }

    // 완료 답변 화면 시작
    function startAfter9Workspace() {
        if (workspaceStarted) return;
        workspaceStarted = true;

        /* ============================ 시작: 화면 핵심 동작 ============================ */

        try {
            (function () {
                "use strict";

                // DOM 요소 하나 조회
                const $ = (s, c = document) => c.querySelector(s);
                // DOM 요소 목록 조회
                const $$ = (s, c = document) => [...c.querySelectorAll(s)];
                const ANSWER_PANEL_SELECTOR = ".three-panel-area > .three-panel";

                // After Prototype 복제
                function cloneAfterPrototype(prototypeId) {
                    const prototype = document.getElementById(prototypeId);
                    if (!prototype) return null;
                    const source = prototype.tagName === "TEMPLATE" ? prototype.content.firstElementChild : prototype.hasAttribute("data-prototype-wrapper") ? prototype.firstElementChild : prototype;
                    if (!source) return null;
                    const clone = source.cloneNode(true);
                    clone.id = prototype.dataset.instanceId || "";
                    clone.removeAttribute("hidden");
                    clone.removeAttribute("data-dom-prototype");
                    clone.removeAttribute("data-instance-id");
                    return clone;
                }

                // HTML 특수문자 이스케이프
                function escapeHtml(value) {
                    return String(value ?? "").replace(
                        /[&<>"']/g,
                        (character) =>
                            ({
                                "&": "&amp;",
                                "<": "&lt;",
                                ">": "&gt;",
                                '"': "&quot;",
                                "'": "&#39;",
                            })[character],
                    );
                }

                /* ============================ 시작: 화면 데이터 ============================ */
                let fileIdSeq = 0;
                const files = [];

                // 파일 처리 파이프라인 단계 정의: 파싱 → SLM 자연어화 → 청킹
                const FILE_STAGES = [
                    { status: "parsing", label: "파싱 중", delay: 900 },
                    { status: "summarizing", label: "SLM 자연어화 중", delay: 900 },
                    { status: "chunking", label: "청킹 중", delay: 800 },
                    { status: "done", label: "청킹 완료", delay: 0 },
                ];

                const recommendations = [
                    {
                        id: 1,
                        title: "지방채 인수 추경 편성 사유 답변",
                        score: 97,
                        meta: "과거답변서 · 2026년 · 기획재정위원회",
                        category: "similar",
                        desc: "현재 질의와 직접 연결되는 과거 답변. 공자기금 지방채 인수 필요성과 추경 편성 논리를 함께 설명.",
                        tags: ["과거답변서", "추경편성", "지방채인수"],
                        preview: {
                            org: "기획재정위원회 · 2026년",
                            title: "지방채 인수 추경 편성 사유 답변",
                            sections: [
                                { title: "질의 요지", items: ["지방교부세 지급 중 지방채 인수와 추경 편성이 필요한 이유를 질의", "지방채 증가에 따른 재정건전성 관리방안도 함께 요구"] },
                                { title: "핵심 답변", items: ["지방교부세는 일반재원, 지방채는 특정 자본적 지출을 위한 별도 재원", "공자기금은 장기·저리 인수로 지자체의 일시적 대규모 투자수요를 지원"] },
                            ],
                        },
                    },
                    {
                        id: 2,
                        title: "지방채 인수 예산 현황표(2016~2026)",
                        score: 95,
                        meta: "참고자료 · 예산현황 · 재정정책국",
                        category: "reference",
                        desc: "연도별 지방채 인수 계획·실적·잔액을 정리한 최신 현황표.",
                        tags: ["예산현황", "인수실적"],
                        preview: {
                            org: "재정정책국 · 2026년",
                            title: "지방채 인수 예산 현황표",
                            sections: [{ title: "주요 수치", items: ["'25년 예산 12,100억 원 / 결산 10,712억 원", "'26년 본예산 1,000억 원 / 추경안 2,000억 원", "'25년 말 인수잔액 71,532억 원"] }],
                        },
                    },
                    {
                        id: 3,
                        title: "260402_재경위 전체 의원 질의 답변 통합본",
                        score: 94,
                        meta: "과거답변서 · 2026년 · 기획재정위원회",
                        category: "similar",
                        desc: "공자기금 지방채 인수 제도, 추경 편성 배경, 지원조건을 포함한 전체 의원 답변 통합본.",
                        tags: ["과거답변서", "공자기금"],
                        preview: {
                            org: "기획재정위원회 · 2026년",
                            title: "재경위 전체 의원 질의 답변 통합본",
                            sections: [{ title: "활용 가능 문단", items: ["공자기금의 지방채 인수 목적과 지원대상", "5년 거치 10년 분할 상환 조건과 인수금리 설명", "추경 편성 필요성에 대한 기존 답변 논리"] }],
                        },
                    },
                    {
                        id: 4,
                        title: "광주·전남 통합 관련 추경 수요 상세",
                        score: 92,
                        meta: "참고자료 · 근거자료 · 지역발전정책국",
                        category: "reference",
                        desc: "통합특별시 출범 관련 추경 규모와 지자체별 세부 수요.",
                        tags: ["광주전남", "추경수요"],
                        preview: {
                            org: "지역발전정책국 · 2026년",
                            title: "광주·전남 통합 관련 추경 수요",
                            sections: [{ title: "세부 수요", items: ["전남: 통합전산망·안내표지판 등 약 700억 원", "광주: 재난관리기금·재해구호기금 등 약 195억 원", "기타 공통 전환비용을 포함해 약 1,000억 원 규모"] }],
                        },
                    },
                    {
                        id: 5,
                        title: "공자기금 지방채 인수 제도 및 법적 근거",
                        score: 90,
                        meta: "참고자료 · 법령근거 · 국고실",
                        category: "reference",
                        desc: "공공자금관리기금법 및 지방재정 관련 규정에 따른 지방채 인수 근거와 절차 정리.",
                        tags: ["법령근거", "공자기금"],
                        preview: {
                            org: "국고실 · 법령분석",
                            title: "공자기금 지방채 인수 제도 및 법적 근거",
                            sections: [{ title: "법적 근거", items: ["공공자금관리기금 관련 법령에 따른 기금 운용", "지방채 발행·인수 절차와 승인 체계", "인수대상 사업 및 상환조건의 제도적 근거"] }],
                        },
                    },
                    {
                        id: 6,
                        title: "지방교부세와 지방채 재원 성격 비교자료",
                        score: 88,
                        meta: "참고자료 · 분석자료 · 재정정책국",
                        category: "reference",
                        desc: "지방교부세 일반재원과 지방채 자본적 지출 재원의 차이를 비교.",
                        tags: ["지방교부세", "재원비교"],
                        preview: {
                            org: "재정정책국 · 분석자료",
                            title: "지방교부세와 지방채 재원 성격 비교",
                            sections: [{ title: "비교 요지", items: ["지방교부세: 지자체의 일반재원으로 폭넓게 활용", "지방채: 특정 자본사업의 일시적 대규모 재원조달 수단", "두 재원은 목적과 상환구조가 달라 병행 활용 가능"] }],
                        },
                    },
                    {
                        id: 7,
                        title: "2026년 공자기금 분기별 인수금리 산정자료",
                        score: 86,
                        meta: "참고자료 · 금리자료 · 국고실",
                        category: "reference",
                        desc: "공자기금 조달금리와 지방채 인수금리 산정 기준 및 분기별 변동 추이.",
                        tags: ["인수금리", "공자기금"],
                        preview: { org: "국고실 · 2026년", title: "공자기금 분기별 인수금리", sections: [{ title: "금리 현황", items: ["'26.1분기 2.957%", "'26.2분기 3.435%", "분기별 공자기금 조달비용을 기준으로 고정 적용"] }] },
                    },
                    {
                        id: 8,
                        title: "지방재정 채무관리 지표 및 위기관리 기준",
                        score: 84,
                        meta: "참고자료 · 지침 · 재정정책국",
                        category: "reference",
                        desc: "지방채 발행 이후 채무비율과 재정위험을 관리하기 위한 지표 및 대응 기준.",
                        tags: ["채무관리", "재정건전성"],
                        preview: {
                            org: "재정정책국 · 지침",
                            title: "지방재정 채무관리 지표",
                            sections: [{ title: "관리 지표", items: ["예산대비 채무비율과 관리채무부담도 점검", "재정위험 상승 시 신규 지방채 발행·투자사업 관리 강화", "위기단체 지정 및 단계별 개선계획 수립"] }],
                        },
                    },
                    {
                        id: 9,
                        title: "세수추계 및 세입경정 운용 검토자료",
                        score: 82,
                        meta: "참고자료 · 분석자료 · 세제실",
                        category: "reference",
                        desc: "추경 재원 마련 시 세입경정과 추가 세수 활용 가능성을 검토한 자료.",
                        tags: ["세입경정", "세수추계"],
                        preview: {
                            org: "세제실 · 2026년",
                            title: "세수추계 및 세입경정 운용 검토",
                            sections: [{ title: "검토 내용", items: ["세목별 세수 전망과 추가 세입 가능성 점검", "세입경정 필요 여부와 시점 검토", "추경 재원 구성 시 국채발행 최소화 방안"] }],
                        },
                    },
                    {
                        id: 10,
                        title: "지방채 발행 한도 산정 및 승인 절차",
                        score: 80,
                        meta: "참고자료 · 지침 · 지방재정",
                        category: "reference",
                        desc: "지자체별 지방채 발행 한도 산정기준과 한도 초과 시 승인 절차.",
                        tags: ["지방채한도", "승인절차"],
                        preview: {
                            org: "지방재정 · 지침",
                            title: "지방채 발행 한도 산정 및 승인 절차",
                            sections: [{ title: "주요 내용", items: ["최근 재정규모와 채무지표를 반영해 발행한도 산정", "한도 초과 사업은 별도 협의·승인 절차 적용", "중장기 상환계획을 함께 검토"] }],
                        },
                    },
                    {
                        id: 11,
                        title: "통합특별시 출범 재정지원 유사사례 답변",
                        score: 78,
                        meta: "과거답변서 · 유사사례 · 지역발전정책국",
                        category: "similar",
                        desc: "행정구역 통합·특별자치단체 출범 시 일시적 투자수요에 대응한 과거 답변 사례.",
                        tags: ["과거답변서", "통합특별시"],
                        preview: {
                            org: "지역발전정책국 · 유사사례",
                            title: "통합특별시 출범 재정지원 유사사례",
                            sections: [{ title: "유사 논거", items: ["출범 초기 전산·표지·조직 통합 비용이 단기간 집중", "일회성 자본투자는 장기상환 재원과 연계 가능", "사업별 집행시기를 고려해 추경 편성 여부 검토"] }],
                        },
                    },
                    {
                        id: 12,
                        title: "최근 5년 지방채 인수 실적 및 상환 현황",
                        score: 76,
                        meta: "참고자료 · 통계자료 · 국고실",
                        category: "reference",
                        desc: "최근 5년 인수액, 상환액, 잔액과 만기구조를 정리한 통계자료.",
                        tags: ["통계자료", "상환현황"],
                        preview: { org: "국고실 · 통계자료", title: "최근 5년 지방채 인수 실적 및 상환 현황", sections: [{ title: "통계 항목", items: ["연도별 신규 인수액", "원금 상환 및 이자 납부액", "만기별 잔액과 향후 상환스케줄"] }] },
                    },
                    {
                        id: 13,
                        title: "재정사업 구조조정 및 추경 재원 확보 사례",
                        score: 73,
                        meta: "참고자료 · 예산분석 · 경제정책국",
                        category: "reference",
                        desc: "불용·저성과 사업 조정으로 추경 재원을 확보한 과거 운용사례.",
                        tags: ["지출구조조정", "추경재원"],
                        preview: {
                            org: "경제정책국 · 예산분석",
                            title: "재정사업 구조조정 및 추경 재원 확보 사례",
                            sections: [{ title: "운용 사례", items: ["집행부진 사업의 연내 불용 예상액 점검", "저성과·중복사업 감액을 통해 신규 긴급소요에 재배분", "사업조정 시 국민 체감성과와 집행가능성 병행 검토"] }],
                        },
                    },
                    {
                        id: 14,
                        title: "지방재정 운용 성과평가 보고서",
                        score: 69,
                        meta: "참고자료 · 성과보고 · 지역발전정책국",
                        category: "reference",
                        desc: "지자체별 재정운용 성과와 채무관리 지표 평가 결과 요약.",
                        tags: ["성과평가", "지방재정"],
                        preview: { org: "지역발전정책국 · 2026년", title: "지방재정 운용 성과평가 보고서", sections: [{ title: "평가 내용", items: ["채무관리·재정효율성 지표 평가", "우수 지자체 재정운용 사례", "등급별 개선 권고사항"] }] },
                    },
                ];

                // 문서 Meta Box 구성
                function buildDocMetaBox(items) {
                    if (!items || !items.length) return "";
                    return `<div class="web-doc-meta-box">${items
                        .map(
                            (item) => `
      <div class="web-doc-meta-item"><span class="web-doc-meta-label">${item.label}</span><span>${item.value}</span></div>
    `,
                        )
                        .join("")}</div>`;
                }

                // 문서 Section 구성
                function buildDocSection(section, contextTitle) {
                    const sectionTitle = section.title || "주요 내용";
                    const desc =
                        section.desc ||
                        `${contextTitle}와 관련하여 ${sectionTitle}에 대한 검토 내용을 정리한 문단입니다. 실제 답변서 작성 시에는 핵심 논거, 수치, 추진 경과를 함께 확인할 수 있도록 문장 길이를 충분히 확보한 형태로 제시합니다.`;
                    const note = section.note || `${sectionTitle} 관련 문단은 실제 스캔 문서처럼 충분한 분량을 유지하도록 보강되었으며, 실무 검토 시에는 근거자료와 답변 논리를 함께 확인할 수 있습니다.`;
                    return `<div class="web-doc-section">
      <h4 class="web-doc-section-title">${sectionTitle}</h4>
      <p class="web-doc-section-desc">${desc}</p>
      <ul class="web-doc-list">${(section.items || []).map((item) => `<li>${item}</li>`).join("")}</ul>
      <div class="web-doc-note">${note}</div>
    </div>`;
                }

                // 문서 페이지 구성
                function buildDocPage({ org, title, continueTitle, pageIdx, totalPages, metaItems, lead, sections, tableHtml }) {
                    const header = pageIdx === 0 ? `<span class="web-doc-org">${org}</span><h3 class="web-doc-title">${title}</h3>` : `<span class="web-doc-org">${continueTitle || `${title} · (계속)`}</span>`;
                    return `<div class="draft-page">
      <div class="web-doc-header${pageIdx > 0 ? " web-doc-header-sub" : ""}">${header}</div>
      <div class="web-doc-body">
        ${pageIdx === 0 ? buildDocMetaBox(metaItems || []) : ""}
        ${lead ? `<p class="web-doc-lead">${lead}</p>` : ""}
        ${(sections || []).map((section) => buildDocSection(section, title)).join("")}
        ${tableHtml || ""}
      </div>
      <div class="web-doc-page-footer"><span>- ${pageIdx + 1} / ${totalPages} -</span></div>
    </div>`;
                }

                // 비교 화면 HTML 원형의 문서 페이지 조회
                function getComparePrototypePages(selector) {
                    const prototype = document.getElementById("afterCompareViewPrototype");
                    const source = prototype?.tagName === "TEMPLATE" ? prototype.content : prototype;
                    return source?.querySelector(selector)?.innerHTML.trim() || "";
                }

                // 비교 참고자료 페이지 조회
                function buildCompareReferencePages() {
                    return getComparePrototypePages("#compareBaseBody .doc-pages-track");
                }

                // 비교 초안 페이지 조회
                function buildCompareDraftPages() {
                    return getComparePrototypePages("#compareDraftBody .doc-pages-track");
                }

                // 선택 참고자료 페이지 구성
                function buildSelectedReferencePages(recommendationId) {
                    const selected = recommendations.find((item) => item.id === Number(recommendationId) && item.category === "similar") || recommendations.find((item) => item.category === "similar") || recommendations[0];
                    if (!selected) return buildCompareReferencePages();
                    if (selected.id === 1) return buildCompareReferencePages();

                    const sections = selected.preview?.sections || [];
                    const splitAt = Math.max(1, Math.ceil(sections.length / 2));
                    const chunks = [sections.slice(0, splitAt), sections.slice(splitAt)].filter((chunk) => chunk.length);
                    const pages = chunks.map((chunk, index) => ({
                        org: selected.preview?.org || selected.meta || "유사답변서",
                        title: selected.preview?.title || selected.title,
                        continueTitle: index > 0 ? `${selected.preview?.title || selected.title} · (계속)` : undefined,
                        metaItems:
                            index === 0
                                ? [
                                      { label: "문서구분", value: `${selected.meta || "유사답변서"} / 유사도 ${selected.score || 0}%` },
                                      { label: "선택문서", value: selected.title },
                                      { label: "활용태그", value: (selected.tags || []).join(" · ") || "관련자료" },
                                      { label: "비교메모", value: selected.desc || "선택한 유사답변서와 초안 버전의 내용을 비교합니다." },
                                  ]
                                : [],
                        lead:
                            index === 0
                                ? `${selected.desc || "선택한 유사답변서입니다."} 답변서 비교 탭에서 선택한 초안 버전과 문단 구성, 근거 및 표현 차이를 함께 확인할 수 있습니다.`
                                : "선택한 유사답변서의 후속 문단입니다. 초안 버전과 비교하면서 추가 근거와 활용 가능한 표현을 검토할 수 있습니다.",
                        sections: chunk,
                    }));
                    return pages.map((page, index) => buildDocPage({ ...page, pageIdx: index, totalPages: pages.length })).join("");
                }

                // 선택 초안 버전 페이지 구성
                function buildSelectedDraftVersionPages(versionIndex) {
                    const index = Math.max(0, Math.min(Number(versionIndex) || 0, Math.max(0, draftVersions.length - 1)));
                    const version = draftVersions[index] || draftVersions[0];
                    if (!version) return buildCompareDraftPages();

                    const basePagesHolder = document.createElement("div");
                    basePagesHolder.innerHTML = buildCompareDraftPages();
                    const pages = Array.from(basePagesHolder.querySelectorAll(".draft-page"));
                    pages.forEach((page, pageIndex) => {
                        const org = page.querySelector(".web-doc-org");
                        if (org) org.textContent = pageIndex === 0 ? `재정경제부 · 답변서 초안 · ${formatDraftVersionTab(version)}` : `답변서 초안 · ${formatDraftVersionTab(version)} · (계속)`;
                        if (pageIndex === 0) {
                            const metaBox = page.querySelector(".web-doc-meta-box");
                            if (metaBox) {
                                const item = document.createElement("div");
                                item.className = "web-doc-meta-item";
                                item.innerHTML = `<span class="web-doc-meta-label">버전메모</span><span>${escapeHtml(version.note || "버전 메모 없음")}</span>`;
                                metaBox.prepend(item);
                            }
                        }
                    });
                    return basePagesHolder.innerHTML;
                }

                // 비교용 유사답변서 목록 조회
                function getCompareSimilarAnswers() {
                    return recommendations.filter((item) => item.category === "similar");
                }

                // 초안 버전 API ID 조회
                function getDraftVersionApiId(version, index) {
                    return version?.versionId || `DRAFT-V${String((Number(index) || 0) + 1).padStart(3, "0")}`;
                }

                // 유사답변서 답변 API ID 조회
                function getSimilarAnswerApiId(item) {
                    return item?.documentId || `SIM-${String(item?.id || 0).padStart(3, "0")}`;
                }

                // 비교 API 상태 설정
                function setCompareApiStatus(el, state, text) {
                    if (!el) return;
                    el.classList.remove("loading", "ready", "error");
                    if (state) el.classList.add(state);
                    el.textContent = text;
                }

                // 비교 분석 카드 구성
                function buildCompareAnalysisCards(result) {
                    const items = Array.isArray(result?.items) ? result.items : [];
                    if (!items.length)
                        return '<div class="analysis-card"><div class="analysis-card-head"><span class="analysis-title">분석 결과</span><span class="analysis-badge orange">확인 필요</span></div><p class="analysis-desc">선택한 문서의 차이점 분석 결과가 없습니다.</p></div>';
                    return items
                        .map(
                            (item) => `<div class="analysis-card">
      <div class="analysis-card-head"><span class="analysis-title">${escapeHtml(item.title || "차이점")}</span><span class="analysis-badge ${escapeHtml(item.tone || "orange")}">${escapeHtml(item.badge || "분석")}</span></div>
      <p class="analysis-desc">${escapeHtml(item.description || "")}</p>
    </div>`,
                        )
                        .join("");
                }

                // mock 답변 차이점 Result 동작 처리
                function mockAnswerDifferenceResult(selectedRef, selectedVersion) {
                    const versionLabel = selectedVersion?.label || "v1.0";
                    return {
                        comparisonId: `CMP-${selectedRef?.id || 0}-${selectedVersion?.id || 0}`,
                        items: [
                            { title: "답변 논리", badge: "일치", tone: "red", description: "유사답변서와 선택 초안이 핵심 정책 논리와 답변 흐름을 동일한 방향으로 구성하고 있습니다." },
                            { title: "수치 정보", badge: "확인 필요", tone: "orange", description: `${versionLabel}에 반영된 금리·예산 수치는 답변 시점 기준 최신 고시 여부를 추가 확인할 필요가 있습니다.` },
                            { title: "사례 반영", badge: "정확 반영", tone: "purple", description: "유사답변서의 주요 사례와 근거가 선택 초안에 반영되어 있으며 일부 표현은 최신 상황에 맞게 보완되었습니다." },
                            { title: "표현 톤", badge: "적정", tone: "green", description: "국회 답변 형식에 맞춰 문장과 근거가 정돈되어 있습니다." },
                        ],
                    };
                }

                // 초안 버전 API 조회
                async function loadDraftVersionByApi(versionIndex, purpose = "view") {
                    const index = Math.max(0, Math.min(Number(versionIndex) || 0, Math.max(0, draftVersions.length - 1)));
                    const version = draftVersions[index];
                    if (!version) return null;
                    const bridge = window.AIOneAgentBridge;
                    const payload = {
                        draftId: "DRAFT-001",
                        versionId: getDraftVersionApiId(version, index),
                        version: version.label,
                        purpose,
                    };
                    if (!bridge?.getDraftVersion) return { index, version };
                    return bridge.getDraftVersion(payload, () => ({ index, version: { ...version } }), 180);
                }

                // 유사답변서 API 조회
                async function loadSimilarAnswerByApi(referenceId, purpose = "compare") {
                    const similarAnswers = getCompareSimilarAnswers();
                    const selected = similarAnswers.find((item) => item.id === Number(referenceId)) || similarAnswers[0];
                    if (!selected) return null;
                    const bridge = window.AIOneAgentBridge;
                    const payload = { documentId: getSimilarAnswerApiId(selected), referenceId: selected.id, purpose };
                    if (!bridge?.getSimilarAnswer) return { item: selected };
                    return bridge.getSimilarAnswer(payload, () => ({ item: { ...selected } }), 180);
                }

                // 답변 차이점 API 분석
                async function analyzeAnswerDifferenceByApi(referenceId, versionIndex) {
                    const similarAnswers = getCompareSimilarAnswers();
                    const selectedRef = similarAnswers.find((item) => item.id === Number(referenceId)) || similarAnswers[0];
                    const selectedVersion = draftVersions[Math.max(0, Number(versionIndex) || 0)] || draftVersions[0];
                    if (!selectedRef || !selectedVersion) return { items: [] };
                    const bridge = window.AIOneAgentBridge;
                    const payload = {
                        comparisonType: "SIMILAR_ANSWER_VS_DRAFT_VERSION",
                        documentId: getSimilarAnswerApiId(selectedRef),
                        draftId: "DRAFT-001",
                        versionId: getDraftVersionApiId(selectedVersion, versionIndex),
                    };
                    // 목업 응답 데이터 생성
                    const mockFactory = () => mockAnswerDifferenceResult(selectedRef, selectedVersion);
                    if (!bridge?.analyzeAnswerDifference) return mockFactory();
                    return bridge.analyzeAnswerDifference(payload, mockFactory, 260);
                }

                // 초안 비교 Pair 요청
                async function requestDraftComparePair(leftIndex, rightIndex) {
                    const seq = ++draftCompareApiRequestSeq;
                    const status = $("#draftCompareApiStatus");
                    setCompareApiStatus(status, "loading", "AI 분석중");
                    const leftSelect = $("#draftCompareLeftSelect");
                    const rightSelect = $("#draftCompareRightSelect");
                    const leftEditor = $("#draftCompareLeftEditor");
                    const rightEditor = $("#draftCompareRightEditor");
                    if (leftEditor)
                        leftEditor.innerHTML = `<div class="compare-doc-loading" role="status" aria-live="polite"><div class="compare-doc-loading-spinner"></div><strong>기준 버전을 불러오고 있습니다.</strong><span>선택한 초안 내용을 준비하고 있습니다.</span></div>`;
                    if (rightEditor)
                        rightEditor.innerHTML = `<div class="compare-doc-loading" role="status" aria-live="polite"><div class="compare-doc-loading-spinner"></div><strong>비교 버전을 불러오고 있습니다.</strong><span>선택한 초안 내용을 준비하고 있습니다.</span></div>`;
                    if (leftSelect) leftSelect.disabled = true;
                    if (rightSelect) rightSelect.disabled = true;
                    try {
                        await Promise.all([loadDraftVersionByApi(leftIndex, "version-compare-base"), loadDraftVersionByApi(rightIndex, "version-compare-target")]);
                        if (seq !== draftCompareApiRequestSeq) return false;
                        draftCompareLeftVersion = leftIndex;
                        draftCompareRightVersion = rightIndex;
                        setCompareApiStatus(status, "ready", "AI 분석완료");
                        return true;
                    } catch (error) {
                        console.error("[AI-ONE] 초안 버전 조회 API 오류", error);
                        setCompareApiStatus(status, "error", "AI 분석오류");
                        showToast("초안 버전 조회 중 오류가 발생했습니다.");
                        return false;
                    } finally {
                        if (leftSelect) leftSelect.disabled = false;
                        if (rightSelect) rightSelect.disabled = false;
                    }
                }

                // 비교 선택기 초기화
                async function initCompareSelectors(scope = document) {
                    const refSelect = scope.querySelector("#compareReferenceSelect");
                    const draftSelect = scope.querySelector("#compareDraftVersionSelect");
                    const baseBody = scope.querySelector("#compareBaseBody");
                    const draftBody = scope.querySelector("#compareDraftBody");
                    const basePanel = scope.querySelector("#compareBasePanel");
                    const draftPanel = scope.querySelector("#compareDraftPanel");
                    const analysisBody = scope.querySelector("#compareAnalysisBody");
                    const analysisBadge = scope.querySelector("#compareAnalysisBadge");
                    const apiStatus = scope.querySelector("#compareApiStatus");
                    const swapButton = scope.querySelector("#compareDocumentSwap");
                    const compareGrid = scope.querySelector(".compare-three-col");
                    if (!refSelect || !draftSelect || !baseBody || !draftBody || !basePanel || !draftPanel) return;

                    // 비교 패널 Order 적용
                    const applyComparePanelOrder = () => {
                        if (!compareGrid) return;
                        const firstResize = compareGrid.querySelector('[data-cmp-resize="0"]');
                        if (!firstResize) return;
                        const firstPanel = comparePanelsSwapped ? draftPanel : basePanel;
                        const secondPanel = comparePanelsSwapped ? basePanel : draftPanel;
                        compareGrid.insertBefore(firstPanel, firstResize);
                        compareGrid.insertBefore(secondPanel, firstResize.nextSibling);
                        compareGrid.classList.toggle("compare-panels-swapped", comparePanelsSwapped);
                        if (swapButton) {
                            swapButton.classList.toggle("active", comparePanelsSwapped);
                            swapButton.setAttribute("aria-pressed", String(comparePanelsSwapped));
                        }
                    };

                    applyComparePanelOrder();
                    swapButton?.addEventListener("click", () => {
                        comparePanelsSwapped = !comparePanelsSwapped;
                        applyComparePanelOrder();
                        showToast(comparePanelsSwapped ? "초안 문서를 왼쪽으로 이동했습니다." : "유사답변서를 왼쪽으로 이동했습니다.");
                    });

                    const similarAnswers = getCompareSimilarAnswers();
                    const defaultReferenceId = Number(compareSelectedReferenceId || refSelect.dataset.selected || similarAnswers[0]?.id || 1);
                    const defaultDraftIndex = Math.max(0, Math.min(compareSelectedDraftVersionIndex, Math.max(0, draftVersions.length - 1)));

                    // 목록에는 메타정보만 노출합니다. 실제 문서 본문은 사용자가 선택한 항목만 조회 API로 가져옵니다.
                    refSelect.innerHTML = similarAnswers.map((item) => `<option value="${item.id}"${item.id === defaultReferenceId ? " selected" : ""}>${escapeHtml(item.title)} · ${item.score}%</option>`).join("");
                    draftSelect.innerHTML = draftVersions
                        .map((version, index) => `<option value="${index}"${index === defaultDraftIndex ? " selected" : ""}>${escapeHtml(formatDraftVersionTab(version))} · ${escapeHtml(version.note || "")}</option>`)
                        .join("");

                    // 선택된 비교 문서 렌더링
                    const renderSelection = async () => {
                        const seq = ++compareApiRequestSeq;
                        const refId = Number(refSelect.value || similarAnswers[0]?.id || 1);
                        const versionIndex = Number(draftSelect.value || 0);
                        const selectedRef = similarAnswers.find((item) => item.id === refId) || similarAnswers[0];
                        const selectedVersion = draftVersions[versionIndex] || draftVersions[0];
                        compareSelectedReferenceId = refId;
                        compareSelectedDraftVersionIndex = versionIndex;

                        refSelect.disabled = true;
                        draftSelect.disabled = true;
                        setCompareApiStatus(apiStatus, "loading", "AI 분석중");
                        if (analysisBadge) analysisBadge.textContent = "AI 분석중";
                        baseBody.innerHTML = `<div class="compare-doc-loading" role="status" aria-live="polite"><div class="compare-doc-loading-spinner"></div><strong>유사답변서를 불러오고 있습니다.</strong><span>선택한 문서 내용을 준비하고 있습니다.</span></div>`;
                        draftBody.innerHTML = `<div class="compare-doc-loading" role="status" aria-live="polite"><div class="compare-doc-loading-spinner"></div><strong>초안 버전을 불러오고 있습니다.</strong><span>선택한 초안 내용을 준비하고 있습니다.</span></div>`;
                        if (analysisBody)
                            analysisBody.innerHTML = `<div class="compare-analysis-loading">
        <div class="skeleton-loading-label">선택 문서 차이점을 분석하고 있습니다.</div>
        <div class="skeleton-card"><div class="ai-skeleton skeleton-line md"></div><div class="ai-skeleton skeleton-line full"></div><div class="ai-skeleton skeleton-line lg"></div></div>
        <div class="skeleton-card"><div class="ai-skeleton skeleton-line sm"></div><div class="ai-skeleton skeleton-line full"></div><div class="ai-skeleton skeleton-line md"></div></div>
      </div>`;

                        try {
                            // 채팅 프롬프트를 만들지 않고 화면 선택 이벤트에서 기능별 API를 직접 호출합니다.
                            const [refResult, draftResult, analysisResult] = await Promise.all([
                                loadSimilarAnswerByApi(refId, "answer-compare"),
                                loadDraftVersionByApi(versionIndex, "answer-compare"),
                                analyzeAnswerDifferenceByApi(refId, versionIndex),
                            ]);
                            if (seq !== compareApiRequestSeq) return;

                            const resolvedRef = refResult?.item || selectedRef;
                            const resolvedVersion = draftResult?.version || selectedVersion;
                            baseBody.innerHTML = `<div class="doc-pages-track">${buildSelectedReferencePages(resolvedRef?.id || refId)}</div>`;
                            draftBody.innerHTML = `<div class="doc-pages-track">${buildSelectedDraftVersionPages(draftResult?.index ?? versionIndex)}</div>`;
                            if (analysisBody) analysisBody.innerHTML = buildCompareAnalysisCards(analysisResult);
                            if (analysisBadge) analysisBadge.textContent = "AI 분석완료";

                            const baseTitle = scope.querySelector("#compareBaseTitle");
                            const baseBadge = scope.querySelector("#compareBaseBadge");
                            const draftTitle = scope.querySelector("#compareDraftTitle");
                            const draftBadge = scope.querySelector("#compareDraftBadge");
                            const note = scope.querySelector("#compareSelectionNote");
                            const statBase = scope.querySelector("#compareStatBase");
                            const statDraft = scope.querySelector("#compareStatDraft");
                            const statMatch = scope.querySelector("#compareStatMatch");
                            const statReview = scope.querySelector("#compareStatReview");

                            if (baseTitle) baseTitle.textContent = resolvedRef?.title || "유사답변서";
                            if (baseBadge) baseBadge.textContent = `${resolvedRef?.meta?.split(" · ")[0] || "유사답변서"} · ${resolvedRef?.score || 0}%`;
                            if (draftTitle) draftTitle.textContent = resolvedVersion ? `답변서 초안 ${formatDraftVersionTab(resolvedVersion)}` : "답변서 초안";
                            if (draftBadge) draftBadge.textContent = resolvedVersion?.note || "선택 초안 버전";
                            if (note)
                                note.innerHTML = `<strong>현재 비교:</strong> ${escapeHtml(resolvedRef?.title || "유사답변서")} ↔ ${escapeHtml(formatDraftVersionTab(resolvedVersion))} <span class="compare-draft-version-note">${escapeHtml(resolvedVersion?.note || "")}</span>`;
                            if (statBase) statBase.textContent = `${resolvedRef?.score || 0}% 유사`;
                            if (statDraft) statDraft.textContent = resolvedVersion?.label || "초안";
                            if (statMatch) statMatch.textContent = `${Math.max(2, Math.min(6, Math.round((resolvedRef?.score || 80) / 20)))}개`;
                            if (statReview) statReview.textContent = versionIndex >= Math.max(0, draftVersions.length - 2) ? "1건" : "2건";

                            basePanel._docViewerState = null;
                            draftPanel._docViewerState = null;
                            basePanel.dataset.zoom = "100";
                            draftPanel.dataset.zoom = "100";
                            initDocViewerPanel(basePanel);
                            initDocViewerPanel(draftPanel);
                            basePanel.dispatchEvent(new CustomEvent("ai-one-doc-viewer-change", { bubbles: true }));
                            draftPanel.dispatchEvent(new CustomEvent("ai-one-doc-viewer-change", { bubbles: true }));
                            setCompareApiStatus(apiStatus, "ready", "AI 분석완료");
                        } catch (error) {
                            if (seq !== compareApiRequestSeq) return;
                            console.error("[AI-ONE] 답변서 비교 API 오류", error);
                            setCompareApiStatus(apiStatus, "error", "AI 분석오류");
                            if (analysisBadge) analysisBadge.textContent = "AI 분석오류";
                            if (analysisBody)
                                analysisBody.innerHTML =
                                    '<div class="analysis-card"><div class="analysis-card-head"><span class="analysis-title">비교 실패</span><span class="analysis-badge orange">재시도</span></div><p class="analysis-desc">조회 또는 차이점 분석 API 호출 중 오류가 발생했습니다.</p></div>';
                            showToast("답변서 비교 데이터를 불러오지 못했습니다.");
                        } finally {
                            if (seq === compareApiRequestSeq) {
                                refSelect.disabled = false;
                                draftSelect.disabled = false;
                            }
                        }
                    };

                    refSelect.addEventListener("change", renderSelection);
                    draftSelect.addEventListener("change", renderSelection);
                    renderSelection();
                }

                // 문서 뷰어 패널 초기화
                function initDocViewerPanel(panel) {
                    if (!panel) return;
                    const body = panel.querySelector(".doc-viewer-body");
                    if (!body) return;

                    const state = panel._docViewerState || {
                        zoom: Number(panel.dataset.zoom || 100),
                        boundBody: null,
                        scrollHandler: null,
                    };

                    state.body = body;
                    state.track = body.querySelector(".doc-pages-track") || body.firstElementChild || body;
                    state.pages = Array.from(body.querySelectorAll(".draft-page"));
                    state.statusBar = panel.querySelector("[data-document-statusbar]");
                    state.pageNumEl = panel.querySelector("[data-document-page-current]");
                    state.pageTotalEl = panel.querySelector("[data-document-page-total]");
                    state.charCountEl = panel.querySelector("[data-document-character-count]");
                    state.zoomValEl = panel.querySelector("[data-document-statusbar-zoom-value]");
                    state.zoomInBtn = panel.querySelector('[data-document-statusbar-action="zoom-in"]');
                    state.zoomOutBtn = panel.querySelector('[data-document-statusbar-action="zoom-out"]');
                    state.fullscreenBtn = panel.querySelector('[data-document-statusbar-action="fullscreen"]');

                    state.updatePageInfo = () => {
                        if (state.pageTotalEl) state.pageTotalEl.textContent = String(state.pages.length || 1);
                        if (state.charCountEl) {
                            const charCount = String(state.track?.innerText || state.body?.innerText || "").replace(/\s/g, "").length;
                            state.charCount = charCount;
                            state.charCountEl.textContent = charCount.toLocaleString();
                        }
                        const current = window.AIOneDocumentStatusBar?.getCurrentPage(state.pages, state.body) || 1;
                        state.currentPage = current;
                        state.totalPages = state.pages.length || 1;
                        panel.dataset.currentPage = String(state.currentPage);
                        panel.dataset.pageTotal = String(state.totalPages);
                        if (state.pageNumEl) state.pageNumEl.textContent = String(current);
                        panel.dispatchEvent(
                            new CustomEvent("ai-one-doc-viewer-change", {
                                bubbles: true,
                                detail: { page: state.currentPage, total: state.totalPages, zoom: state.zoom },
                            }),
                        );
                    };

                    state.applyZoom = () => {
                        state.zoom = Math.max(50, Math.min(200, state.zoom));
                        panel.dataset.zoom = String(state.zoom);
                        if (state.statusBar && window.AIOneDocumentStatusBar) {
                            state.statusBar.dataset.documentZoom = String(state.zoom);
                            window.AIOneDocumentStatusBar.setZoom(state.statusBar, state.zoom);
                        } else if (state.track) {
                            const zoomScale = state.zoom / 100;
                            state.track.style.transform = "none";
                            state.track.style.width = "100%";
                            state.track.style.zoom = String(zoomScale);
                            state.track.style.maxWidth = "none";
                        }
                        if (state.zoomValEl) state.zoomValEl.textContent = `${state.zoom}%`;
                        if (state.zoomOutBtn) state.zoomOutBtn.disabled = state.zoom <= 50;
                        if (state.zoomInBtn) state.zoomInBtn.disabled = state.zoom >= 200;
                        requestAnimationFrame(() => state.updatePageInfo());
                    };

                    if (state.boundBody !== body) {
                        if (state.boundBody && state.scrollHandler) {
                            state.boundBody.removeEventListener("scroll", state.scrollHandler);
                        }
                        state.scrollHandler = () => panel._docViewerState?.updatePageInfo();
                        body.addEventListener("scroll", state.scrollHandler);
                        state.boundBody = body;
                    }

                    panel._docViewerState = state;

                    if (!panel.dataset.viewerBound) {
                        if (state.statusBar && window.AIOneDocumentStatusBar) {
                            state.statusBar.addEventListener("document-statusbar:zoomchange", (event) => {
                                const currentState = panel._docViewerState;
                                if (!currentState) return;
                                currentState.zoom = event.detail?.zoom || 100;
                                panel.dataset.zoom = String(currentState.zoom);
                                currentState.updatePageInfo();
                            });
                            state.statusBar.addEventListener("document-statusbar:fullscreenchange", (event) => {
                                showToast(event.detail?.fullscreen ? "전체보기 모드입니다. ESC 키를 누르면 종료됩니다." : "전체보기를 종료했습니다.");
                            });
                            window.AIOneDocumentStatusBar.init(state.statusBar);
                        }
                        panel.dataset.viewerBound = "true";
                    }

                    state.applyZoom();
                    state.updatePageInfo();
                }

                // 전체 문서 뷰어 초기화
                function initAllDocViewers(scope = document) {
                    scope.querySelectorAll(".doc-viewer-panel").forEach((panel) => initDocViewerPanel(panel));
                }

                // 문서 상태 바 구성
                function buildDocumentStatusBar({ id = "", target, scrollTarget, pageSelector = "", fullscreenTarget, stats }) {
                    return `<div class="document-statusbar-area">
      <footer${id ? ` id="${id}"` : ""} class="document-statusbar" data-component="document-statusbar" data-document-statusbar
        data-document-target="${target}" data-document-scroll-target="${scrollTarget}"
        ${pageSelector ? `data-document-page-selector="${pageSelector}"` : ""}
        data-document-fullscreen-target="${fullscreenTarget}"
        data-document-zoom="100" data-document-min-zoom="50"
        data-document-max-zoom="200" data-document-zoom-step="10">
        <div class="document-statusbar-stats" data-slot="stats">${stats}</div>
        <div class="document-statusbar-controls" aria-label="문서 확대 축소 및 전체보기">
          <button type="button" class="icon-button icon-button-sm document-statusbar-button"
            data-document-statusbar-action="zoom-out" aria-label="문서 축소" title="문서 축소">−</button>
          <strong class="document-statusbar-zoom" data-document-statusbar-zoom-value>100%</strong>
          <button type="button" class="icon-button icon-button-sm document-statusbar-button"
            data-document-statusbar-action="zoom-in" aria-label="문서 확대" title="문서 확대">＋</button>
          <button type="button" class="icon-button icon-button-sm document-statusbar-button document-statusbar-fullscreen-button"
            data-document-statusbar-action="fullscreen" aria-label="문서 전체보기" title="문서 전체보기"
            aria-pressed="false">
            <img class="icon icon-small document-statusbar-expand-icon"
              src="../assets/icons/fullscreen-expand.svg" alt="" aria-hidden="true" />
            <img class="icon icon-small document-statusbar-shrink-icon"
              src="../assets/icons/fullscreen-shrink.svg" alt="" aria-hidden="true" />
          </button>
        </div>
      </footer>
    </div>`;
                }

                // 답변서 비교 스크롤 동기화 모드 반영
                function syncAnswerCompareScrollMode(scope = document) {
                    const syncCheck = scope.querySelector("#compareScrollSync");
                    if (!syncCheck) return;

                    const isResponsive = isResponsiveAnswerMode();
                    if (syncCheck.dataset.desktopChecked === undefined) {
                        syncCheck.dataset.desktopChecked = String(syncCheck.checked);
                    }

                    if (isResponsive) {
                        if (!syncCheck.disabled) syncCheck.dataset.desktopChecked = String(syncCheck.checked);
                        syncCheck.checked = false;
                        syncCheck.disabled = true;
                        scope.querySelectorAll("#compareBaseBody, #compareDraftBody").forEach((body) => {
                            body.scrollTop = 0;
                        });
                        return;
                    }

                    syncCheck.disabled = false;
                    syncCheck.checked = syncCheck.dataset.desktopChecked !== "false";
                }

                // 비교 상태 바 초기화
                function initCompareStatusBar(scope = document) {
                    const statusBarArea = scope.querySelector("#compareStatusBar");
                    const statusBar = statusBarArea?.querySelector("[data-document-statusbar]");
                    const basePanel = scope.querySelector("#compareBasePanel");
                    const draftPanel = scope.querySelector("#compareDraftPanel");
                    if (!statusBar || !basePanel || !draftPanel) return;

                    const panels = { base: basePanel, draft: draftPanel };
                    let activeTarget = "base";

                    const pageNum = statusBar.querySelector("[data-document-page-current]");
                    const pageTotal = statusBar.querySelector("[data-document-page-total]");
                    const zoomValue = statusBar.querySelector("[data-document-statusbar-zoom-value]");
                    const charCount = statusBar.querySelector("[data-document-character-count]");
                    const activeLabel = statusBar.querySelector("#compareActiveViewerLabel");
                    const zoomOut = statusBar.querySelector('[data-document-statusbar-action="zoom-out"]');
                    const zoomIn = statusBar.querySelector('[data-document-statusbar-action="zoom-in"]');
                    const syncCheck = scope.querySelector("#compareScrollSync");

                    // 상태 조회
                    const getState = () => panels[activeTarget]?._docViewerState || null;
                    // 화면 상태 갱신
                    const refresh = () => {
                        const panel = panels[activeTarget];
                        const state = getState();
                        if (!panel || !state) return;
                        if (pageNum) pageNum.textContent = String(state.currentPage || Number(panel.dataset.currentPage) || 1);
                        if (pageTotal) pageTotal.textContent = String(state.totalPages || Number(panel.dataset.pageTotal) || state.pages?.length || 1);
                        const activeZoom = state.zoom || Number(panel.dataset.zoom) || 100;
                        statusBar.dataset.documentZoom = String(activeZoom);
                        if (zoomValue) zoomValue.textContent = `${activeZoom}%`;
                        if (charCount) {
                            const count = String(state.track?.innerText || state.body?.innerText || "").replace(/\s/g, "").length;
                            charCount.textContent = count.toLocaleString();
                        }
                        if (activeLabel) activeLabel.textContent = activeTarget === "base" ? "기준 문서" : "비교 문서";
                        if (zoomOut) zoomOut.disabled = activeZoom <= 50;
                        if (zoomIn) zoomIn.disabled = activeZoom >= 200;
                        Object.entries(panels).forEach(([key, comparePanel]) => {
                            const selected = key === activeTarget;
                            comparePanel.classList.toggle("active", selected);
                            comparePanel.classList.toggle("compare-viewer-active", selected);
                            comparePanel.setAttribute("aria-selected", String(selected));
                        });
                    };

                    // Active 확대/축소 동기화
                    const syncActiveZoom = () => {
                        const state = getState();
                        if (!state) return;
                        window.AIOneDocumentStatusBar?.setZoom(statusBar, state.zoom || 100);
                    };

                    statusBar.addEventListener("document-statusbar:zoomchange", (event) => {
                        const panel = event.detail?.target?.closest?.(".cmp-col[data-compare-viewer]");
                        const state = panel?._docViewerState;
                        if (!panel || !state) return;
                        state.zoom = event.detail.zoom;
                        panel.dataset.zoom = String(event.detail.zoom);
                        state.updatePageInfo();
                        refresh();
                    });

                    let syncingCompareScroll = false;
                    // 비교 스크롤 동기화
                    const syncCompareScroll = (sourceState, targetState) => {
                        if (isResponsiveAnswerMode() || syncingCompareScroll || !syncCheck?.checked || !sourceState?.body || !targetState?.body) return;
                        const sourceMax = Math.max(1, sourceState.body.scrollHeight - sourceState.body.clientHeight);
                        const targetMax = Math.max(0, targetState.body.scrollHeight - targetState.body.clientHeight);
                        syncingCompareScroll = true;
                        targetState.body.scrollTop = (sourceState.body.scrollTop / sourceMax) * targetMax;
                        requestAnimationFrame(() => {
                            syncingCompareScroll = false;
                        });
                    };
                    const baseState = panels.base?._docViewerState;
                    const draftState = panels.draft?._docViewerState;
                    if (baseState?.body && !baseState.body.dataset.answerCompareSyncBound) {
                        baseState.body.dataset.answerCompareSyncBound = "true";
                        baseState.body.addEventListener("scroll", () => syncCompareScroll(panels.base?._docViewerState, panels.draft?._docViewerState), { passive: true });
                    }
                    if (draftState?.body && !draftState.body.dataset.answerCompareSyncBound) {
                        draftState.body.dataset.answerCompareSyncBound = "true";
                        draftState.body.addEventListener("scroll", () => syncCompareScroll(panels.draft?._docViewerState, panels.base?._docViewerState), { passive: true });
                    }
                    if (syncCheck && !syncCheck.dataset.responsiveSyncBound) {
                        syncCheck.dataset.responsiveSyncBound = "true";
                        syncCheck.addEventListener("change", () => {
                            if (!isResponsiveAnswerMode()) syncCheck.dataset.desktopChecked = String(syncCheck.checked);
                        });
                    }
                    syncAnswerCompareScrollMode(scope);

                    Object.values(panels).forEach((panel) => {
                        panel.tabIndex = 0;
                        panel.setAttribute("role", "region");
                        panel.addEventListener("ai-one-doc-viewer-change", refresh);
                        // 패널 선택
                        const selectPanel = () => {
                            activeTarget = panel.dataset.compareViewer === "draft" ? "draft" : "base";
                            refresh();
                            syncActiveZoom();
                        };
                        panel.addEventListener("pointerdown", selectPanel);
                        panel.addEventListener("focus", selectPanel);
                        panel.addEventListener("keydown", (event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            selectPanel();
                        });
                    });

                    window.AIOneDocumentStatusBar?.init(statusBar);
                    refresh();
                    syncActiveZoom();
                }

                let selectedRecIds = [1, 2, 3]; // 기본 예시 화면: 상위 관련자료 3건 선택
                let smartImportedSourceIds = [];
                let smartImportedSelectedIds = [];
                const smartImportedStatus = new Map();
                const smartImportedOrder = new Map();
                let smartUnifiedSourceOrderSeq = 0;
                let smartSearchRunSeq = 0;
                let smartSearchTimer = null;
                let smartGroupMode = false;
                let smartImportedSortOrder = "oldest";
                let smartLastResults = [];
                let smartInlineResultsExpanded = false;
                let smartTemporaryLayoutSnapshot = null;
                let smartTemporaryLayoutActive = false;
                let smartSearchSelectedIds = [];
                const smartExpandedTopics = new Set();
                let moreRecSeq = 0; // 채팅으로 추가된 관련자료 순번
                let workspaceRunSeq = 0;

                // ??: getStaticDraftContent ??.
                function getStaticDraftContent() {
                    return document.querySelector("#afterDraftContentPrototype")?.innerHTML.trim() || "";
                }

                const draftContent = getStaticDraftContent();

                const chatTopics = [
                    { title: "지방채 인수 추경 답변서 초안 작성", time: "11:05", date: "2026.07.20", id: 0 },
                    { title: "공자기금 인수금리 조건 정리", time: "10:22", date: "2026.07.20", id: 1 },
                    { title: "광주·전남 통합특별시 추경 수요", time: "16:40", date: "2026.07.19", id: 2 },
                    { title: "세수결손 대응계획 답변서 검토", time: "15:12", date: "2026.07.18", id: 3 },
                    { title: "국가채무비율 전망 근거자료 정리", time: "09:35", date: "2026.07.18", id: 4 },
                    { title: "공공기관 경영평가 개선 질의", time: "14:08", date: "2026.07.17", id: 5 },
                    { title: "종합부동산세 세율 조정 영향", time: "11:26", date: "2026.07.16", id: 6 },
                    { title: "간이과세 기준금액 상향 검토", time: "17:42", date: "2026.07.15", id: 7 },
                    { title: "외국환거래법 개정 답변자료", time: "13:18", date: "2026.07.14", id: 8 },
                    { title: "청년 일자리 재정사업 성과", time: "10:04", date: "2026.07.11", id: 9 },
                    { title: "물가안정 정책 공조 현황", time: "16:55", date: "2026.07.10", id: 10 },
                    { title: "재정준칙 도입 필요성 검토", time: "09:48", date: "2026.07.09", id: 11 },
                ];

                // 새 채팅 시작 시 노출되는 안내 문구 (첫번째 문단)
                const AI_CHAT_INTRO =
                    "국회 질의를 입력해 보세요!\nAI가 지능형 검색을 통해 관련자료를 추천하고 국회 답변서 초안 생성을 시작합니다.\n① 좌측 AI 참조소스에서 지능형 AI 검색으로 관련자료를 찾아 추가하고\n② 이 채팅에 국회질의를 입력하시면\n선택한 자료와 과거 유사답변서를 기반으로 초안을 생성합니다.";

                const chatConversations = [
                    // 주제 0: 지방채 인수 추경 답변서 초안 작성
                    [
                        { role: "ai", text: AI_CHAT_INTRO, time: "11:41" },
                        { role: "user", text: "지방교부세가 지급되고 있고 지방채 인수시 지자체 채무는 증가함에도 추경을 편성해야 하는 이유는?", time: "11:42" },
                        { role: "ai", text: '유사 과거답변서 5건을 문서 단위로 추천했습니다. (최고 유사도 38%)\n좌측 "유사답변서 추천 목록"에서 확인·선택할 수 있습니다.', time: "11:42" },
                        { role: "ai", text: '답변서 초안을 생성했습니다. 과거답변 5건, 첨부 7건을 청크 단위로 반영했습니다.\n"답변서 초안 분석" 탭에서 편집하거나, 채팅으로 수정 지시를 내릴 수 있습니다.', time: "11:42" },
                        {
                            role: "ai",
                            text: "답변서 초안 작성을 시작합니다. 지방채 인수 및 추경 관련 참조자료 7건을 분석 완료했습니다.\n\n📌 분석 결과 요약:\n• 최고 유사도: 95% (지방채 인수 추경 편성 사유 답변)\n• 인용 가능 문단: 5개\n• 수치 업데이트 필요: 1건 (금리 최신 고시)",
                            time: "10:45",
                        },
                        { role: "user", text: "공자기금 지방채 인수 제도 개요와 추경 편성 배경을 중심으로 답변서 초안을 작성해줘.", time: "10:50" },
                        {
                            role: "ai",
                            text: '참조자료를 기반으로 초안을 작성했습니다.\n\n✅ 반영 내용:\n• 답변 요약: "특정 자본적 지출 사업 수행을 위해 공자기금이 지방채를 장기 저리로 인수"\n• 제도 개요 표: 지원대상/사업/조건/절차\n• 인수금리: 공자기금 예탁금리와 동일(분기별 고정), \'26.2분기 3.435%\n• 인수기간: 5년 거치 10년 분할 상환\n\n⚠️ 확인 필요:\n• 금리는 분기별 변동이므로 답변 시점 기준 최신 고시 확인 필요',
                            time: "10:55",
                        },
                        { role: "user", text: "광주·전남 통합특별시 관련 추경 사례도 추가해줘. 지자체별 수요도 포함해서.", time: "11:00" },
                        {
                            role: "ai",
                            text: "추경 편성 사례를 추가했습니다.\n\n추가 내용:\n• 광주·전남 통합특별시 출범(2026.7.1. 예정)\n• 지방채 인수 수요: 약 1,000억 원 규모\n• 전남: 안내표지판 설치, 통합전산망 구축(300억) 등 총 700억 원\n• 광주: 재난관리기금, 재해구호기금 조성 등 총 195억 원\n\n예산 현황표도 반영 완료:\n• '25년 예산 12,100억 / 결산 10,712억\n• '26년 본예산 1,000억 → 추경안 2,000억 (증감 +1,000, 100%)",
                            time: "11:03",
                        },
                    ],
                    // 주제 1: 공자기금 인수금리 조건 정리
                    [
                        { role: "ai", text: "공자기금 지방채 인수 금리 조건을 정리합니다. 어떤 기준이 필요하신가요?", time: "10:10" },
                        { role: "user", text: "최근 분기별 금리 변동 추이를 정리해줘.", time: "10:15" },
                        {
                            role: "ai",
                            text: "공자기금 지방채 인수금리 추이입니다.\n\n산정 기준: 전분기 공자기금 총괄계정 평균 조달금리 + 기금운용경비(0.1%p)\n\n| 분기 | 금리(%) |\n|------|--------|\n| '25.1분기 | 2.975 |\n| '25.2분기 | 2.794 |\n| '25.3분기 | 2.683 |\n| '25.4분기 | 2.713 |\n| '26.1분기 | 2.957 |\n| '26.2분기 | 3.435 |\n\n인수기간: 5년 거치 10년 분할 상환\n출처: 공공자금관리기금 운용계획",
                            time: "10:20",
                        },
                    ],
                    // 주제 2: 광주·전남 통합특별시 추경 수요
                    [
                        { role: "ai", text: "광주·전남 통합특별시 관련 추경 수요를 정리합니다.", time: "어제" },
                        { role: "user", text: "출범 일정이랑 지자체별 세부 수요 정리해줘.", time: "어제" },
                        {
                            role: "ai",
                            text: "광주·전남 통합 관련 추경 수요입니다.\n\n📋 출범 계획:\n• 전남광주통합특별시 설치를 위한 특별법 통과\n• '26.3.5. 시행 → '26.7.1. 출범 예정\n\n💰 추경 규모: 약 1,000억 원\n\n📊 지자체별 세부 수요:\n• 전남(700억 원): 통합특별시 안내표지판 설치, 통합전산망 구축(300억 원) 등\n• 광주(195억 원): 재난관리기금 및 재해구호기금 조성 등\n\n* '26년 본예산 규모(1,000억 원)를 감안하여 산출\n\n답변서에 추경 편성의 구체적 사례로 인용하기에 적합합니다.",
                            time: "어제",
                        },
                    ],
                ];

                while (chatConversations.length < chatTopics.length) {
                    const topic = chatTopics[chatConversations.length];
                    chatConversations.push([
                        { role: "ai", text: AI_CHAT_INTRO, time: topic.time },
                        { role: "user", text: `${topic.title} 관련 핵심 쟁점과 근거자료를 정리해줘.`, time: topic.time },
                        { role: "ai", text: `${topic.title} 관련 과거 답변서와 참고자료를 검색해 초안 작성에 활용할 수 있도록 정리했습니다.`, time: topic.time },
                    ]);
                }

                let activeChatTopic = 0;

                /* ============================ 끝: 화면 데이터 ============================== */

                /* ============================ 시작: 화면 상태 ============================ */
                let currentTab = "recommend";
                let compareAutoCollapsedLeftPanel = false;
                let selectedRec = 0;
                let currentFilter = "all";
                let currentSourceGroup = "all";
                let isReset = false;
                let hasChatRecommendationResults = true;
                const reportFiles = [];
                let recommendationViewElement = null;
                let draftEmptyElement = null;

                /* ============================ 끝: 화면 상태 ============================== */

                /* ============================ 시작: 답변서 버전 ============================ */
                // 초안 버전 탭 변환
                function formatDraftVersionTab(version) {
                    if (!version) return "v1.0(00:00)";
                    return `${version.label}(${version.time})`;
                }

                const draftVersionExamples = [
                    { id: 1, label: "v1.0", time: "09:18", note: "AI 최초 초안 생성", content: draftContent },
                    { id: 2, label: "v1.1", time: "09:32", note: "질의요지 문장 정리", content: draftContent },
                    { id: 3, label: "v1.2", time: "09:47", note: "법적 근거 보강", content: draftContent },
                    { id: 4, label: "v1.3", time: "10:05", note: "관련 수치 및 사례 추가", content: draftContent },
                    { id: 5, label: "v1.4", time: "10:21", note: "답변 문체 간결화", content: draftContent },
                    { id: 6, label: "v1.5", time: "10:43", note: "출처 검증 결과 반영", content: draftContent },
                    { id: 7, label: "v1.6", time: "11:02", note: "결론 문단 재구성", content: draftContent },
                    { id: 8, label: "v1.7", time: "11:24", note: "최종 검토 의견 반영", content: draftContent },
                ];

                let draftVersions = draftVersionExamples.map((version) => ({ ...version }));
                let activeDraftVersion = 0;
                let draftDisplayMode = "single";
                let draftCompareLeftVersion = 0;
                let draftCompareRightVersion = 1;
                let compareSelectedReferenceId = 1;
                let compareSelectedDraftVersionIndex = 0;
                let comparePanelsSwapped = false;
                let compareApiRequestSeq = 0;
                let draftCompareApiRequestSeq = 0;

                /* ============================ 끝: 답변서 버전 ============================== */

                /* ============================ 시작: 화면 렌더링 ============================ */
                // 화면 초기화
                function init() {
                    // 파일을 다시 열었을 때 기본 예시 데이터가 항상 표시되도록 초기 상태를 복원합니다.
                    isReset = false;
                    hasChatRecommendationResults = true;
                    activeChatTopic = 0;
                    currentTab = "recommend";
                    currentSourceGroup = "all";
                    currentFilter = "all";
                    selectedRecIds = recommendations.slice(0, Math.min(3, recommendations.length)).map((item) => item.id);
                    draftVersions = draftVersionExamples.map((version) => ({ ...version }));
                    activeDraftVersion = 0;
                    draftDisplayMode = "single";
                    draftCompareLeftVersion = 0;
                    draftCompareRightVersion = Math.min(1, Math.max(0, draftVersions.length - 1));
                    compareSelectedReferenceId = 1;
                    compareSelectedDraftVersionIndex = 0;
                    comparePanelsSwapped = false;
                    draftEmptyElement = $("#answerAfterDraftEmptyState");

                    keepSmartSourceDropzoneVisible();
                    bindStaticRecommendationCards();
                    bindSelectedReferenceRemoveActions();
                    bindAfter9ChatMessageActions($("#chatMessages"));
                    bindEvents();
                    bindFilterChips();
                    bindApplyToChat();
                    initPanelResize();
                    initPanelDragDrop();
                    initCenterSplitResize();
                    if (!window.__aiOneDocViewerEscBound) {
                        window.__aiOneDocViewerEscBound = true;
                        document.addEventListener("keydown", (e) => {
                            if (e.key === "Escape") {
                                document.querySelectorAll(".doc-viewer-panel.doc-viewer-fullscreen").forEach((panel) => panel.classList.remove("doc-viewer-fullscreen"));
                                document.querySelectorAll(".compare-view.compare-view-fullscreen").forEach((view) => view.classList.remove("compare-view-fullscreen"));
                            }
                        });
                    }
                }

                // 참고자료 파일 유형 조회
                function getReferenceFileType(fileName, fallbackType = "file") {
                    const ext = String(fileName || "")
                        .split(".")
                        .pop()
                        .toLowerCase();
                    if (ext === "pdf") return "pdf";
                    if (["hwp", "hwpx"].includes(ext)) return "hwp";
                    if (["doc", "docx"].includes(ext)) return "docx";
                    if (["xls", "xlsx", "csv"].includes(ext)) return "xlsx";
                    if (["ppt", "pptx"].includes(ext)) return "pptx";
                    if (["png", "jpg", "jpeg", "gif", "bmp", "webp", "tif", "tiff"].includes(ext)) return "img";
                    if (["txt", "md", "rtf"].includes(ext)) return "txt";
                    return fallbackType || "file";
                }

                // 참고자료 파일 확장자 조회
                function getReferenceFileExtension(fileName, type) {
                    const ext = String(fileName || "")
                        .split(".")
                        .pop()
                        .toUpperCase();
                    if (ext && ext.length <= 4) return ext;
                    const labels = { pdf: "PDF", hwp: "HWP", docx: "DOC", xlsx: "XLS", pptx: "PPT", img: "IMG", txt: "TXT" };
                    return labels[type] || "FILE";
                }

                // 참고자료 파일 아이콘 렌더링
                function renderReferenceFileIcon(file) {
                    const type = getReferenceFileType(file?.name, file?.type);
                    const ext = getReferenceFileExtension(file?.name, type);
                    const processingClass = file?.status && ["waiting", "parsing", "summarizing", "chunking"].includes(file.status) ? " processing" : "";
                    return `<span class="file-type-dot ${type}${processingClass}" aria-hidden="true"></span>
      <span class="file-icon file-icon-collapsed ${type}${processingClass}" aria-hidden="true">${escapeHtml(ext)}</span>`;
                }

                // 파일 렌더링
                function renderFiles() {
                    keepSmartSourceDropzoneVisible();
                    const list = $("#fileList");
                    const items = files
                        .map((f, i) => {
                            const isSelected = f.selected !== false;
                            const item = cloneAfterPrototype("afterSourceFileItemPrototype");
                            if (!item) return null;
                            const type = getReferenceFileType(f.name, f.type);
                            const extension = getReferenceFileExtension(f.name, type);
                            const processing = ["waiting", "parsing", "summarizing", "chunking"].includes(f.status);
                            item.classList.toggle("source-unchecked", f.status === "done" && !isSelected);
                            item.classList.toggle("is-failed", f.status === "failed");
                            item.dataset.fileIdx = String(i);
                            const dot = item.querySelector(".file-type-dot");
                            const icon = item.querySelector(".file-icon-collapsed");
                            dot.classList.add(type);
                            icon.classList.add(type);
                            dot.classList.toggle("processing", processing);
                            icon.classList.toggle("processing", processing);
                            icon.textContent = extension;
                            const name = item.querySelector(".file-name-simple");
                            name.textContent = f.name;
                            name.title = f.name;
                            const remove = item.querySelector(".file-remove-simple");
                            remove.dataset.idx = String(i);
                            remove.setAttribute("aria-label", `${f.name} 삭제`);

                            const statusKey = ["parsing", "summarizing", "chunking", "failed", "done"].includes(f.status) ? f.status : "waiting";
                            item.querySelectorAll("[data-file-state]").forEach((state) => {
                                state.hidden = state.dataset.fileState !== statusKey;
                            });
                            item.querySelector("[data-file-size]").textContent = f.size;
                            const retry = item.querySelector("[data-file-retry]");
                            retry.dataset.fileRetry = String(i);
                            retry.setAttribute("aria-label", `${f.name} 청킹 재시도`);
                            const check = item.querySelector(".file-source-check");
                            check.dataset.fileCheck = String(i);
                            check.checked = isSelected;
                            check.setAttribute("aria-label", `${f.name} 소스 선택`);
                            return item;
                        })
                        .filter(Boolean);
                    list.replaceChildren(...items);

                    // 삭제 버튼
                    list.querySelectorAll(".file-remove-simple").forEach((btn) => {
                        btn.addEventListener("click", (e) => {
                            e.stopPropagation();
                            const idx = parseInt(btn.dataset.idx);
                            files.splice(idx, 1);
                            renderFiles();
                            renderRecommendations();
                        });
                    });

                    // 완료된 소스는 선택 가능한 체크박스로 표시됩니다.
                    list.querySelectorAll(".file-source-check").forEach((check) => {
                        check.addEventListener("change", () => {
                            const idx = Number(check.dataset.fileCheck);
                            const file = files[idx];
                            if (!file) return;
                            file.selected = check.checked;
                            renderFiles();
                            renderRecommendations();
                            showToast(check.checked ? "소스를 답변 생성에 포함했습니다." : "소스를 답변 생성에서 제외했습니다.");
                        });
                    });

                    // 청킹 실패 파일은 같은 행에서 재시도할 수 있습니다.
                    list.querySelectorAll("[data-file-retry]").forEach((button) => {
                        button.addEventListener("click", (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const idx = Number(button.dataset.fileRetry);
                            const file = files[idx];
                            if (!file) return;
                            file.simulateFailure = false;
                            file.failureReason = "";
                            file.selected = false;
                            showToast(`${file.name} 청킹을 다시 시도합니다.`);
                            runFilePipeline(file, true);
                        });
                    });

                    list.classList.toggle("has-items", files.length > 0);

                    // 업로드 안내를 전환합니다.
                    const uploadGuide = $(".upload-guide");
                    if (uploadGuide) uploadGuide.style.display = files.length > 0 ? "none" : "";
                    updateSmartSourceTypeCounts();
                    renderSmartImportedSources();
                }

                // 업로드된 파일의 파싱 → SLM 자연어화 → 청킹 파이프라인을 순차 시뮬레이션

                // 파일 Pipeline 실행
                function runFilePipeline(fileObj, forceSuccess = false) {
                    const runId = workspaceRunSeq;
                    let stageIdx = 0;
                    // 파일 처리 다음 단계 진행
                    const advance = () => {
                        if (runId !== workspaceRunSeq || !files.includes(fileObj)) return;
                        const stage = FILE_STAGES[stageIdx];
                        if (!stage) return;
                        fileObj.status = stage.status;
                        renderFiles();

                        // 손상/오류/실패 키워드가 포함된 파일명은 프로토타입에서 실패 케이스를 확인할 수 있습니다.
                        if (!forceSuccess && fileObj.simulateFailure && stage.status === "chunking") {
                            setTimeout(() => {
                                if (runId !== workspaceRunSeq || !files.includes(fileObj)) return;
                                fileObj.status = "failed";
                                fileObj.selected = false;
                                fileObj.failureReason = "문서 내용을 분석하지 못했습니다.";
                                renderFiles();
                                renderRecommendations();
                                showToast(`${fileObj.name} 청킹에 실패했습니다. 재시도해 주세요.`);
                            }, 700);
                            return;
                        }

                        if (stage.status === "done") {
                            fileObj.chunks = Math.floor(Math.random() * 10) + 6; // 6~15청크
                            fileObj.selected = true;
                        }
                        stageIdx++;
                        if (stage.delay > 0 && FILE_STAGES[stageIdx]) setTimeout(advance, stage.delay);
                    };
                    advance();
                }

                // 추천 소스 조회
                function getRecommendedSources(filter = currentFilter) {
                    // 새 채팅 초기 상태에서는 이전 대화의 추천 예시를 노출하지 않습니다.
                    if (isReset) return [];
                    const importedSet = new Set(smartImportedSourceIds);
                    const base = recommendations
                        .filter((item) => !importedSet.has(item.id))
                        .slice()
                        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
                    if (filter === "all") return base;
                    return base.filter((item) => item.category === filter);
                }

                // 업로드 소스 항목 구성
                function buildUploadSourceItem(file, index) {
                    const fileId = Number(file.id || index + 1);
                    return {
                        id: -(100000 + fileId),
                        title: file.name,
                        score: null,
                        meta: "업로드소스",
                        category: "upload",
                        desc: "AI 참조소스에 직접 추가한 업로드 자료입니다.",
                        tags: [],
                        __locked: true,
                        __sourceKind: "upload",
                        __sourceKey: `upload-${fileId}`,
                        preview: {
                            org: "AI 참조소스 · 업로드소스",
                            title: file.name,
                            sections: [
                                { title: "소스 정보", items: [`파일명: ${file.name}`, `문서 청크: ${file.chunks || 0}개`, "AI 참조소스에 직접 업로드한 자료입니다."] },
                                { title: "활용 안내", items: ["AI 참조소스에서 선택한 자료는 답변과 초안 생성에 활용됩니다.", "문서의 원문과 청크 내용을 기반으로 관련 답변을 생성합니다."] },
                            ],
                        },
                    };
                }

                // 참고자료 소스 조회
                function getReferenceSources(filter = currentFilter) {
                    const searchItems = smartImportedSourceIds
                        .map((id) => recommendations.find((item) => item.id === id))
                        .filter(Boolean)
                        .map((item) => ({ ...item, __locked: true, __sourceKind: "search", __sourceKey: `search-${item.id}`, meta: "검색소스" }));
                    const uploadItems = files
                        .map((file, index) => ({ file, index }))
                        .filter((entry) => entry.file.status === "done")
                        .map((entry) => buildUploadSourceItem(entry.file, entry.index));
                    if (filter === "search") return searchItems;
                    if (filter === "upload") return uploadItems;
                    return [...searchItems, ...uploadItems];
                }

                // 선택 참고자료 소스 조회
                function getSelectedReferenceSources(filter = currentFilter) {
                    const searchItems = smartImportedSelectedIds
                        .map((id) => recommendations.find((item) => item.id === id))
                        .filter(Boolean)
                        .map((item) => ({ ...item, __locked: true, __sourceKind: "search", __sourceKey: `search-${item.id}`, meta: "검색소스" }));
                    const uploadItems = files
                        .map((file, index) => ({ file, index }))
                        .filter((entry) => entry.file.status === "done" && entry.file.selected !== false)
                        .map((entry) => buildUploadSourceItem(entry.file, entry.index));
                    if (filter === "search") return searchItems;
                    if (filter === "upload") return uploadItems;
                    return [...searchItems, ...uploadItems];
                }

                // 필터링된 추천자료 조회
                function getFilteredRecommendations(filter = currentFilter) {
                    if (currentSourceGroup === "recommended") return getRecommendedSources(filter);
                    if (currentSourceGroup === "additional") return getReferenceSources(filter);
                    const recommended = getRecommendedSources("all");
                    const additional = getReferenceSources("all");
                    const keys = new Set(recommended.map((item) => `rec-${item.id}`));
                    return [
                        ...recommended,
                        ...additional.filter((item) => {
                            const key = item.__sourceKey || `rec-${item.id}`;
                            if (keys.has(key)) return false;
                            keys.add(key);
                            return true;
                        }),
                    ];
                }

                // 소스 탭 개수 조회
                function getSourceTabCounts() {
                    const recommendedAll = getRecommendedSources("all").length;
                    const similar = getRecommendedSources("similar").length;
                    const reference = getRecommendedSources("reference").length;
                    const additionalAll = getReferenceSources("all").length;
                    const search = getReferenceSources("search").length;
                    const upload = getReferenceSources("upload").length;
                    return {
                        all: recommendedAll + additionalAll,
                        recommended: recommendedAll,
                        additional: additionalAll,
                        similar,
                        reference,
                        search,
                        upload,
                    };
                }

                // 소스 탭 개수 갱신
                function updateSourceTabCounts() {
                    const counts = getSourceTabCounts();
                    $$("[data-source-count]").forEach((el) => {
                        const key = el.dataset.sourceCount;
                        el.textContent = String(counts[key] || 0);
                    });
                }

                // 추천자료 전체 선택 상태 보장
                function ensureRecommendationSelectAll() {
                    const recommendList = $("#recommendList");
                    const head = recommendList?.closest(".center-left")?.querySelector(".center-sub-head");
                    if (!head) return null;
                    let checkbox = head.querySelector("#recSelectAll");
                    if (!checkbox) {
                        const label = document.createElement("label");
                        label.className = "rec-select-all";
                        checkbox = document.createElement("input");
                        checkbox.id = "recSelectAll";
                        checkbox.type = "checkbox";
                        checkbox.className = "checkbox-control checkbox-control-sm";
                        const text = document.createElement("span");
                        text.textContent = "전체선택";
                        label.append(checkbox, text);
                        const badge = head.querySelector(".sub-badge");
                        if (badge) head.insertBefore(label, badge);
                        else head.appendChild(label);
                    }
                    checkbox.classList.add("checkbox-control", "checkbox-control-sm");
                    return checkbox;
                }

                // 추천자료 식별 키 조회
                function getRecommendationKey(item) {
                    return item.__sourceKey || `rec-${item.id}`;
                }

                // 추천자료 Template 복제
                function cloneRecommendationTemplate() {
                    return cloneAfterPrototype("recommendationCardPrototype");
                }

                // 추천자료 태그 동기화
                function syncRecommendationTags(card, tags) {
                    const tagList = $(".rec-tags", card);
                    if (!tagList) return;
                    const nextTags = tags || [];
                    const currentTags = $$(".rec-tag", tagList).map((tag) => tag.textContent);
                    if (currentTags.length !== nextTags.length || currentTags.some((tag, index) => tag !== nextTags[index])) {
                        const tagNodes = nextTags
                            .map((tag) => {
                                const tagNode = cloneAfterPrototype("recommendationTagPrototype");
                                if (tagNode) tagNode.textContent = tag;
                                return tagNode;
                            })
                            .filter(Boolean);
                        tagList.replaceChildren(...tagNodes);
                    }
                    tagList.classList.toggle("hidden", nextTags.length === 0);
                }

                // 추천자료 카드 동기화
                function syncRecommendationCard(card, item, displayIndex, filtered) {
                    const isLocked = Boolean(item.__locked);
                    const isSelected = isLocked || selectedRecIds.includes(item.id);
                    const dynamicRank = isLocked ? 0 : filtered.slice(0, displayIndex + 1).filter((filteredItem) => !filteredItem.__locked).length;

                    card.dataset.recommendKey = getRecommendationKey(item);
                    card.dataset.recId = String(item.id);
                    card.dataset.category = item.category || "";
                    card.classList.remove("hidden");
                    card.classList.toggle("active", isSelected);
                    card.classList.toggle("rec-card-readonly", isLocked);

                    const checkboxLabel = $(".rec-checkbox", card);
                    const checkbox = checkboxLabel?.querySelector('input[type="checkbox"]');
                    checkboxLabel?.classList.toggle("hidden", isLocked);
                    if (checkbox) {
                        checkbox.classList.add("checkbox-control", "checkbox-control-sm");
                        checkbox.dataset.recId = String(item.id);
                        checkbox.checked = isSelected;
                        checkbox.setAttribute("aria-label", `${item.title} 선택`);
                        checkbox.onchange = (event) => {
                            event.stopPropagation();
                            if (checkbox.checked) {
                                if (!selectedRecIds.includes(item.id)) selectedRecIds.push(item.id);
                            } else {
                                selectedRecIds = selectedRecIds.filter((value) => value !== item.id);
                            }
                            renderRecommendations();
                            renderSelectedRefs();
                            syncPreviewAfterSelectionChange(item, checkbox.checked);
                        };
                    }

                    const sourceIcon = $(".additional-source-icon", card);
                    sourceIcon?.classList.toggle("hidden", !isLocked);

                    const title = $(".rec-title", card);
                    if (title) title.textContent = item.title;

                    const sourceType = $(".additional-source-kind", card);
                    if (sourceType) {
                        sourceType.classList.remove("search", "upload");
                        if (item.__sourceKind) sourceType.classList.add(item.__sourceKind);
                        sourceType.classList.toggle("hidden", !isLocked);
                        sourceType.textContent = item.__sourceKind === "upload" ? "업로드소스" : "검색소스";
                    }

                    const score = $(".rec-score", card);
                    const hasScore = !isLocked && Number.isFinite(Number(item.score));
                    if (score) {
                        score.classList.toggle("hidden", !hasScore);
                        score.textContent = hasScore ? `${item.score}%` : "";
                    }

                    const topBadge = $(".rec-top-badge", card);
                    const hasTopBadge = !isLocked && dynamicRank > 0 && dynamicRank <= 3;
                    if (topBadge) {
                        topBadge.classList.toggle("hidden", !hasTopBadge);
                        topBadge.classList.toggle("rec-top-badge--first", dynamicRank === 1);
                        topBadge.textContent = hasTopBadge ? `TOP ${dynamicRank}` : "TOP";
                    }

                    const meta = $(".rec-meta", card);
                    if (meta) {
                        meta.classList.toggle("hidden", isLocked);
                        meta.textContent = isLocked ? "" : item.meta || "";
                    }
                    const desc = $(".rec-desc", card);
                    if (desc) {
                        desc.classList.toggle("hidden", isLocked);
                        desc.textContent = isLocked ? "" : item.desc || "";
                    }
                    syncRecommendationTags(card, isLocked ? [] : item.tags);

                    card.onclick = (event) => {
                        if (event.target.closest(".rec-checkbox")) return;
                        renderPreview(item);
                    };
                }

                // 추천자료 렌더링
                function renderRecommendations() {
                    const filtered = getFilteredRecommendations();
                    const resultCount = $("#recommendResultCount");
                    const topCount = $("#tabCountRecommend");
                    if (resultCount) resultCount.textContent = String(filtered.length);
                    if (topCount) topCount.textContent = String(getRecommendedSources("all").length + getReferenceSources("all").length);
                    updateSourceTabCounts();
                    const recommendList = $("#recommendList");
                    if (!recommendList) return;

                    const selectAll = ensureRecommendationSelectAll();
                    if (selectAll) {
                        const selectableForHeader = filtered.filter((item) => !item.__locked);
                        selectAll.closest("label")?.classList.toggle("hidden", selectableForHeader.length === 0);
                    }

                    const activeKeys = new Set(filtered.map(getRecommendationKey));
                    $$(".rec-card", recommendList).forEach((card) => {
                        card.classList.toggle("hidden", !activeKeys.has(card.dataset.recommendKey));
                    });

                    const emptyStateAnchor = $("[data-recommend-empty]", recommendList);
                    filtered.forEach((item, displayIndex) => {
                        const recommendationKey = getRecommendationKey(item);
                        let card = $$(".rec-card", recommendList).find((candidate) => candidate.dataset.recommendKey === recommendationKey);
                        if (!card) {
                            card = cloneRecommendationTemplate();
                            if (!card) return;
                        }
                        syncRecommendationCard(card, item, displayIndex, filtered);
                        recommendList.insertBefore(card, emptyStateAnchor);
                    });

                    const emptyState = filtered.length === 0 ? (currentSourceGroup === "additional" ? "additional" : isReset ? "reset" : "filtered") : "";
                    $$("[data-recommend-empty]", recommendList).forEach((state) => {
                        state.classList.toggle("hidden", state.dataset.recommendEmpty !== emptyState);
                    });

                    bindSelectAll();
                    updateApplyToChatVisibility();
                }

                // 정적 추천자료 카드 이벤트 연결
                function bindStaticRecommendationCards() {
                    const recommendList = $("#recommendList");
                    if (!recommendList) return;
                    $$(".rec-card[data-rec-id]", recommendList).forEach((card) => {
                        const item = recommendations.find((source) => source.id === Number(card.dataset.recId));
                        if (!item) return;
                        const checkbox = card.querySelector('.rec-checkbox input[type="checkbox"]');
                        if (checkbox) {
                            checkbox.onchange = (event) => {
                                event.stopPropagation();
                                if (checkbox.checked) {
                                    if (!selectedRecIds.includes(item.id)) selectedRecIds.push(item.id);
                                } else {
                                    selectedRecIds = selectedRecIds.filter((value) => value !== item.id);
                                }
                                card.classList.toggle("active", checkbox.checked);
                                renderSelectedRefs();
                                syncPreviewAfterSelectionChange(item, checkbox.checked);
                            };
                        }
                        card.onclick = (event) => {
                            if (event.target.closest(".rec-checkbox")) return;
                            renderPreview(item);
                        };
                    });
                    bindSelectAll();
                    updateApplyToChatVisibility();
                }

                // 추천자료 빈 상태 미리보기 렌더링
                function renderEmptyRecommendationPreview() {
                    const previewBody = $("#previewBody");
                    if (!previewBody) return;
                    delete previewBody.dataset.previewRecommendationId;
                    const badge = $(".center-right .sub-badge");
                    if (badge) badge.textContent = "미리보기 대기";
                    const empty = cloneAfterPrototype("afterPreviewEmptyPrototype");
                    previewBody.replaceChildren(...(empty ? [empty] : []));
                }

                // 미리보기 After 선택 Change 동기화
                function syncPreviewAfterSelectionChange(item, isChecked) {
                    const previewBody = $("#previewBody");
                    if (!previewBody) return;
                    if (isChecked) {
                        renderPreview(item);
                        return;
                    }
                    if (Number(previewBody.dataset.previewRecommendationId) !== item.id) return;
                    const next = recommendations.find((recommendation) => selectedRecIds.includes(recommendation.id));
                    if (next) renderPreview(next);
                    else renderEmptyRecommendationPreview();
                }

                // 미리보기 렌더링
                function renderPreview(rec) {
                    if (!rec) return;
                    const previewBody = $("#previewBody");
                    if (!previewBody) return;
                    previewBody.dataset.previewRecommendationId = String(rec.id);
                    const badge = $(".center-right .sub-badge");
                    if (badge) badge.textContent = rec.__sourceKind ? (rec.__sourceKind === "upload" ? "업로드소스" : "검색소스") : `유사도 ${rec.score}%`;

                    const preview = rec.preview || { org: "AI 참조소스", title: rec.title, sections: [] };
                    const sectionsPerPage = 2;
                    const allSections = preview.sections || [];
                    const pages = [];
                    for (let i = 0; i < allSections.length; i += sectionsPerPage) pages.push(allSections.slice(i, i + sectionsPerPage));
                    if (pages.length === 0) pages.push([]);

                    const isAdditional = Boolean(rec.__sourceKind);
                    const metaItems = isAdditional
                        ? [
                              { label: "문서명", value: rec.title },
                              { label: "소스구분", value: rec.__sourceKind === "upload" ? "업로드소스" : "검색소스" },
                              { label: "소스상태", value: "AI 참조소스에 추가됨" },
                              { label: "활용메모", value: rec.desc || "AI 참조소스에 추가된 자료이며, 선택 시 답변 및 초안 생성에 활용됩니다." },
                          ]
                        : [
                              { label: "문서명", value: rec.title },
                              { label: "문서유형", value: rec.meta },
                              { label: "활용등급", value: `${rec.score}% 유사도 · ${(rec.tags || []).join(", ")}` },
                              { label: "검토메모", value: rec.desc },
                          ];

                    previewBody.innerHTML = `<div class="doc-pages-track">${pages
                        .map((pageSections, pageIdx) =>
                            buildDocPage({
                                org: preview.org || "AI 참조소스",
                                title: preview.title || rec.title,
                                continueTitle: `${preview.title || rec.title} · (계속)`,
                                pageIdx,
                                totalPages: pages.length,
                                metaItems: pageIdx === 0 ? metaItems : [],
                                lead:
                                    pageIdx === 0
                                        ? isAdditional
                                            ? `${rec.title}은(는) AI 참조소스에 추가된 참조소스입니다. AI 참조소스에서 선택하면 답변 및 초안 생성에 활용됩니다.`
                                            : `${rec.desc} 관련 실제 검토 문서의 느낌을 주기 위해 본 미리보기는 한 페이지에 충분한 분량이 보이도록 문단, 목록, 메모 박스를 함께 구성했습니다.`
                                        : `이 페이지는 ${rec.title} 문서의 후속 검토 페이지입니다.`,
                                sections: pageSections.map((section) => ({
                                    ...section,
                                    desc: section.desc || `${section.title} 항목에서 답변 또는 초안 생성에 활용할 수 있는 주요 내용을 확인할 수 있습니다.`,
                                    note: section.note || `${section.title} 관련 내용은 선택된 소스의 근거로 활용됩니다.`,
                                })),
                            }),
                        )
                        .join("")}</div>`;

                    initDocViewerPanel($("#recommendViewerPanel"));
                }

                // 선택한 참고자료 렌더링
                function renderSelectedRefs() {
                    const list = $("#selectedRefsList");
                    const count = $("#selectedRefsCount");
                    if (!list) return;
                    const selected = selectedRecIds.map((id) => recommendations.find((r) => r.id === id)).filter(Boolean);
                    if (count) count.textContent = String(getApplySelectionCount());
                    const items = selected
                        .map((r) => {
                            const item = cloneAfterPrototype("afterSelectedReferencePrototype");
                            if (!item) return null;
                            item.dataset.refId = String(r.id);
                            item.querySelector(".ref-score").textContent = `${r.score}%`;
                            item.querySelector(".ref-name").textContent = r.title;
                            item.querySelector(".ref-remove").dataset.removeId = String(r.id);
                            return item;
                        })
                        .filter(Boolean);
                    list.replaceChildren(...items);

                    bindSelectedReferenceRemoveActions(list);

                    // 참조 안내를 전환합니다. 초기 상태와 추천 완료 후 미선택 상태를 구분해 안내합니다.
                    const refsGuide = $(".selected-refs-guide");
                    if (refsGuide) {
                        refsGuide.style.display = selected.length > 0 ? "none" : "";
                        const guideTitle = refsGuide.querySelector(".selected-refs-guide-title");
                        const guideDesc = refsGuide.querySelector(".selected-refs-guide-desc");
                        if (selected.length === 0) {
                            if (!hasChatRecommendationResults) {
                                if (guideTitle) guideTitle.textContent = "AI 채팅을 통해 관련자료를 추천 받을 수 있습니다";
                                if (guideDesc) guideDesc.textContent = "AI 채팅을 시작해 보세요";
                            } else {
                                if (guideTitle) guideTitle.textContent = "추천된 관련자료를 선택해 보세요";
                                if (guideDesc) guideDesc.textContent = "선택한 자료를 답변서 초안에 반영할 수 있습니다";
                            }
                        }
                    }

                    renderCollapsedAnswerSources();

                    // 선택 자료가 있을 때 AI 참조소스 패널 하단의 반영 버튼을 노출합니다.
                    updateApplyToChatVisibility();
                }

                // 선택한 참고자료 제거 이벤트 연결
                function bindSelectedReferenceRemoveActions(list = $("#selectedRefsList")) {
                    if (!list) return;
                    $$(".ref-remove", list).forEach((btn) => {
                        btn.onclick = () => {
                            const id = parseInt(btn.dataset.removeId);
                            selectedRecIds = selectedRecIds.filter((x) => x !== id);
                            renderSelectedRefs();
                            renderRecommendations();
                        };
                    });
                }

                // 완료 답변 채팅 메시지 이벤트 연결
                function bindAfter9ChatMessageActions(messageList) {
                    window.ChatMessage?.bind(messageList, {
                        getText: ({ button, message }) => {
                            const messageIndex = Number(button.dataset.idx);
                            return chatConversations[activeChatTopic]?.[messageIndex]?.text ?? message?.querySelector(".msg-content, .msg-text")?.innerText ?? "";
                        },
                        onFeedback: () => showToast("피드백이 반영되었습니다."),
                        onCopy: ({ copied }) => showToast(copied ? "복사되었습니다." : "복사하지 못했습니다."),
                        onMore: () => showToast("추가옵션"),
                        onReport: ({ button }) => openReportDrawer(button),
                    });

                    if (!messageList || messageList.dataset.answerAfterRetryToastBound === "true") return;
                    messageList.dataset.answerAfterRetryToastBound = "true";
                    messageList.addEventListener("chat-message:action", (event) => {
                        if (event.detail?.action === "retry") showToast("답변을 다시 생성합니다.");
                    });
                }

                // 동적 메시지의 높이가 확정된 뒤에도 채팅 목록의 마지막 메시지를 노출
                function scrollChatMessagesToBottom(messageList, message) {
                    if (!messageList) return;
                    const scrollToBottom = () => {
                        if (messageList.isConnected) messageList.scrollTop = messageList.scrollHeight;
                    };
                    scrollToBottom();
                    window.requestAnimationFrame(() => {
                        scrollToBottom();
                        window.requestAnimationFrame(scrollToBottom);
                    });
                    message?.querySelector("img")?.addEventListener("load", scrollToBottom, { once: true });
                }

                // 채팅 메시지 렌더링
                function renderChatMessages() {
                    const el = $("#chatMessages");
                    const msgs = chatConversations[activeChatTopic] || [];
                    const messageElements = msgs
                        .map((m, i) => {
                            const isTyping = m.role === "ai" && m.typing === true;
                            const templateId = m.role === "ai" ? "afterChatAiMessagePrototype" : "afterChatUserMessagePrototype";
                            const message = cloneAfterPrototype(templateId);
                            if (!message) return null;
                            message.classList.toggle("is-typing", isTyping);
                            message.dataset.status = "complete";
                            if (m.role === "ai" && i === 0) message.dataset.messageActions = "none";
                            message.querySelector(".msg-text").textContent = m.text;
                            const time = message.querySelector(".msg-time");
                            time.hidden = !m.time;
                            time.textContent = m.time || "";
                            return message;
                        })
                        .filter(Boolean);
                    el.replaceChildren(...messageElements);
                    bindAfter9ChatMessageActions(el);
                    el.scrollTop = el.scrollHeight;

                    const typingMsg = msgs.find((m) => m.role === "ai" && m.typing);
                    if (typingMsg) {
                        const wraps = el.querySelectorAll(".chat-msg.ai.is-typing");
                        const wrap = wraps[wraps.length - 1];
                        if (wrap) {
                            typingMsg.typing = false;
                            window.ChatMessage?.typewrite(wrap, {
                                text: typingMsg.text,
                                scrollContainer: el,
                                onComplete: () => {
                                    el.scrollTop = el.scrollHeight;
                                },
                            });
                        }
                    }
                }

                // 채팅 목록 선택 동기화
                function syncChatListSelection(sidepop = $("#answerReportSidepop")) {
                    if (!sidepop) return;

                    const items = Array.from(sidepop.querySelectorAll(".drawer-chat-item"));
                    items.forEach((item, fallbackIndex) => {
                        const originalIndex = Number.parseInt(item.dataset.sidepopOriginalOrder, 10);
                        const topicIndex = Number.isInteger(originalIndex) ? originalIndex : fallbackIndex;
                        const isActive = topicIndex === activeChatTopic;
                        item.classList.toggle("is-active", isActive);
                        item.querySelector(".drawer-chat-select")?.setAttribute("aria-pressed", String(isActive));
                    });
                }

                // 채팅 주제 선택
                function selectChatTopic(select, sidepop) {
                    const item = select?.closest(".drawer-chat-item");
                    if (!item || !sidepop?.contains(item)) return;

                    const items = Array.from(sidepop.querySelectorAll(".drawer-chat-item"));
                    const originalIndex = Number.parseInt(item.dataset.sidepopOriginalOrder, 10);
                    const topicIndex = Number.isInteger(originalIndex) ? originalIndex : items.indexOf(item);
                    if (!chatTopics[topicIndex] || !chatConversations[topicIndex]) return;

                    activeChatTopic = topicIndex;
                    syncChatListSelection(sidepop);
                    renderChatMessages();
                    showToast(`'${chatTopics[topicIndex].title}' 채팅으로 전환했습니다.`);
                }

                // 탭 전환
                function switchTab(tab) {
                    currentTab = tab;
                    const body = $("#centerBody");
                    if (!recommendationViewElement) {
                        recommendationViewElement = body?.querySelector(":scope > #recommendViewerPanel") || null;
                    }

                    $$(".top-tab").forEach((button) => {
                        const active = button.dataset.tab === tab;
                        button.classList.toggle("active", active);
                        button.classList.toggle("is-active", active);
                        button.setAttribute("aria-selected", String(active));
                        button.tabIndex = active ? 0 : -1;
                    });

                    if (tab !== "compare" && compareAutoCollapsedLeftPanel) {
                        const leftPanel = $('[data-panel="folder"]');
                        if (leftPanel?.classList.contains("panel-collapsed")) {
                            setPanelCollapsed(leftPanel, false);
                        }
                        compareAutoCollapsedLeftPanel = false;
                    }

                    if (tab === "recommend") {
                        if (!recommendationViewElement) return;
                        body.replaceChildren(recommendationViewElement);
                        $$(".source-primary-chip", recommendationViewElement).forEach((chip) => {
                            const active = chip.dataset.sourceGroup === currentSourceGroup;
                            chip.classList.toggle("active", active);
                            chip.setAttribute("aria-pressed", String(active));
                        });
                        bindFilterChips();
                        renderRecommendations();
                        const availablePreviewItems = getFilteredRecommendations();
                        if (availablePreviewItems.length > 0) renderPreview(availablePreviewItems[0]);
                        else renderEmptyRecommendationPreview();
                        bindApplyToChat();
                        initCenterSplitResize();
                    } else if (tab === "draft") {
                        if (isReset) {
                            if (!draftEmptyElement) draftEmptyElement = $("#answerAfterDraftEmptyState");
                            if (!draftEmptyElement) return;
                            draftEmptyElement.hidden = false;
                            body.replaceChildren(draftEmptyElement);
                            return;
                        }
                        if (draftDisplayMode === "compare" && draftVersions.length >= 2) {
                            renderDraftVersionCompare(body);
                            return;
                        }
                        const selectedDraftVersion = draftVersions[activeDraftVersion] || draftVersions[0];

                        const draftView = cloneAfterPrototype("afterDraftViewPrototype");
                        if (!draftView) return;
                        const draftMarkup = (selectedDraftVersion?.content || draftContent).replace(">답변서 초안</span>", `>답변서 초안 · ${formatDraftVersionTab(selectedDraftVersion)}</span>`);
                        draftView.querySelector("[data-draft-content-slot]").innerHTML = draftMarkup;
                        body.replaceChildren(draftView);
                        mountDraftVersionBar(body);
                        initDraftStatusBar();
                        initDraftVerify();
                        initDraftVersionBar();
                    } else if (tab === "compare") {
                        if (isReset) {
                            const empty = cloneAfterPrototype("afterCompareEmptyPrototype");
                            body.replaceChildren(...(empty ? [empty] : []));
                            return;
                        }
                        const leftPanel = $('[data-panel="folder"]');
                        if (leftPanel && !leftPanel.classList.contains("panel-collapsed")) {
                            compareAutoCollapsedLeftPanel = true;
                            setPanelCollapsed(leftPanel, true);
                        }
                        const compareView = cloneAfterPrototype("afterCompareViewPrototype");
                        if (!compareView) return;
                        body.replaceChildren(compareView);
                        // initialize 비교 View 동작 처리
                        const initializeCompareView = () => {
                            initCompareResize();
                            initAllDocViewers(body);
                            initCompareStatusBar(body);
                            initCompareSelectors(body);
                        };
                        initializeCompareView();
                    }
                }

                // 비교 크기 조절 초기화
                function initCompareResize() {
                    const split = $(".compare-three-col");
                    if (split) window.AIOneSplitHandler?.init(split);
                }

                // 소스 보조 탭 렌더링
                function renderSourceSecondaryTabs() {
                    const bar = $("#sourceSecondaryTabs");
                    if (!bar) return;
                    if (currentSourceGroup === "all") {
                        bar.replaceChildren();
                        bar.classList.add("hidden");
                        return;
                    }
                    const counts = getSourceTabCounts();
                    const options =
                        currentSourceGroup === "recommended"
                            ? [
                                  ["all", "전체", counts.recommended],
                                  ["similar", "유사답변서", counts.similar],
                                  ["reference", "참고자료", counts.reference],
                              ]
                            : [
                                  ["all", "전체", counts.additional],
                                  ["search", "검색소스", counts.search],
                                  ["upload", "업로드소스", counts.upload],
                              ];
                    const filterTone = { all: "all", similar: "single", reference: "multi", search: "all", upload: "single" };
                    bar.classList.remove("hidden");
                    const chips = options
                        .map(([value, label, count]) => {
                            const active = currentFilter === value;
                            const countKey = value === "all" ? (currentSourceGroup === "recommended" ? "recommended" : "additional") : value;
                            const chip = cloneAfterPrototype("afterSourceSecondaryTabPrototype");
                            if (!chip) return null;
                            chip.classList.toggle("active", active);
                            chip.dataset.filter = filterTone[value];
                            chip.dataset.sourceFilter = value;
                            chip.setAttribute("aria-pressed", String(active));
                            chip.querySelector("[data-source-filter-label]").textContent = label;
                            const countElement = chip.querySelector(".source-tab-count");
                            countElement.dataset.sourceCount = countKey;
                            countElement.textContent = String(count);
                            return chip;
                        })
                        .filter(Boolean);
                    bar.replaceChildren(...chips);
                    $$(".source-secondary-chip", bar).forEach((chip) => {
                        chip.addEventListener("click", () => {
                            currentFilter = chip.dataset.sourceFilter || "all";
                            renderSourceSecondaryTabs();
                            renderRecommendations();
                            const filtered = getFilteredRecommendations();
                            if (filtered.length) renderPreview(filtered[0]);
                            updateFilterDesc(currentFilter);
                        });
                    });
                }

                // 필터 칩 이벤트 연결
                function bindFilterChips() {
                    const chips = $$(".source-primary-chip");
                    chips.forEach((chip) => {
                        const active = chip.dataset.sourceGroup === currentSourceGroup;
                        chip.classList.toggle("active", active);
                        chip.setAttribute("aria-pressed", String(active));
                        chip.onclick = () => {
                            currentSourceGroup = chip.dataset.sourceGroup || "all";
                            currentFilter = "all";
                            chips.forEach((button) => {
                                const isActive = button === chip;
                                button.classList.toggle("active", isActive);
                                button.setAttribute("aria-pressed", String(isActive));
                            });
                            renderSourceSecondaryTabs();
                            renderRecommendations();
                            const filtered = getFilteredRecommendations();
                            if (filtered.length) renderPreview(filtered[0]);
                            updateFilterDesc(currentFilter);
                        };
                    });
                    renderSourceSecondaryTabs();
                    updateFilterDesc(currentFilter);
                    bindSelectAll();
                }

                // 전체 선택 이벤트 연결
                function bindSelectAll() {
                    const selectAll = ensureRecommendationSelectAll();
                    if (!selectAll) return;
                    const selectable = getFilteredRecommendations().filter((item) => !item.__locked);
                    const label = selectAll.closest("label");
                    if (label) label.classList.toggle("hidden", selectable.length === 0);
                    const selectedCount = selectable.filter((item) => selectedRecIds.includes(item.id)).length;
                    selectAll.checked = selectable.length > 0 && selectedCount === selectable.length;
                    selectAll.indeterminate = selectedCount > 0 && selectedCount < selectable.length;
                    selectAll.onchange = () => {
                        selectAll.indeterminate = false;
                        if (selectAll.checked) {
                            selectable.forEach((item) => {
                                if (!selectedRecIds.includes(item.id)) selectedRecIds.push(item.id);
                            });
                        } else {
                            const ids = new Set(selectable.map((item) => item.id));
                            selectedRecIds = selectedRecIds.filter((id) => !ids.has(id));
                        }
                        renderRecommendations();
                        renderSelectedRefs();
                    };
                }

                // 채팅 적용 대상 개수 조회
                function getApplySelectionCount() {
                    const selectedRecommendedCount = recommendations.filter((item) => selectedRecIds.includes(item.id) && !smartImportedSourceIds.includes(item.id)).length;
                    const selectedAdditionalCount = getSelectedReferenceSources("all").length;
                    return selectedRecommendedCount + selectedAdditionalCount;
                }

                // 채팅 적용 버튼 표시 상태 갱신
                function updateApplyToChatVisibility() {
                    const btn = $("#applyToChat");
                    const message = $("#applyToChatMessage");
                    if (!btn) return;
                    const count = getApplySelectionCount();
                    const hasSelection = count > 0;
                    btn.textContent = "반영";
                    btn.disabled = !hasSelection;
                    btn.setAttribute("aria-disabled", String(!hasSelection));
                    btn.removeAttribute("aria-hidden");
                    if (message) {
                        message.textContent = hasSelection ? `선택한 관련자료 ${count}건을 초안에 반영할 수 있습니다.` : "관련자료 선택 시 초안에 반영할 수 있습니다.";
                    }
                }

                // 선택 소스의 채팅 적용 이벤트 연결
                function bindApplyToChat() {
                    const btn = $("#applyToChat");
                    if (!btn) return;
                    updateApplyToChatVisibility();
                    if (btn.dataset.applyBound === "true") return;
                    btn.dataset.applyBound = "true";
                    btn.addEventListener("click", () => {
                        if (btn.dataset.applying === "true") return;
                        const selectedRecommended = recommendations.filter((item) => selectedRecIds.includes(item.id) && !smartImportedSourceIds.includes(item.id));
                        const selectedAdditional = getSelectedReferenceSources("all");
                        const selected = [...selectedRecommended, ...selectedAdditional];
                        if (selected.length === 0) {
                            showToast("자료를 선택해주세요.");
                            return;
                        }
                        const runId = workspaceRunSeq;
                        const chatTopicIndex = activeChatTopic;
                        const prompt = `다음 자료를 참고하여 답변서 초안을 생성해주세요:\n${selected.map((item, index) => `${index + 1}. ${item.title}${Number.isFinite(Number(item.score)) && !item.__locked ? ` (유사도 ${item.score}%)` : ""}`).join("\n")}`;
                        const now = new Date();
                        const time = now.getHours() + ":" + String(now.getMinutes()).padStart(2, "0");
                        chatConversations[chatTopicIndex].push({ role: "user", text: prompt, time });
                        renderChatMessages();

                        const messageList = $("#chatMessages");
                        const pendingMessage = window.ChatMessage?.createPending({
                            variant: "answer",
                            title: `선택 자료 ${selected.length}건 분석 중`,
                            description: "답변서 초안에 반영하고 있습니다...",
                        });
                        if (messageList && pendingMessage) {
                            messageList.append(pendingMessage);
                            scrollChatMessagesToBottom(messageList, pendingMessage);
                        }

                        btn.dataset.applying = "true";
                        btn.disabled = true;
                        setTimeout(() => {
                            if (runId !== workspaceRunSeq) {
                                pendingMessage?.remove();
                                delete btn.dataset.applying;
                                updateApplyToChatVisibility();
                                return;
                            }
                            chatConversations[chatTopicIndex].push({
                                role: "ai",
                                text: `선택하신 ${selected.length}건의 자료를 분석하여 답변서 초안에 반영합니다.\n\n📋 반영 자료:\n${selected.map((item) => "• " + item.title).join("\n")}\n\n초안 생성을 시작합니다. "답변서 초안" 탭에서 결과를 확인하세요.`,
                                time,
                                typing: true,
                            });
                            if (activeChatTopic === chatTopicIndex) renderChatMessages();
                            pendingMessage?.remove();
                            delete btn.dataset.applying;
                            updateApplyToChatVisibility();
                        }, 800);
                    });
                }

                // 필터 Desc 갱신
                function updateFilterDesc(filter) {
                    let descEl = $(".filter-desc");
                    const list = $(".recommend-list") || $("#recommendList");
                    if (!list) return;
                    if (!descEl) {
                        descEl = document.createElement("div");
                        descEl.className = "filter-desc";
                        list.parentElement.insertBefore(descEl, list);
                    }
                    if (currentSourceGroup === "recommended" && filter === "similar") {
                        descEl.textContent = "과거 답변서와 마스터답변 중 현재 질의와 유사도가 높은 자료를 추천합니다.";
                        descEl.style.display = "";
                    } else if (currentSourceGroup === "recommended" && filter === "reference") {
                        descEl.textContent = "답변서 작성 시 근거로 활용할 수 있는 참고자료입니다.";
                        descEl.style.display = "";
                    } else if (currentSourceGroup === "additional" && filter === "search") {
                        descEl.textContent = "AI 참조소스에서 검색 후 가져온 자료 전체를 표시합니다.";
                        descEl.style.display = "";
                    } else if (currentSourceGroup === "additional" && filter === "upload") {
                        descEl.textContent = "AI 참조소스에 직접 업로드한 자료 전체를 표시합니다.";
                        descEl.style.display = "";
                    } else if (currentSourceGroup === "additional") {
                        descEl.textContent = "AI 참조소스에서 검색 후 가져오거나 직접 업로드한 자료입니다.";
                        descEl.style.display = "";
                    } else {
                        descEl.style.display = "none";
                    }
                }

                /* ============================ 끝: 화면 렌더링 ============================== */

                /* ============================ 시작: 화면 이벤트 ============================ */
                // 답변 워크스페이스 초기화
                function resetAnswerWorkspace() {
                    workspaceRunSeq += 1;
                    compareApiRequestSeq += 1;
                    draftCompareApiRequestSeq += 1;
                    hideAnswerSkeleton();

                    files.length = 0;
                    smartImportedSourceIds = [];
                    smartImportedSelectedIds = [];
                    smartImportedStatus.clear();
                    smartImportedOrder.clear();
                    smartUnifiedSourceOrderSeq = 0;
                    selectedRecIds = [];
                    selectedRec = 0;
                    moreRecSeq = 0;
                    currentFilter = "all";
                    currentSourceGroup = "all";
                    currentTab = "recommend";
                    isReset = true;
                    hasChatRecommendationResults = false;

                    const fileInput = $("#after9SourceFileInput");
                    if (fileInput) fileInput.value = "";
                    resetSmartSourceUi();
                    resetReportForm();
                    const chatInput = $("#chatInput");
                    if (chatInput) {
                        chatInput.value = "";
                        const sendButton = $("#chatSendBtn");
                        if (sendButton) sendButton.disabled = true;
                    }

                    const uploadSection = $(".folder-upload-section");
                    const refsSection = $("#selectedRefsSection");
                    if (uploadSection) {
                        uploadSection.style.flex = "";
                        uploadSection.style.height = "";
                    }
                    if (refsSection) {
                        refsSection.style.flex = "";
                        refsSection.style.height = "";
                    }

                    renderFiles();
                    renderSelectedRefs();

                    draftVersions = draftVersionExamples.map((version) => ({ ...version }));
                    activeDraftVersion = 0;
                    draftDisplayMode = "single";
                    draftCompareLeftVersion = 0;
                    draftCompareRightVersion = Math.min(1, Math.max(0, draftVersions.length - 1));
                    comparePanelsSwapped = false;
                    openDocTabs = [{ id: 0, label: formatDraftVersionTab(draftVersions[0]), versionIdx: 0 }];
                    activeDocTab = 0;

                    // 관련자료 목록과 문서 미리보기 구조는 유지하고 각 영역에 안내 문구를 표시합니다.
                    switchTab("recommend");

                    ["tabCountRecommend", "tabCountDraft", "tabCountCompare"].forEach((id) => {
                        const count = $("#" + id);
                        if (count) count.textContent = "0";
                    });
                }

                // 화면 주요 이벤트 연결
                function bindEvents() {
                    // 상단 탭은 고정 컨테이너에서 위임하여 화면 초기화 후에도 전환 동작을 유지합니다.
                    $(".center-tabs")?.addEventListener("click", (event) => {
                        const tab = event.target.closest(".top-tab[data-tab]");
                        if (!tab) return;
                        switchTab(tab.dataset.tab);
                    });

                    // 필터 칩 초기 상태
                    bindFilterChips();

                    // 채팅
                    $("#chatSendBtn").addEventListener("click", sendChat);
                    $("#chatInput").addEventListener("keydown", (e) => {
                        if (e.key === "Enter") sendChat();
                    });
                    $("#chatInput").addEventListener("input", () => {
                        $("#chatSendBtn").disabled = $("#chatInput").value.trim().length === 0;
                    });

                    // HTML에 선언된 워크스페이스 생성 로딩 표시
                    function showWorkspaceCreationLoading(message, triggerButton, onComplete) {
                        const overlay = document.getElementById("workspaceCreationLoading");
                        if (!overlay) {
                            if (typeof onComplete === "function") onComplete();
                            return;
                        }

                        const title = overlay.querySelector("[data-workspace-creation-title]");
                        if (title) title.textContent = message;
                        overlay.setAttribute("aria-label", message);
                        overlay.setAttribute("aria-hidden", "false");
                        overlay.classList.remove("visible", "leaving");
                        overlay.hidden = false;

                        if (triggerButton) {
                            triggerButton.disabled = true;
                            triggerButton.setAttribute("aria-busy", "true");
                        }
                        const revealTimer = window.setTimeout(() => overlay.classList.add("visible"), 220);
                        const completeTimer = window.setTimeout(() => {
                            overlay.classList.add("leaving");
                            window.setTimeout(() => {
                                window.clearTimeout(revealTimer);
                                window.clearTimeout(completeTimer);
                                overlay.classList.remove("visible", "leaving");
                                overlay.hidden = true;
                                overlay.setAttribute("aria-hidden", "true");
                                if (triggerButton) {
                                    triggerButton.disabled = false;
                                    triggerButton.removeAttribute("aria-busy");
                                }
                                if (typeof onComplete === "function") onComplete();
                            }, 190);
                        }, 1450);
                    }

                    // 새 대화 버튼: 새 대화 생성과 동시에 현재 워크스페이스 업무 상태를 초기화합니다.
                    const newChatBtn = $("#newClassifyBtn");
                    if (newChatBtn) {
                        newChatBtn.addEventListener("click", () => {
                            if (newChatBtn.disabled) return;
                            showWorkspaceCreationLoading("국회 답변서 초안 생성 AI 워크스페이스 생성중", newChatBtn, () => {
                                const newId = chatTopics.length;
                                const now = new Date();
                                const time = now.getHours() + ":" + String(now.getMinutes()).padStart(2, "0");
                                chatTopics.push({
                                    title: "새 대화 #" + (newId + 1),
                                    time,
                                    date: new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, ""),
                                    id: newId,
                                });
                                chatConversations.push([{ role: "ai", text: AI_CHAT_INTRO, time }]);
                                activeChatTopic = newId;
                                resetAnswerWorkspace();
                                renderChatMessages();
                                $("#chatInput")?.focus();
                                showToast("새 채팅을 시작합니다. 화면이 초기화되었습니다.");
                            });
                        });
                    }

                    // 채팅 목록 사이드 팝업
                    const chatListToggle = $("#runDrawerBtn");
                    chatListToggle?.addEventListener("click", (event) => {
                        event.preventDefault();
                        window.AIOneSidePop?.setVariant("#answerReportSidepop", "chat-list");
                        window.AIOneSidePop?.setSize("#answerReportSidepop", "medium");
                        window.AIOneSidePop?.open("#answerReportSidepop", chatListToggle);
                    });
                    // 보고서 사이드 팝업
                    const reportSidepop = $("#answerReportSidepop");
                    const reportSubmitBtn = $("#reportSubmitBtn");
                    if (reportSidepop) {
                        syncChatListSelection(reportSidepop);
                        reportSidepop.addEventListener("click", (event) => {
                            const select = event.target.closest(".drawer-chat-select");
                            if (select) selectChatTopic(select, reportSidepop);
                        });
                        reportSidepop.addEventListener("sidepop:close", resetReportForm);
                        reportSidepop.addEventListener("sidepop:chat-action", (event) => {
                            const { action, completed } = event.detail || {};
                            if (!completed) return;
                            if (action === "share") {
                                showToast("대화 공유 링크가 복사되었습니다.");
                            }
                            if (action === "delete") {
                                showToast("대화가 삭제되었습니다.");
                            }
                        });
                    }
                    if (reportSubmitBtn) {
                        reportSubmitBtn.addEventListener("click", () => {
                            closeReportDrawer();
                            showToast("신고가 접수되었습니다. 감사합니다");
                        });
                    }

                    // 보고서 파일 업로드
                    const reportUploadZone = $("#reportUploadZone");
                    if (reportUploadZone) {
                        reportUploadZone.addEventListener("app:file-upload", (event) => {
                            addReportFiles(Array.from(event.detail?.files || []));
                        });
                    }

                    // 왼쪽 패널 접기
                    const leftCollapseBtn = $("#leftPanelCollapseBtn");
                    if (leftCollapseBtn) {
                        leftCollapseBtn.addEventListener("click", () => {
                            if (smartInlineResultsExpanded || smartTemporaryLayoutActive) {
                                setSmartInlineResultsExpanded(false);
                                return;
                            }
                            const panel = leftCollapseBtn.closest(".panel");
                            const container = $(ANSWER_PANEL_SELECTOR);
                            if (!panel || !container) return;
                            setPanelCollapsed(panel, !panel.classList.contains("panel-collapsed"));
                        });
                    }

                    // 왼쪽 패널 세로 크기 조절 (공유 split-handler type2)
                    const leftResizeHandle = $("#leftPanelResizeHandle");
                    if (leftResizeHandle) {
                        const verticalSplit = leftResizeHandle.closest('[data-component="split-handler"]');
                        if (verticalSplit) window.AIOneSplitHandler?.init(verticalSplit);
                    }

                    document.querySelector("[data-accessory-tools]")?.addEventListener("topbar:accessory-action", handleAccessoryAction);
                }

                /* ============================ 끝: 화면 이벤트 ============================== */

                /* ============================ 시작: 파일 업로드 ============================ */

                // 보안 모달 조회
                function getSecurityModal(panelName) {
                    return document.querySelector(`[data-custom-modal="${panelName}"]`);
                }

                // 모달 배경 클릭 여부 확인
                function isModalBackgroundClick(event, modal) {
                    return event.target === modal?.querySelector(":scope > .modal-bg");
                }

                // Custom 모달 패널 표시
                function showCustomModalPanel(panelName) {
                    const modal = getSecurityModal(panelName);
                    if (!modal) return null;

                    const panel = modal.querySelector(`[data-modal-panel="${panelName}"]`);
                    if (!panel) return null;

                    panel.hidden = false;
                    modal.classList.remove("hidden");
                    return { modal, panel };
                }

                // Custom 모달 닫기
                function closeCustomModal() {
                    document.querySelectorAll("[data-custom-modal]").forEach((modal) => {
                        modal.classList.add("hidden");
                        modal.querySelectorAll("[data-modal-panel]").forEach((panel) => {
                            panel.hidden = true;
                        });
                    });
                }

                // 보안 파일 Rows 렌더링
                function renderSecurityFileRows(results, reasonKey, list) {
                    if (!list || !$("#securityFileRowPrototype")) return;

                    const rows = results.map((result) => {
                        const row = cloneAfterPrototype("securityFileRowPrototype");
                        row.querySelector("[data-security-file-name]").textContent = result.file.name;
                        row.querySelector("[data-security-file-reason]").textContent = (result[reasonKey] || []).join(" · ");
                        return row;
                    });
                    list.replaceChildren(...rows);
                }

                // 민감 파일 Blocked 표시
                function showSensitiveFileBlocked(results, onClose) {
                    const target = showCustomModalPanel("security-blocked");
                    if (!target) return;
                    const { modal, panel } = target;
                    renderSecurityFileRows(results, "sensitiveReasons", panel.querySelector("[data-security-file-list]"));
                    // 현재 안내 UI 닫기
                    const close = () => {
                        closeCustomModal();
                        if (onClose) onClose();
                    };
                    panel.querySelector("#securityBlockedOk").onclick = close;
                    modal.onclick = (event) => {
                        if (isModalBackgroundClick(event, modal)) close();
                    };
                }

                // 기밀 파일 Confirm 표시
                function showConfidentialFileConfirm(results, onConfirm) {
                    const target = showCustomModalPanel("security-confidential");
                    if (!target) return;
                    const { modal, panel } = target;
                    renderSecurityFileRows(results, "confidentialReasons", panel.querySelector("[data-security-file-list]"));
                    const close = closeCustomModal;
                    panel.querySelector("#securityConfidentialCancel").onclick = close;
                    panel.querySelector("#securityConfidentialConfirm").onclick = () => {
                        close();
                        if (onConfirm) onConfirm(results.map((result) => result.file));
                    };
                    modal.onclick = (event) => {
                        if (isModalBackgroundClick(event, modal)) close();
                    };
                }

                // 파일 Before 업로드 검증
                async function validateFilesBeforeUpload(inputFiles, uploadHandler) {
                    const candidateFiles = Array.from(inputFiles || []);
                    if (!candidateFiles.length) return;

                    const security = window.AIOneUploadSecurity;
                    if (!security) {
                        showToast("파일 보안 검사 기능을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
                        return;
                    }

                    showToast("파일의 개인정보·민감정보 및 대외비 여부를 확인하고 있습니다.");
                    const { blocked, confidential, safeFiles } = await security.validate(candidateFiles);

                    // Allowed 업로드 계속 진행
                    const continueAllowedUpload = () => {
                        if (safeFiles.length) uploadHandler(safeFiles);
                        if (confidential.length) {
                            showConfidentialFileConfirm(confidential, (approvedFiles) => uploadHandler(approvedFiles));
                        }
                    };

                    if (blocked.length) {
                        showSensitiveFileBlocked(blocked, continueAllowedUpload);
                    } else {
                        continueAllowedUpload();
                    }
                }

                // 업로드 파일 추가
                function addUploadFiles(newFiles) {
                    const added = [];
                    newFiles.forEach((file) => {
                        const ext = file.name.split(".").pop().toLowerCase();
                        let type = "txt";
                        if (ext === "pdf") type = "pdf";
                        else if (ext === "hwp") type = "hwp";
                        else if (ext === "docx" || ext === "doc") type = "docx";
                        else if (ext === "xlsx" || ext === "xls") type = "xls";
                        else if (["png", "jpg", "jpeg", "tif", "tiff"].includes(ext)) type = "img";
                        const size = (file.size / 1024 / 1024).toFixed(1) + "MB";
                        const fileObj = { id: ++fileIdSeq, name: file.name, size, type, status: null, chunks: 0, selected: true, sourceOrder: ++smartUnifiedSourceOrderSeq, simulateFailure: /오류|손상|실패|error|broken/i.test(file.name) };
                        files.push(fileObj);
                        added.push(fileObj);
                    });
                    isReset = false;
                    renderFiles();
                    // AI 참조소스 파일 추가는 좌측 파일 목록과 처리 상태만 갱신한다.
                    // 관련자료 추천 및 답변서 초안은 사용자가 질의를 전송하거나 재생성을 요청할 때만 갱신한다.
                    showToast(`${newFiles.length}건 파일이 AI 참조소스에 추가되었습니다.`);
                    // 업로드마다 파싱 → SLM 자연어화 → 청킹 파이프라인 실행
                    added.forEach((fileObj) => runFilePipeline(fileObj));
                }

                /* ============================ 끝: 파일 업로드 ============================== */

                /* ============================ 시작: 보고서 파일과 채팅 응답 ============================ */
                // 보고서 파일 추가
                function addReportFiles(newFiles) {
                    const remaining = 5 - reportFiles.length;
                    if (remaining <= 0) {
                        showToast("첨부파일은 최대 5개까지 가능합니다.");
                        return;
                    }
                    const allowedFiles = newFiles.filter((file) => {
                        if (file.size <= 10 * 1024 * 1024) return true;
                        showToast("첨부파일은 각 10MB 이내만 가능합니다.");
                        return false;
                    });
                    const filesToAdd = allowedFiles.slice(0, remaining);
                    filesToAdd.forEach((file) => {
                        const detectedType = getReferenceFileType(file.name, "file");
                        const iconType = { xlsx: "xls", pptx: "img", file: "txt" }[detectedType] || detectedType;
                        const label = getReferenceFileExtension(file.name, detectedType);
                        const size = (file.size / 1024 / 1024).toFixed(1) + "MB";
                        reportFiles.push({ name: file.name, size, type: iconType, label });
                    });
                    renderReportFiles();
                    if (allowedFiles.length > filesToAdd.length) {
                        showToast("첨부파일은 최대 5개까지 가능합니다.");
                    }
                }

                // 보고서 파일 렌더링
                function renderReportFiles() {
                    const list = $("#reportFileList");
                    if (!list) return;
                    list.innerHTML = reportFiles
                        .map(
                            (f, i) => `
      <li class="report-file-item">
        <span class="file-item-main">
          <span class="file-icon ${escapeHtml(f.type)}" aria-hidden="true">${escapeHtml(f.label)}</span>
          <span class="file-info">
            <span class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
          </span>
        </span>
        <span class="file-item-side">
          <span class="file-meta">${escapeHtml(f.size)}</span>
          <button type="button" class="file-remove-simple report-file-remove" data-idx="${i}" aria-label="${escapeHtml(f.name)} 삭제">×</button>
        </span>
      </li>`,
                        )
                        .join("");
                    list.querySelectorAll(".report-file-remove").forEach((btn) => {
                        btn.addEventListener("click", (e) => {
                            e.stopPropagation();
                            const idx = parseInt(btn.dataset.idx);
                            reportFiles.splice(idx, 1);
                            renderReportFiles();
                        });
                    });
                }

                // 보고서 폼 초기화
                function resetReportForm() {
                    reportFiles.length = 0;
                    renderReportFiles();
                    const detail = $("#reportDetail");
                    if (detail) detail.value = "";
                    const firstType = $('input[name="reportType"]');
                    if (firstType) firstType.checked = true;
                }

                // 채팅으로 추가 요청 시 관련자료 목록에 채울 후보 자료 풀
                const MORE_REC_POOL = [
                    {
                        title: "지방재정 위기관리 매뉴얼(개정판)",
                        score: 81,
                        meta: "참고자료 · 지침 · 재정정책국",
                        category: "reference",
                        desc: "지자체 재정위기 사전경보 및 관리 절차. 채무비율 산정 기준 포함.",
                        tags: ["참고자료", "재정위기관리"],
                        preview: {
                            org: "재정정책국 · 개정판",
                            title: "지방재정 위기관리 매뉴얼",
                            sections: [
                                { title: "주요 내용", items: ["재정위기단체 지정 기준 및 절차", "채무비율 산정 방식 및 관리대상 기준"] },
                                { title: "활용 방안", items: ["채무 증가 관련 질의 답변 보강", "재정건전성 관리 근거로 인용"] },
                            ],
                        },
                    },
                    {
                        title: "지방채 발행 한도 산정 기준 지침",
                        score: 78,
                        meta: "참고자료 · 지침 · 재정정책국",
                        category: "reference",
                        desc: "지방채무 한도액 산정 공식 및 지자체별 발행 승인 절차 안내.",
                        tags: ["참고자료", "지방채한도"],
                        preview: {
                            org: "재정정책국",
                            title: "지방채 발행 한도 산정 기준",
                            sections: [
                                { title: "주요 내용", items: ["지방채무 한도액 = 최근 3년 평균 일반회계 결산액 기준 산정", "한도 초과 시 행안부 승인 절차 필요"] },
                                { title: "활용 방안", items: ["채무 증가 우려에 대한 제도적 보완 설명", "한도 관리 체계 인용"] },
                            ],
                        },
                    },
                    {
                        title: "2026년 지방재정 운용 성과평가 보고서",
                        score: 74,
                        meta: "참고답변 · 성과보고 · 지역발전정책국",
                        category: "similar",
                        desc: "지자체별 재정운용 성과와 채무관리 지표 평가 결과 요약.",
                        tags: ["참고답변", "성과평가"],
                        preview: {
                            org: "지역발전정책국 · 2026년",
                            title: "지방재정 운용 성과평가 보고서",
                            sections: [
                                { title: "주요 내용", items: ["채무관리 지표 우수 지자체 사례 포함", "재정운용 평가 등급별 개선 권고사항"] },
                                { title: "활용 방안", items: ["답변서 신뢰도 보강 자료로 인용", "유사 질의 대비 참고"] },
                            ],
                        },
                    },
                    {
                        title: "지방교부세 산정 및 배분 현황 자료",
                        score: 70,
                        meta: "참고자료 · 통계자료 · 재정정책국",
                        category: "reference",
                        desc: "지방교부세 총액 및 지자체별 배분 현황. 교부세와 지방채 관계 설명 포함.",
                        tags: ["참고자료", "지방교부세"],
                        preview: {
                            org: "재정정책국 · 통계자료",
                            title: "지방교부세 산정 및 배분 현황",
                            sections: [
                                { title: "주요 내용", items: ["교부세는 일반재원으로 특정 자본사업에 사용 제한", "지방채는 자본적 지출 목적의 별도 재원"] },
                                { title: "활용 방안", items: ["교부세와 지방채의 목적 차이 설명", "추경 편성 필요성 논거 보강"] },
                            ],
                        },
                    },
                ];

                // More Rec Request 감지
                function detectMoreRecRequest(lowerText) {
                    return lowerText.includes("관련자료") && (lowerText.includes("추가") || lowerText.includes("더"));
                }

                // 사용자 요청 키워드에 따라 서로 다른 예시 응답 생성 (답변서 초안 수정 시나리오)
                // 초안 Edit Response 생성
                function generateDraftEditResponse(text) {
                    const lower = text.toLowerCase();
                    if (lower.includes("요약")) {
                        return '답변서 초안을 핵심 위주로 요약했습니다.\n\n📝 요약 결과:\n• 공자기금은 지자체 자본사업 지원을 위해 지방채를 장기 저리로 인수\n• 광주·전남 통합특별시 출범에 따른 추경 약 1,000억 원 반영\n• 인수기간 5년 거치 10년 분할 상환 조건 유지\n\n전체 분량이 약 40% 축소되었습니다. "답변서 초안" 탭에서 확인해 보세요.';
                    }
                    if (lower.includes("항목") || lower.includes("정리")) {
                        return '답변서 내용을 항목별로 정리했습니다.\n\n① 제도 개요 — 공자기금 지방채 인수 목적 및 근거\n② 추경 편성 배경 — 광주·전남 통합특별시 관련 수요\n③ 재원 조건 — 인수금리 및 상환 조건\n④ 향후 계획 — 지자체별 집행 일정\n\n각 항목은 "답변서 초안" 탭에서 구분선으로 표시됩니다.';
                    }
                    if (lower.includes("문단") || lower.includes("다듬")) {
                        return '문장을 더 매끄럽게 다듬었습니다.\n\n예시:\n"공자기금은 지자체가 발행하는 지방채를 장기 저리로 인수하여, 자본적 지출 사업의 원활한 추진을 지원하고 있습니다."\n\n→ 기존 대비 문장 호흡이 짧아지고 공문서 어조에 맞게 정리되었습니다.';
                    }
                    if (lower.includes("표로") || lower.includes("표 ") || lower.includes("테이블")) {
                        return '주요 수치를 표 형태로 정리했습니다.\n\n| 구분 | 내용 |\n|------|------|\n| 인수금리 | 공자기금 예탁금리 (분기별 고정) |\n| 인수기간 | 5년 거치 10년 분할 상환 |\n| 추경 규모 | 약 1,000억 원 |\n\n"답변서 초안" 탭 본문에 표가 삽입되었습니다.';
                    }
                    if (lower.includes("관계") || lower.includes("연관") || lower.includes("연결")) {
                        return "질의와 참조자료 간의 연관 관계를 분석했습니다.\n\n🔗 연관 구조:\n• 지방교부세 지급 ↔ 일반재원 (용도 제한)\n• 지방채 인수 ↔ 자본적 지출 목적 (별도 재원)\n• 지자체 채무 증가 ↔ 통합특별시 출범에 따른 일시적 수요\n\n세 요소가 서로 배타적이지 않다는 점을 답변서에 강조했습니다.";
                    }
                    if (lower.includes("재검색")) {
                        return '국회 질의·답변 데이터베이스를 재검색했습니다.\n\n🔍 검색 결과: 유사 질의 3건 추가 확인\n• 지방채 인수 관련 상임위 질의 2건\n• 지방교부세 배분 기준 관련 질의 1건\n\n좌측 "유사답변서 추천 목록"에 반영되었습니다.';
                    }
                    if (lower.includes("유사사례")) {
                        return '유사사례를 추가로 검색했습니다.\n\n📚 발견된 사례:\n• 2026년 강원특별자치도 출범 시 지방채 인수 추경 사례\n• 2023년 세종시 행정수도 이전 관련 자본사업 추경 사례\n\n비교 참고자료로 "답변서 비교" 탭에서 확인할 수 있습니다.';
                    }
                    if (lower.includes("검색") || lower.includes("찾아") || lower.includes("추천")) {
                        return '요청하신 조건으로 관련 자료를 검색했습니다.\n\n검색 결과 유사도 상위 자료가 좌측 "관련자료 목록"에 갱신되었습니다. 필요한 자료를 선택하시면 초안에 반영할 수 있습니다.';
                    }
                    if (lower.includes("분석") || lower.includes("비교") || lower.includes("확인")) {
                        return "질의 내용을 분석했습니다.\n\n📌 분석 결과:\n• 쟁점: 지방교부세 지급 중에도 추경을 편성하는 이유\n• 핵심 논거: 교부세(일반재원)와 지방채(자본적 지출 목적)는 재원 성격이 다름\n• 보강 필요: 채무비율 관리 계획 언급 시 신뢰도 향상\n\n답변서 초안에 위 논거를 반영했습니다.";
                    }
                    if (lower.includes("다시") || lower.includes("재생성")) {
                        return "답변서 초안을 처음부터 다시 생성했습니다.\n\n이전 버전과 달리 이번 초안은 채무비율 관리 계획을 추가하고, 결론 문단을 간결하게 재구성했습니다. 버전 선택에서 이전 초안과 비교할 수 있습니다.";
                    }
                    if (lower.includes("법적") || lower.includes("근거") || lower.includes("법령")) {
                        return "법적 근거를 보강했습니다.\n\n📖 추가된 근거:\n• 지방재정법 시행령 제11조 (지방채 발행계획 수립)\n• 공공자금관리기금법 시행령 제2조 (기금 운용 근거)\n\n답변서 하단에 근거 법령 각주가 추가되었습니다.";
                    }
                    if (lower.includes("수치") || lower.includes("금리") || lower.includes("금액")) {
                        return '최신 수치를 반영하여 업데이트했습니다.\n\n💰 업데이트 내용:\n• 인수금리: \'26.2분기 기준 3.435%로 갱신\n• 추경 규모: 1,000억 원 → 지자체별 세부 배분 반영\n\n변경된 수치는 "답변서 초안" 탭에서 강조 표시됩니다.';
                    }
                    return '요청하신 내용을 반영하여 답변서 초안을 수정했습니다.\n\n수정 사항은 "답변서 초안" 탭에서 확인하실 수 있으며, 버전 선택 메뉴에서 이전 버전과 비교할 수 있습니다.';
                }

                // 채팅 요청에 따라 관련자료 목록에 신규 항목 추가
                // More 추천자료 추가
                function addMoreRecommendations() {
                    hasChatRecommendationResults = true;
                    const count = Math.min(2, MORE_REC_POOL.length - moreRecSeq);
                    const added = [];
                    let maxId = recommendations.reduce((m, r) => Math.max(m, r.id), 0);
                    for (let i = 0; i < count; i++) {
                        const base = MORE_REC_POOL[moreRecSeq % MORE_REC_POOL.length];
                        moreRecSeq++;
                        const item = { ...base, id: ++maxId, preview: { ...base.preview, sections: base.preview.sections.map((s) => ({ ...s, items: [...s.items] })) } };
                        recommendations.push(item);
                        added.push(item);
                    }
                    // 목록을 유사도순으로 정렬 유지
                    recommendations.sort((a, b) => b.score - a.score);

                    // 탭 카운트 배지 업데이트
                    const tabRec = $("#tabCountRecommend");
                    if (tabRec) tabRec.textContent = recommendations.length;

                    return added;
                }

                // 답변 스켈레톤 표시
                function showAnswerSkeleton(message = "AI 응답 데이터를 불러오고 있습니다...") {
                    hideAnswerSkeleton();
                    const panel = $(".panel-center");
                    if (!panel) return;
                    const overlay = document.createElement("div");
                    overlay.className = "api-skeleton-overlay answer-api-skeleton";
                    overlay.innerHTML = `<div class="skeleton-loading-label">${message}</div><div class="answer-skeleton-columns"><div class="answer-skeleton-list">${Array.from({ length: 4 }, () => '<div class="skeleton-card"><div class="skeleton-card-row"><div class="ai-skeleton skeleton-circle"></div><div class="ai-skeleton skeleton-line lg"></div></div><div class="ai-skeleton skeleton-line full"></div><div class="ai-skeleton skeleton-line md"></div></div>').join("")}</div><div class="answer-skeleton-preview"><div class="ai-skeleton skeleton-line sm"></div>${Array.from({ length: 3 }, () => '<div class="skeleton-card"><div class="ai-skeleton skeleton-line lg"></div><div class="ai-skeleton skeleton-line full"></div><div class="ai-skeleton skeleton-line full"></div><div class="ai-skeleton skeleton-line md"></div></div>').join("")}</div></div>`;
                    panel.appendChild(overlay);
                }

                // 답변 스켈레톤 숨기기
                function hideAnswerSkeleton() {
                    $$(".answer-api-skeleton").forEach((el) => el.remove());
                }

                // 첫 질의로 예시 워크스페이스 채우기
                function populateExampleWorkspaceFromFirstQuery(time) {
                    isReset = false;
                    hasChatRecommendationResults = true;
                    currentTab = "recommend";
                    currentSourceGroup = "all";
                    currentFilter = "all";
                    selectedRec = 0;

                    // 첫 질의 후에는 관련자료를 추천만 하고 자동 선택하지 않습니다.
                    // 사용자가 추천 목록에서 필요한 자료를 직접 선택하면 '선택된 관련자료'에 반영됩니다.
                    selectedRecIds = [];

                    // 새 채팅의 첫 생성 결과는 v1.0 한 건으로 시작
                    const firstDraft = { ...draftVersionExamples[0], time: time || draftVersionExamples[0].time };
                    draftVersions = [firstDraft];
                    activeDraftVersion = 0;
                    draftDisplayMode = "single";
                    draftCompareLeftVersion = 0;
                    draftCompareRightVersion = 0;
                    openDocTabs = [{ id: 0, label: formatDraftVersionTab(firstDraft), versionIdx: 0 }];
                    activeDocTab = 0;

                    const recommendCount = getRecommendedSources("all").length + getReferenceSources("all").length;
                    const recommendTabCount = $("#tabCountRecommend");
                    const draftTabCount = $("#tabCountDraft");
                    const compareTabCount = $("#tabCountCompare");
                    if (recommendTabCount) recommendTabCount.textContent = String(recommendCount);
                    if (draftTabCount) draftTabCount.textContent = "1";
                    if (compareTabCount) compareTabCount.textContent = "1";

                    switchTab("recommend");
                    renderSelectedRefs();
                }

                // 채팅 전송
                function sendChat() {
                    const input = $("#chatInput");
                    const text = input.value.trim();
                    if (!text) return;
                    const runId = workspaceRunSeq;
                    const chatTopicIndex = activeChatTopic;
                    const shouldPopulateExampleWorkspace = isReset;
                    const now = new Date();
                    const time = now.getHours() + ":" + String(now.getMinutes()).padStart(2, "0");
                    chatConversations[chatTopicIndex].push({ role: "user", text, time });
                    renderChatMessages();
                    input.value = "";
                    $("#chatSendBtn").disabled = true;

                    // 상황에 맞는 메시지와 입력 중 표시를 보여줍니다.
                    const msgEl = $("#chatMessages");
                    const lowerText = text.toLowerCase();
                    const isMoreRecRequest = detectMoreRecRequest(lowerText);
                    showAnswerSkeleton(isMoreRecRequest || lowerText.includes("검색") || lowerText.includes("추천") ? "관련자료를 검색하고 있습니다..." : "답변서 초안 데이터를 생성하고 있습니다...");
                    let typingTitle = "생성 중";
                    let typingDesc = "답변서 초안을 생성하고 있습니다...";
                    if (isMoreRecRequest) {
                        typingTitle = "검색 중";
                        typingDesc = "관련 자료를 추가로 검색하고 있습니다...";
                    } else if (lowerText.includes("검색") || lowerText.includes("찾아") || lowerText.includes("추천")) {
                        typingTitle = "검색 중";
                        typingDesc = "관련 자료를 검색하고 있습니다...";
                    } else if (lowerText.includes("분석") || lowerText.includes("비교") || lowerText.includes("확인")) {
                        typingTitle = "분석 중";
                        typingDesc = "AI가 질의를 분석하고 있습니다...";
                    } else if (lowerText.includes("다시") || lowerText.includes("재") || lowerText.includes("수정")) {
                        typingTitle = "재생성 중";
                        typingDesc = "답변서를 다시 생성하고 있습니다...";
                    }
                    const typing = window.ChatMessage.createPending({
                        variant: "answer",
                        title: typingTitle,
                        description: typingDesc,
                    });
                    msgEl.appendChild(typing);
                    scrollChatMessagesToBottom(msgEl, typing);

                    // AI 에이전트 API 연계 지점 ④ 채팅 프롬프트 전송
                    window.AIOneAgentBridge.sendChatPrompt(
                        {
                            prompt: text,
                            chatTopicId: chatTopics[chatTopicIndex]?.id || chatTopicIndex,
                            selectedReferenceSourceIds: [...smartImportedSelectedIds],
                            selectedRelatedSourceIds: [...selectedRecIds],
                        },
                        () => ({ ok: true }),
                        1500,
                    )
                        .then(() => {
                            if (runId !== workspaceRunSeq) {
                                typing.remove();
                                return;
                            }
                            hideAnswerSkeleton();
                            // 입력 중 표시를 제거합니다.
                            typing.remove();

                            if (shouldPopulateExampleWorkspace) {
                                populateExampleWorkspaceFromFirstQuery(time);
                            }

                            if (isMoreRecRequest) {
                                const added = addMoreRecommendations();
                                if (added.length === 0) {
                                    chatConversations[chatTopicIndex].push({ role: "ai", text: "추가로 추천할 수 있는 관련자료가 더 이상 없습니다.", time, typing: true });
                                } else {
                                    chatConversations[chatTopicIndex].push({
                                        role: "ai",
                                        text: `관련자료 ${added.length}건을 추가로 찾았습니다.\n\n📋 추가된 자료:\n${added.map((r) => "• " + r.title + " (유사도 " + r.score + "%)").join("\n")}\n\n"관련자료 추천" 탭의 목록에서 확인·선택할 수 있습니다.`,
                                        time,
                                        typing: true,
                                    });
                                }
                                if (activeChatTopic === chatTopicIndex) renderChatMessages();

                                // 관련자료 추천 탭으로 전환하여 추가된 목록을 바로 확인
                                switchTab("recommend");
                                showToast(`관련자료 ${added.length}건이 추가되었습니다.`);
                                if (window.AIOneNotifications) window.AIOneNotifications.notifyLongTask("관련자료 검색 완료", `관련자료 ${added.length}건이 추가되었습니다.`, "answer");
                                return;
                            }

                            if (shouldPopulateExampleWorkspace) {
                                const relatedCount = getRecommendedSources("all").length;
                                chatConversations[chatTopicIndex].push({
                                    role: "ai",
                                    text: `질의를 분석해 관련자료 ${relatedCount}건을 추천하고 답변서 초안 v1.0을 생성했습니다.\n\n• 관련자료: 유사답변서와 참고자료 예시\n• 답변서 초안: 질의 요지, 답변 요약, 제도 개요와 근거자료 반영\n\n중앙의 “관련자료”와 “답변서 초안” 탭에서 결과를 확인할 수 있습니다.`,
                                    time,
                                    typing: true,
                                });
                                if (activeChatTopic === chatTopicIndex) renderChatMessages();
                                showToast("관련자료와 답변서 초안 예시가 생성되었습니다.");
                                if (window.AIOneNotifications) window.AIOneNotifications.notifyLongTask("답변서 초안 생성 완료", "관련자료와 답변서 초안 v1.0이 생성되었습니다.", "answer");
                                return;
                            }

                            chatConversations[chatTopicIndex].push({ role: "ai", text: generateDraftEditResponse(text), time, typing: true });
                            if (activeChatTopic === chatTopicIndex) renderChatMessages();
                            // 새 초안 버전을 생성합니다.
                            const vNum = draftVersions.length + 1;
                            const vLabel = "v1." + draftVersions.length;
                            draftVersions.push({ id: vNum, label: vLabel, time: time, note: "AI 채팅 수정사항 반영", content: draftContent });
                            activeDraftVersion = draftVersions.length - 1;
                            draftCompareRightVersion = activeDraftVersion;
                            draftCompareLeftVersion = Math.max(0, activeDraftVersion - 1);
                            openDraftVersionTab(activeDraftVersion);
                            renderDocTabs();
                            // 초안 탭에 있으면 버전 선택 상자를 갱신합니다.
                            const vSelect = $("#versionSelect");
                            if (vSelect) {
                                const opt = document.createElement("option");
                                opt.value = activeDraftVersion;
                                opt.textContent = formatDraftVersionTab(draftVersions[activeDraftVersion]);
                                opt.selected = true;
                                vSelect.appendChild(opt);
                            }
                            showToast("답변서 초안 " + vLabel + "이 생성되었습니다.");
                            if (window.AIOneNotifications) window.AIOneNotifications.notifyLongTask("답변서 초안 생성 완료", "답변서 초안 " + vLabel + "이 생성되었습니다.", "answer");
                        })
                        .catch((error) => {
                            if (runId !== workspaceRunSeq) {
                                typing.remove();
                                return;
                            }
                            console.error("[AI-ONE] 채팅 프롬프트 API 오류", error);
                            hideAnswerSkeleton();
                            typing.remove();
                            showToast("AI 응답 생성 중 오류가 발생했습니다. 다시 시도해 주세요.");
                        });
                }

                /* ============================ 끝: 보고서 파일과 채팅 응답 ============================== */

                /* ============================ 시작: 중앙 분할 크기 조절 ============================ */
                // 중앙 분할 크기 조절 초기화
                function initCenterSplitResize() {
                    const split = $("#centerSplitHandle")?.closest('[data-component="split-handler"]');
                    if (split) window.AIOneSplitHandler?.init(split);
                }

                /* ============================ 끝: 중앙 분할 크기 조절 ============================== */

                /* ============================ 시작: 패널 배치와 크기 조절 ============================ */
                const LAYOUT_KEY = "panel-layout-answer-after-9-v13";
                const DEFAULT_PANEL_ORDER = ["folder", "center", "chat"];
                const PANEL_MIN_WIDTHS = { folder: 280, center: 220, chat: 280 };

                // 패널 트랙 최대 너비 조회
                function getTrackMaxWidth(value, fallback) {
                    const trackWidths = String(value || "")
                        .match(/\d+(?:\.\d+)?px/g)
                        ?.map((width) => Number.parseFloat(width))
                        .filter(Number.isFinite);
                    return trackWidths?.at(-1) || fallback;
                }

                // 기본 패널 너비 조회
                function getDefaultPanelWidths(container = $(ANSWER_PANEL_SELECTOR)) {
                    const styles = container ? getComputedStyle(container) : null;
                    return {
                        folder: getTrackMaxWidth(styles?.getPropertyValue("--three-panel-left-width"), 280),
                        chat: getTrackMaxWidth(styles?.getPropertyValue("--three-panel-right-width"), 360),
                    };
                }

                // Responsive 답변 Mode 상태 확인
                function isResponsiveAnswerMode() {
                    return window.matchMedia("(max-width: 1024px)").matches;
                }

                // Responsive 답변 패널 Styles 정리
                function clearResponsiveAnswerPanelStyles(container = $(ANSWER_PANEL_SELECTOR)) {
                    if (!container) return;
                    container.style.gridTemplateColumns = "";
                    getPanels(container).forEach((panel) => {
                        panel.style.width = "";
                        panel.style.maxWidth = "";
                        panel.style.minWidth = "";
                        panel.style.flex = "";
                    });
                    compareAutoCollapsedLeftPanel = false;
                }

                // 패널 식별 키 조회
                function getPanelKey(panel, index = 0) {
                    if (!panel) return `panel-${index}`;
                    if (panel.dataset?.panel) return panel.dataset.panel;
                    if (panel.dataset.slot === "left" || panel.classList.contains("panel-left")) return "folder";
                    if (panel.classList.contains("panel-center")) return "center";
                    if (panel.classList.contains("panel-right")) return "chat";
                    return panel.id || `panel-${index}`;
                }

                // 패널 조회
                function getPanels(container = $(ANSWER_PANEL_SELECTOR)) {
                    return container ? Array.from(container.children).filter((element) => element.matches(".panel[data-slot]")) : [];
                }

                // 패널 핸들 조회
                function getPanelHandles(container = $(ANSWER_PANEL_SELECTOR)) {
                    return container ? Array.from(container.querySelectorAll(":scope > .panel-resize-handle")) : [];
                }

                // 패널 최소 너비 조회
                function getPanelMinWidth(panel, key) {
                    if (panel?.classList.contains("panel-collapsed")) return 44;
                    return PANEL_MIN_WIDTHS[key] || 140;
                }

                // 사용 가능 패널 너비 조회
                function getAvailablePanelWidth(container) {
                    if (!container) return 0;
                    const style = getComputedStyle(container);
                    const horizontalPadding = parseFloat(style.paddingLeft || 0) + parseFloat(style.paddingRight || 0);
                    const handleWidth = getPanelHandles(container).reduce((sum, handle) => sum + handle.getBoundingClientRect().width, 0);
                    return Math.max(0, container.clientWidth - horizontalPadding - handleWidth);
                }

                // fit 패널 너비 동작 처리
                function fitPanelWidths(container, order, widthsByPanel) {
                    const panelMap = new Map();
                    getPanels(container).forEach((panel, index) => panelMap.set(getPanelKey(panel, index), panel));

                    const mins = order.map((key) => getPanelMinWidth(panelMap.get(key), key));
                    const widths = order.map((key, index) => Math.max(mins[index], Math.round(Number(widthsByPanel?.[key]) || mins[index])));
                    const available = getAvailablePanelWidth(container);
                    let delta = Math.round(available - widths.reduce((sum, width) => sum + width, 0));
                    const flexibleIndex = Math.max(0, order.indexOf("center"));

                    if (delta > 0) {
                        widths[flexibleIndex] += delta;
                    } else if (delta < 0) {
                        let deficit = -delta;
                        const shrinkOrder = [flexibleIndex, ...widths.map((_, index) => index).filter((index) => index !== flexibleIndex)];
                        shrinkOrder.forEach((index) => {
                            if (deficit <= 0) return;
                            const reducible = Math.max(0, widths[index] - mins[index]);
                            const reduction = Math.min(deficit, reducible);
                            widths[index] -= reduction;
                            deficit -= reduction;
                        });
                    }

                    return widths;
                }

                // 현재 패널 레이아웃 상태 조회
                function getCurrentPanelLayoutState(container = $(ANSWER_PANEL_SELECTOR)) {
                    if (!container) return null;
                    const panels = getPanels(container);
                    const widthsByPanel = {};
                    const order = panels.map((panel, index) => {
                        const key = getPanelKey(panel, index);
                        widthsByPanel[key] = Math.round(panel.getBoundingClientRect().width);
                        return key;
                    });
                    return { order, widthsByPanel };
                }

                // 패널 너비 적용
                function applyPanelWidths(container, widths) {
                    if (!container || !Array.isArray(widths) || widths.length !== 3) return;
                    if (isResponsiveAnswerMode()) {
                        clearResponsiveAnswerPanelStyles(container);
                        return;
                    }
                    const panels = getPanels(container);
                    const panelTracks = widths.map((width, index) => (getPanelKey(panels[index], index) === "center" ? "minmax(0, 1fr)" : `${Math.round(width)}px`));
                    container.style.gridTemplateColumns = panelTracks.flatMap((track, index) => (index < panelTracks.length - 1 ? [track, "2px"] : [track])).join(" ");
                }

                // 패널 레이아웃 상태 적용
                function applyPanelLayoutState(container, state) {
                    if (!container || !state || !Array.isArray(state.order) || state.order.length !== 3) return;

                    const handles = getPanelHandles(container);
                    const panelMap = new Map();
                    getPanels(container).forEach((panel, index) => panelMap.set(getPanelKey(panel, index), panel));
                    const orderedPanels = state.order.map((key) => panelMap.get(key)).filter(Boolean);
                    if (orderedPanels.length !== panelMap.size) return;

                    while (container.firstChild) container.removeChild(container.firstChild);
                    orderedPanels.forEach((panel, index) => {
                        container.appendChild(panel);
                        if (index < orderedPanels.length - 1 && handles[index]) container.appendChild(handles[index]);
                    });

                    if (isResponsiveAnswerMode()) {
                        clearResponsiveAnswerPanelStyles(container);
                        return;
                    }

                    const pageDefaultWidths = getDefaultPanelWidths(container);
                    const pageWidths = {
                        ...(state.widthsByPanel || {}),
                        chat: pageDefaultWidths.chat,
                    };
                    const widths = fitPanelWidths(container, state.order, pageWidths);
                    applyPanelWidths(container, widths);
                }

                // 패널 레이아웃 상태 저장
                function savePanelLayoutState(container = $(ANSWER_PANEL_SELECTOR)) {
                    if (isResponsiveAnswerMode() || smartTemporaryLayoutActive) return;
                    const state = getCurrentPanelLayoutState(container);
                    if (state) localStorage.setItem(LAYOUT_KEY, JSON.stringify(state));
                }

                // 패널 레이아웃 상태 복원
                function restorePanelLayoutState(container = $(ANSWER_PANEL_SELECTOR)) {
                    if (!container) return;
                    if (isResponsiveAnswerMode()) {
                        clearResponsiveAnswerPanelStyles(container);
                        return;
                    }
                    const saved = localStorage.getItem(LAYOUT_KEY);
                    if (!saved) return;
                    try {
                        applyPanelLayoutState(container, JSON.parse(saved));
                    } catch (e) {
                        localStorage.removeItem(LAYOUT_KEY);
                    }
                }

                // 기본 패널 레이아웃 상태 조회
                function getDefaultPanelLayoutState(container = $(ANSWER_PANEL_SELECTOR)) {
                    const available = getAvailablePanelWidth(container);
                    const defaultWidths = getDefaultPanelWidths(container);
                    const centerWidth = Math.max(PANEL_MIN_WIDTHS.center, available - defaultWidths.folder - defaultWidths.chat);
                    return {
                        order: [...DEFAULT_PANEL_ORDER],
                        widthsByPanel: { folder: defaultWidths.folder, center: centerWidth, chat: defaultWidths.chat },
                    };
                }

                // 패널 접힘 UI 상태 동기화
                function syncPanelCollapsedUi(panel, shouldCollapse) {
                    panel.classList.toggle("panel-collapsed", shouldCollapse);
                    panel.querySelector(".file-list-section")?.classList.toggle("is-collapsed", shouldCollapse);

                    const collapseButton = panel.querySelector(".panel-collapse-btn");
                    const collapseLabel = shouldCollapse ? "패널 펼치기" : "패널 접기";
                    collapseButton?.setAttribute("aria-expanded", String(!shouldCollapse));
                    collapseButton?.setAttribute("aria-label", collapseLabel);
                    if (collapseButton) collapseButton.title = collapseLabel;
                }

                // 패널 접힘 상태 설정
                function setPanelCollapsed(panel, shouldCollapse) {
                    const container = $(ANSWER_PANEL_SELECTOR);
                    if (!panel || !container) return;

                    if (isResponsiveAnswerMode()) {
                        syncPanelCollapsedUi(panel, shouldCollapse);
                        return;
                    }

                    const state = getCurrentPanelLayoutState(container);
                    if (!state) return;
                    const key = getPanelKey(panel);
                    const defaultWidths = getDefaultPanelWidths(container);

                    if (shouldCollapse) {
                        if (!panel.classList.contains("panel-collapsed")) {
                            panel.dataset.expandedPanelWidth = String(state.widthsByPanel[key] || defaultWidths[key] || 220);
                        }
                        state.widthsByPanel[key] = 44;
                    } else {
                        state.widthsByPanel[key] = PANEL_MIN_WIDTHS[key] || 140;
                        delete panel.dataset.expandedPanelWidth;
                    }

                    syncPanelCollapsedUi(panel, shouldCollapse);

                    applyPanelLayoutState(container, state);
                    savePanelLayoutState(container);
                }

                // 패널 순환
                function rotatePanels() {
                    const container = $(ANSWER_PANEL_SELECTOR);
                    const state = getCurrentPanelLayoutState(container);
                    if (!state) return;
                    const nextOrder = [...state.order.slice(1), state.order[0]];
                    applyPanelLayoutState(container, { order: nextOrder, widthsByPanel: state.widthsByPanel });
                    savePanelLayoutState(container);
                    showToast("패널 위치가 변경되었습니다.");
                }

                // 패널 레이아웃 초기화
                function resetPanelLayout() {
                    const container = $(ANSWER_PANEL_SELECTOR);
                    if (!container) return;

                    localStorage.removeItem(LAYOUT_KEY);
                    getPanels(container).forEach((panel) => {
                        syncPanelCollapsedUi(panel, false);
                    });
                    applyPanelLayoutState(container, getDefaultPanelLayoutState(container));
                    showToast("레이아웃이 기본값으로 초기화되었습니다.");
                }

                // Accessory 동작 처리
                function handleAccessoryAction(event) {
                    if (event.detail?.action === "swap") rotatePanels();
                    else if (event.detail?.action === "layout") resetPanelLayout();
                }

                /* ============================ 끝: 패널 배치와 크기 조절 ============================== */

                /* ============================ 시작: 패널 드래그 앤 드롭 ============================ */
                // 패널 드래그 드롭 초기화
                function initPanelDragDrop() {
                    const container = $(ANSWER_PANEL_SELECTOR);
                    if (!container) return;
                    const interactiveSelector = "button, input, select, textarea, a, label, [contenteditable], [role='button'], [role='tab']";

                    getPanels(container).forEach((panel) => {
                        const dragHandle = panel.querySelector(":scope > .panel-head, :scope > .center-header");
                        if (!dragHandle) return;

                        dragHandle.style.cursor = "grab";
                        dragHandle.style.touchAction = "none";
                        panel.querySelectorAll(".panel-title, .center-header-title").forEach((title) => title.removeAttribute("draggable"));

                        dragHandle.addEventListener("pointerdown", (event) => {
                            if (event.button !== 0 || event.target.closest(interactiveSelector)) return;

                            const pointerId = event.pointerId;
                            const startX = event.clientX;
                            const startY = event.clientY;
                            let isDragging = false;
                            let targetPanel = null;

                            const clearDragState = () => {
                                panel.style.removeProperty("opacity");
                                dragHandle.style.cursor = "grab";
                                document.body.style.userSelect = "";
                                getPanels(container).forEach((item) => item.classList.remove("drag-over"));
                            };

                            const onPointerMove = (moveEvent) => {
                                if (moveEvent.pointerId !== pointerId) return;
                                if (!isDragging && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 6) return;

                                isDragging = true;
                                moveEvent.preventDefault();
                                panel.style.opacity = "0.5";
                                dragHandle.style.cursor = "grabbing";
                                document.body.style.userSelect = "none";

                                const hoveredPanel = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest(".panel");
                                targetPanel = hoveredPanel?.parentElement === container && hoveredPanel !== panel ? hoveredPanel : null;
                                getPanels(container).forEach((item) => item.classList.toggle("drag-over", item === targetPanel));
                            };

                            const onPointerEnd = (endEvent) => {
                                if (endEvent.pointerId !== pointerId) return;
                                document.removeEventListener("pointermove", onPointerMove);
                                document.removeEventListener("pointerup", onPointerEnd);
                                document.removeEventListener("pointercancel", onPointerEnd);

                                const dropTarget = endEvent.type === "pointerup" ? targetPanel : null;
                                clearDragState();
                                if (!isDragging || !dropTarget) return;

                                const state = getCurrentPanelLayoutState(container);
                                const nextOrder = [...state.order];
                                const dragIndex = nextOrder.indexOf(getPanelKey(panel));
                                const targetIndex = nextOrder.indexOf(getPanelKey(dropTarget));
                                if (dragIndex < 0 || targetIndex < 0 || dragIndex === targetIndex) return;
                                [nextOrder[dragIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[dragIndex]];

                                applyPanelLayoutState(container, { order: nextOrder, widthsByPanel: state.widthsByPanel });
                                savePanelLayoutState(container);
                                showToast("패널 위치가 변경되었습니다.");
                            };

                            document.addEventListener("pointermove", onPointerMove, { passive: false });
                            document.addEventListener("pointerup", onPointerEnd);
                            document.addEventListener("pointercancel", onPointerEnd);
                        });
                    });
                }

                /* ============================ 끝: 패널 드래그 앤 드롭 ============================== */

                /* ============================ 시작: 패널 크기 조절 ============================ */
                // 패널 크기 조절 초기화
                function initPanelResize() {
                    const container = $(ANSWER_PANEL_SELECTOR);
                    if (!container) return;
                    restorePanelLayoutState(container);
                    window.AIOneSplitHandler?.init(container);

                    // 저장된 Or 기본 패널 레이아웃 적용
                    const applySavedOrDefaultPanelLayout = () => {
                        const saved = localStorage.getItem(LAYOUT_KEY);
                        if (saved) {
                            try {
                                applyPanelLayoutState(container, JSON.parse(saved));
                                return;
                            } catch (e) {
                                localStorage.removeItem(LAYOUT_KEY);
                            }
                        }
                        applyPanelLayoutState(container, getDefaultPanelLayoutState(container));
                    };

                    let activeResizePointer = null;
                    container.addEventListener("pointerdown", (event) => {
                        const handle = event.target.closest(".panel-resize-handle");
                        if (!handle || handle.parentElement !== container || isResponsiveAnswerMode()) return;
                        activeResizePointer = event.pointerId;
                    });
                    // 공통 크기 조절 저장
                    const persistSharedResize = (event) => {
                        if (event.pointerId !== activeResizePointer) return;
                        activeResizePointer = null;
                        savePanelLayoutState(container);
                    };
                    document.addEventListener("pointerup", persistSharedResize);
                    document.addEventListener("pointercancel", persistSharedResize);
                    container.addEventListener("keyup", (event) => {
                        if (event.target.matches(".panel-resize-handle") && ["ArrowLeft", "ArrowRight"].includes(event.key)) savePanelLayoutState(container);
                    });

                    let lastContainerWidth = container.clientWidth;
                    let wasResponsive = isResponsiveAnswerMode();
                    if (wasResponsive) clearResponsiveAnswerPanelStyles(container);

                    window.addEventListener("pageshow", (event) => {
                        if (!event.persisted) return;
                        window.requestAnimationFrame(() => {
                            if (!container.isConnected || container.clientWidth <= 0) return;
                            if (isResponsiveAnswerMode()) {
                                clearResponsiveAnswerPanelStyles(container);
                                syncAnswerCompareScrollMode(container);
                                wasResponsive = true;
                            } else {
                                syncAnswerCompareScrollMode(container);
                                applySavedOrDefaultPanelLayout();
                                wasResponsive = false;
                            }
                            lastContainerWidth = container.clientWidth;
                        });
                    });

                    if ("ResizeObserver" in window) {
                        const observer = new ResizeObserver(() => {
                            if (document.visibilityState === "hidden" || container.clientWidth <= 0) return;
                            const responsive = isResponsiveAnswerMode();
                            if (responsive) {
                                if (!wasResponsive) syncAnswerCompareScrollMode(container);
                                clearResponsiveAnswerPanelStyles(container);
                                lastContainerWidth = container.clientWidth;
                                wasResponsive = true;
                                return;
                            }

                            if (wasResponsive) {
                                wasResponsive = false;
                                syncAnswerCompareScrollMode(container);
                                applySavedOrDefaultPanelLayout();
                                lastContainerWidth = container.clientWidth;
                                return;
                            }

                            if (container.clientWidth === lastContainerWidth) return;
                            lastContainerWidth = container.clientWidth;
                            const state = getCurrentPanelLayoutState(container);
                            if (!state) return;
                            applyPanelLayoutState(container, state);
                        });
                        observer.observe(container);
                    }
                }

                /* ============================ 끝: 패널 크기 조절 ============================== */

                /* ============================ 시작: 답변서 버전 바 ============================ */
                let openDocTabs = [{ id: 0, label: formatDraftVersionTab(draftVersions[0]), versionIdx: 0 }];
                let activeDocTab = 0;

                // 초안 버전 바 Template 복제
                function cloneDraftVersionBarTemplate() {
                    return cloneAfterPrototype("draftVersionBarPrototype");
                }

                // mount 초안 버전 바 동작 처리
                function mountDraftVersionBar(container) {
                    const slot = $("[data-draft-version-bar-slot]", container);
                    const versionBar = cloneDraftVersionBarTemplate();
                    if (!slot || !versionBar) return;
                    slot.replaceWith(versionBar);
                }

                // 다음 초안 탭 ID 조회
                function getNextDraftTabId() {
                    return openDocTabs.reduce((maxId, tab) => Math.max(maxId, tab.id), -1) + 1;
                }

                // 초안 버전 탭 열기
                function openDraftVersionTab(versionIdx) {
                    const version = draftVersions[versionIdx];
                    if (!version) return;

                    const existing = openDocTabs.find((tab) => tab.versionIdx === versionIdx);
                    if (existing) {
                        activeDocTab = existing.id;
                    } else {
                        const newTab = {
                            id: getNextDraftTabId(),
                            label: formatDraftVersionTab(version),
                            versionIdx,
                        };
                        openDocTabs.push(newTab);
                        activeDocTab = newTab.id;
                    }
                    activeDraftVersion = versionIdx;
                }

                // 초안 편집기 HTML 조회
                function getDraftEditorInnerHtml(version) {
                    const source = version?.content || draftContent;
                    const holder = document.createElement("div");
                    holder.innerHTML = source;
                    return holder.querySelector(".draft-editor")?.innerHTML || source;
                }

                // 초안 버전 비교 렌더링
                function renderDraftVersionCompare(body) {
                    if (!body || draftVersions.length < 2) return;
                    draftCompareLeftVersion = Math.max(0, Math.min(draftCompareLeftVersion, draftVersions.length - 1));
                    draftCompareRightVersion = Math.max(0, Math.min(draftCompareRightVersion, draftVersions.length - 1));
                    if (draftCompareLeftVersion === draftCompareRightVersion) draftCompareRightVersion = draftCompareLeftVersion === 0 ? 1 : 0;

                    const leftVersion = draftVersions[draftCompareLeftVersion];
                    const rightVersion = draftVersions[draftCompareRightVersion];
                    // 선택 옵션 HTML 구성
                    const optionHtml = (selectedIndex) => draftVersions.map((version, index) => `<option value="${index}"${index === selectedIndex ? " selected" : ""}>${formatDraftVersionTab(version)}</option>`).join("");

                    body.innerHTML = `<div class="draft-version-compare" id="draftVersionCompare">
      <div class="draft-compare-toolbar">
        <div class="draft-compare-toolbar-title">
          <strong>초안 버전 비교</strong>
          <span class="draft-compare-help">비교할 초안 버전을 각각 선택하면 두 버전의 내용을 나란히 확인할 수 있습니다.</span>
          <span class="api-direct-chip ready" id="draftCompareApiStatus">AI 분석완료</span>
        </div>
        <div class="draft-compare-controls">
          <div class="draft-compare-select-wrap"><span class="draft-compare-select-label">기준</span><select class="draft-compare-select" id="draftCompareLeftSelect" aria-label="기준 초안 버전 선택">${optionHtml(draftCompareLeftVersion)}</select></div>
          <button class="draft-compare-swap" id="draftCompareSwap" type="button" aria-label="기준 버전과 비교 버전 좌우 바꾸기" title="기준/비교 버전 좌우 바꾸기"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 7h11"/><path d="m15 4 3 3-3 3"/><path d="M17 17H6"/><path d="m9 14-3 3 3 3"/></svg></button>
          <div class="draft-compare-select-wrap"><span class="draft-compare-select-label">비교</span><select class="draft-compare-select" id="draftCompareRightSelect" aria-label="비교 초안 버전 선택">${optionHtml(draftCompareRightVersion)}</select></div>
          <label class="draft-compare-sync" title="한쪽 문서를 스크롤하면 다른 문서도 같은 비율로 이동합니다."><input type="checkbox" id="draftCompareSync" checked /><span>스크롤 동기화</span></label>
          <button class="draft-compare-toggle active" id="draftCompareClose" type="button">단일 보기</button>
        </div>
      </div>
      <div class="draft-compare-grid">
        <section class="draft-compare-pane" data-compare-side="left">
          <div class="draft-compare-pane-head"><div class="draft-compare-pane-meta"><span class="draft-compare-pane-kicker">기준 버전</span><div class="draft-compare-pane-title">${escapeHtml(formatDraftVersionTab(leftVersion))}</div><div class="draft-compare-pane-note">${escapeHtml(leftVersion?.note || "버전 메모 없음")}</div></div><span class="draft-compare-badge">기준</span></div>
          <div class="draft-editor draft-compare-editor" id="draftCompareLeftEditor" contenteditable="false">${getDraftEditorInnerHtml(leftVersion)}</div>
        </section>
        <section class="draft-compare-pane" data-compare-side="right">
          <div class="draft-compare-pane-head"><div class="draft-compare-pane-meta"><span class="draft-compare-pane-kicker">비교 버전</span><div class="draft-compare-pane-title">${escapeHtml(formatDraftVersionTab(rightVersion))}</div><div class="draft-compare-pane-note">${escapeHtml(rightVersion?.note || "버전 메모 없음")}</div></div><span class="draft-compare-badge">비교</span></div>
          <div class="draft-editor draft-compare-editor" id="draftCompareRightEditor" contenteditable="false">${getDraftEditorInnerHtml(rightVersion)}</div>
        </section>
      </div>
      <div class="draft-compare-status">
        <div class="draft-compare-status-left"><span>기준 <strong>${escapeHtml(formatDraftVersionTab(leftVersion))}</strong></span><span class="draft-compare-divider">|</span><span>비교 <strong>${escapeHtml(formatDraftVersionTab(rightVersion))}</strong></span><span class="draft-compare-divider">|</span><span>버전 메모를 함께 확인할 수 있습니다.</span></div>
        <div class="draft-compare-status-right">
          <button class="icon-button icon-button-sm document-statusbar-button" id="draftCompareZoomOut" type="button" aria-label="비교 화면 축소">−</button><strong class="document-statusbar-zoom" id="draftCompareZoomVal">100%</strong><button class="icon-button icon-button-sm document-statusbar-button" id="draftCompareZoomIn" type="button" aria-label="비교 화면 확대">＋</button>
          <button class="icon-button icon-button-sm document-statusbar-button" id="draftCompareFullscreen" type="button" aria-label="버전 비교 전체보기" title="버전 비교 전체보기"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M3 3h5v2H5v3H3V3z M16 3h5v5h-2V5h-3V3z M3 16h2v3h3v2H3v-5z M19 19h-3v2h5v-5h-2v3z"/></svg></button>
        </div>
      </div>
    </div>`;
                    initDraftVersionCompare();
                }

                // 초안 버전 비교 초기화
                function initDraftVersionCompare() {
                    const leftSelect = $("#draftCompareLeftSelect");
                    const rightSelect = $("#draftCompareRightSelect");
                    const leftEditor = $("#draftCompareLeftEditor");
                    const rightEditor = $("#draftCompareRightEditor");
                    const syncCheck = $("#draftCompareSync");
                    const root = $("#draftVersionCompare");
                    if (!leftSelect || !rightSelect || !leftEditor || !rightEditor || !root) return;

                    leftSelect.addEventListener("change", async () => {
                        const next = Number.parseInt(leftSelect.value, 10);
                        if (!Number.isInteger(next) || !draftVersions[next]) return;
                        let right = draftCompareRightVersion;
                        if (next === right) {
                            const fallback = draftVersions.findIndex((_, index) => index !== next);
                            if (fallback >= 0) right = fallback;
                        }
                        if (await requestDraftComparePair(next, right)) switchTab("draft");
                    });
                    rightSelect.addEventListener("change", async () => {
                        const next = Number.parseInt(rightSelect.value, 10);
                        if (!Number.isInteger(next) || !draftVersions[next]) return;
                        let left = draftCompareLeftVersion;
                        if (next === left) {
                            const fallback = draftVersions.findIndex((_, index) => index !== next);
                            if (fallback >= 0) left = fallback;
                        }
                        if (await requestDraftComparePair(left, next)) switchTab("draft");
                    });
                    $("#draftCompareSwap")?.addEventListener("click", async (event) => {
                        const button = event.currentTarget;
                        if (button.disabled) return;
                        const previousLeft = draftCompareLeftVersion;
                        const previousRight = draftCompareRightVersion;
                        const nextLeft = previousRight;
                        const nextRight = previousLeft;
                        button.disabled = true;
                        leftSelect.value = String(nextLeft);
                        rightSelect.value = String(nextRight);
                        const ok = await requestDraftComparePair(nextLeft, nextRight);
                        if (ok) {
                            switchTab("draft");
                        } else {
                            leftSelect.value = String(previousLeft);
                            rightSelect.value = String(previousRight);
                            button.disabled = false;
                        }
                    });
                    $("#draftCompareClose")?.addEventListener("click", () => {
                        draftDisplayMode = "single";
                        activeDraftVersion = draftCompareRightVersion;
                        openDraftVersionTab(activeDraftVersion);
                        switchTab("draft");
                    });

                    let syncing = false;
                    // 스크롤 동기화
                    const syncScroll = (source, target) => {
                        if (syncing || !syncCheck?.checked) return;
                        const sourceMax = Math.max(1, source.scrollHeight - source.clientHeight);
                        const targetMax = Math.max(0, target.scrollHeight - target.clientHeight);
                        syncing = true;
                        target.scrollTop = (source.scrollTop / sourceMax) * targetMax;
                        requestAnimationFrame(() => {
                            syncing = false;
                        });
                    };
                    leftEditor.addEventListener("scroll", () => syncScroll(leftEditor, rightEditor), { passive: true });
                    rightEditor.addEventListener("scroll", () => syncScroll(rightEditor, leftEditor), { passive: true });

                    let zoom = 1;
                    // 확대/축소 적용
                    const applyZoom = () => {
                        [leftEditor, rightEditor].forEach((editor) => (editor.style.fontSize = `calc(${12 * zoom}px * var(--ui-font-scale))`));
                        const value = $("#draftCompareZoomVal");
                        if (value) value.textContent = `${Math.round(zoom * 100)}%`;
                    };
                    $("#draftCompareZoomOut")?.addEventListener("click", () => {
                        zoom = Math.max(0.8, +(zoom - 0.1).toFixed(1));
                        applyZoom();
                    });
                    $("#draftCompareZoomIn")?.addEventListener("click", () => {
                        zoom = Math.min(1.5, +(zoom + 0.1).toFixed(1));
                        applyZoom();
                    });
                    $("#draftCompareFullscreen")?.addEventListener("click", () => {
                        root.classList.toggle("is-fullscreen");
                        showToast(root.classList.contains("is-fullscreen") ? "전체보기 모드입니다. ESC 키를 누르면 종료됩니다." : "전체보기를 종료했습니다.");
                    });
                    root.addEventListener("keydown", (event) => {
                        if (event.key === "Escape" && root.classList.contains("is-fullscreen")) {
                            root.classList.remove("is-fullscreen");
                            showToast("전체보기를 종료했습니다.");
                        }
                    });
                }

                // 초안 버전 바 초기화
                function initDraftVersionBar() {
                    const activeVersion = draftVersions[activeDraftVersion] || draftVersions[0];
                    const activeOpenTab = openDocTabs.find((tab) => tab.versionIdx === activeDraftVersion);
                    if (!activeOpenTab && activeVersion) openDraftVersionTab(activeDraftVersion);

                    renderDocTabs();
                    bindDraftTabScroller();

                    const versionSelect = $("#versionSelect");
                    if (versionSelect) {
                        const options = draftVersions.map((version, index) => {
                            const option = document.createElement("option");
                            option.value = String(index);
                            option.textContent = formatDraftVersionTab(version);
                            option.selected = index === activeDraftVersion;
                            return option;
                        });
                        versionSelect.replaceChildren(...options);
                        versionSelect.value = String(activeDraftVersion);
                        versionSelect.addEventListener("change", () => {
                            const idx = Number.parseInt(versionSelect.value, 10);
                            if (!Number.isInteger(idx) || !draftVersions[idx]) return;
                            openDraftVersionTab(idx);
                            switchTab("draft");
                        });
                    }

                    const compareBtn = $("#draftCompareBtn");
                    if (compareBtn) {
                        compareBtn.addEventListener("click", () => {
                            if (draftVersions.length < 2) {
                                showToast("비교할 초안 버전이 2개 이상 필요합니다.");
                                return;
                            }
                            draftCompareLeftVersion = Math.min(activeDraftVersion, draftVersions.length - 1);
                            draftCompareRightVersion = draftCompareLeftVersion === 0 ? 1 : Math.max(0, draftCompareLeftVersion - 1);
                            draftDisplayMode = "compare";
                            switchTab("draft");
                        });
                    }

                    const downloadBtn = $("#verifyDownloadBtn");
                    if (downloadBtn) {
                        downloadBtn.addEventListener("click", () => {
                            const version = draftVersions[activeDraftVersion];
                            showToast(`${formatDraftVersionTab(version)} 답변서 초안을 다운로드합니다.`);
                        });
                    }
                }

                // 문서 탭 렌더링
                function renderDocTabs() {
                    const container = $("#draftDocTabs");
                    if (!container) return;

                    container.innerHTML = openDocTabs
                        .map((tab) => {
                            const version = draftVersions[tab.versionIdx];
                            const label = version ? formatDraftVersionTab(version) : tab.label;
                            const safeLabel = escapeHtml(label);
                            return `<div class="draft-doc-tab${tab.id === activeDocTab ? " active" : ""}" data-dtab="${tab.id}" title="${safeLabel}">
        <button class="draft-doc-tab-open" data-dtab-open="${tab.id}" type="button" aria-label="${safeLabel} 버전 열기"><span class="draft-doc-tab-label">${safeLabel}</span></button>
        <button class="draft-doc-tab-close" data-dtab-close="${tab.id}" type="button" aria-label="${safeLabel} 탭 닫기">×</button>
      </div>`;
                        })
                        .join("");

                    bindDocTabEvents();
                    requestAnimationFrame(() => {
                        container.querySelector(".draft-doc-tab.active")?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
                        updateDraftTabScrollButtons();
                    });
                }

                // 문서 탭 이벤트 연결
                function bindDocTabEvents() {
                    const container = $("#draftDocTabs");
                    if (!container || container.dataset.draftTabEventsBound === "true") return;
                    container.dataset.draftTabEventsBound = "true";

                    container.addEventListener("click", (event) => {
                        const closeButton = event.target.closest("[data-dtab-close]");
                        if (closeButton) {
                            const id = Number.parseInt(closeButton.dataset.dtabClose, 10);
                            if (openDocTabs.length <= 1) {
                                showToast("최소 한 개의 버전 탭은 열어 두어야 합니다.");
                                return;
                            }

                            const closingTab = openDocTabs.find((tab) => tab.id === id);
                            openDocTabs = openDocTabs.filter((tab) => tab.id !== id);

                            if (activeDocTab === id) {
                                const nextTab = openDocTabs[openDocTabs.length - 1];
                                activeDocTab = nextTab.id;
                                activeDraftVersion = nextTab.versionIdx;
                                switchTab("draft");
                                return;
                            }

                            if (closingTab?.versionIdx === activeDraftVersion) {
                                const activeTab = openDocTabs.find((tab) => tab.id === activeDocTab) || openDocTabs[0];
                                activeDraftVersion = activeTab.versionIdx;
                            }
                            renderDocTabs();
                            return;
                        }

                        const openButton = event.target.closest("[data-dtab-open]");
                        if (!openButton) return;
                        const tabId = Number.parseInt(openButton.dataset.dtabOpen, 10);
                        const selectedTab = openDocTabs.find((item) => item.id === tabId);
                        if (!selectedTab) return;
                        activeDocTab = selectedTab.id;
                        activeDraftVersion = selectedTab.versionIdx;
                        switchTab("draft");
                    });
                }

                // 초안 탭 스크롤 이벤트 연결
                function bindDraftTabScroller() {
                    const container = $("#draftDocTabs");
                    const prevButton = $("#draftTabsPrev");
                    const nextButton = $("#draftTabsNext");
                    if (!container || !prevButton || !nextButton) return;

                    prevButton.addEventListener("click", () => container.scrollBy({ left: -240, behavior: "smooth" }));
                    nextButton.addEventListener("click", () => container.scrollBy({ left: 240, behavior: "smooth" }));

                    container.addEventListener("scroll", updateDraftTabScrollButtons, { passive: true });
                    container.addEventListener(
                        "wheel",
                        (event) => {
                            if (container.scrollWidth <= container.clientWidth) return;
                            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
                            event.preventDefault();
                            container.scrollLeft += event.deltaY;
                        },
                        { passive: false },
                    );

                    window.addEventListener("resize", updateDraftTabScrollButtons, { passive: true });
                    updateDraftTabScrollButtons();
                }

                // 초안 탭 스크롤 버튼 갱신
                function updateDraftTabScrollButtons() {
                    const container = $("#draftDocTabs");
                    const prevButton = $("#draftTabsPrev");
                    const nextButton = $("#draftTabsNext");
                    if (!container || !prevButton || !nextButton) return;

                    const hasOverflow = container.scrollWidth > container.clientWidth + 2;
                    prevButton.classList.toggle("hidden", !hasOverflow);
                    nextButton.classList.toggle("hidden", !hasOverflow);
                    prevButton.disabled = !hasOverflow || container.scrollLeft <= 1;
                    nextButton.disabled = !hasOverflow || container.scrollLeft + container.clientWidth >= container.scrollWidth - 1;
                }

                /* ============================ 끝: 답변서 버전 바 ============================== */

                /* ============================ 시작: 답변서 검증 ============================ */
                const draftVerifyDisplayState = {
                    highlight: true,
                    source: true,
                };

                // 초안 근거 검증 초기화
                function initDraftVerify() {
                    const wrapper = $("#centerBody .draft-view-wrapper");
                    const editor = wrapper ? $(".draft-editor", wrapper) : null;
                    if (!wrapper || !editor) return;

                    if (editor && editor.dataset.verifyClickBound !== "true") {
                        editor.dataset.verifyClickBound = "true";
                        editor.addEventListener("click", (event) => {
                            const sentence = event.target.closest(".verify-sentence");
                            if (!sentence || !editor.contains(sentence)) return;
                            openVerifyDetail(sentence);
                        });
                        editor.addEventListener("keydown", (event) => {
                            if (!["Enter", " "].includes(event.key)) return;
                            const sentence = event.target.closest(".verify-sentence");
                            if (!sentence || !editor.contains(sentence)) return;
                            event.preventDefault();
                            openVerifyDetail(sentence);
                        });
                    }

                    $$(".verify-sentence", editor).forEach((sentence) => {
                        sentence.tabIndex = 0;
                        sentence.setAttribute("role", "button");
                    });

                    $$(".verify-check", wrapper).forEach((chk) => {
                        chk.checked = draftVerifyDisplayState[chk.dataset.mode] ?? false;
                        if (chk.dataset.verifyDisplayBound === "true") return;
                        chk.dataset.verifyDisplayBound = "true";
                        chk.addEventListener("change", () => {
                            draftVerifyDisplayState[chk.dataset.mode] = chk.checked;
                            syncDraftVerifyDisplay(wrapper);
                            resetDraftVerifyDetail();
                        });
                    });

                    syncDraftVerifyDisplay(wrapper);
                }

                // 초안 근거 표시 상태 동기화
                function syncDraftVerifyDisplay(wrapper = $("#centerBody .draft-view-wrapper")) {
                    const editor = wrapper ? $(".draft-editor", wrapper) : null;
                    if (!wrapper || !editor) return;
                    const highlightOn = $('.verify-check[data-mode="highlight"]', wrapper)?.checked ?? false;
                    const sourceOn = $('.verify-check[data-mode="source"]', wrapper)?.checked ?? false;

                    $$("[data-verify-tone]", editor).forEach((sentence) => {
                        ["verify-green", "verify-yellow", "verify-red"].forEach((tone) => sentence.classList.remove(tone));
                        if (highlightOn && sentence.dataset.verifyTone) sentence.classList.add(sentence.dataset.verifyTone);
                    });
                    $$(".verify-badge", editor).forEach((badge) => {
                        badge.hidden = !sourceOn;
                    });
                }

                // 초안 근거 상세 패널 초기화
                function resetDraftVerifyDetail() {
                    const wrapper = $("#centerBody .draft-view-wrapper");
                    if (!wrapper) return;
                    const splitArea = $(".draft-split-area", wrapper);
                    if (splitArea) window.AIOneSplitHandler?.reset(splitArea);
                    const detail = splitArea ? $(".verify-detail-panel", splitArea) : null;
                    if (detail) detail.remove();
                    const resHandle = splitArea ? $(":scope > .split-handler-handle", splitArea) : null;
                    if (resHandle) resHandle.remove();
                    const draftView = $(".draft-view", wrapper);
                    if (splitArea && draftView) {
                        splitArea.parentNode.insertBefore(draftView, splitArea);
                        draftView.classList.remove("split-handler-left");
                        splitArea.remove();
                    }
                    wrapper.classList.remove("verify-split");
                }

                // 근거 상세 확인 패널 템플릿 복제
                function cloneVerifyDetailTemplate() {
                    return cloneAfterPrototype("verifyDetailPrototype");
                }

                // 근거 상세 확인 패널 내용 갱신
                function renderVerifyDetailContent(detail, { sentenceText, sentenceNumber, status }) {
                    const statusBadge = $("[data-vd-status]", detail);
                    if (statusBadge) {
                        statusBadge.className = `status-badge ${status.tone}`;
                        statusBadge.textContent = status.label;
                    }

                    $$("[data-vd-sentence-num]", detail).forEach((element) => {
                        element.textContent = `문장 ${sentenceNumber}`;
                    });
                    $$("[data-vd-sentence-text]", detail).forEach((element) => {
                        element.textContent = sentenceText;
                    });
                    $$(".vd-tab", detail).forEach((tab) => {
                        const active = tab.dataset.vdTab === "ref";
                        tab.classList.toggle("active", active);
                        tab.setAttribute("aria-selected", String(active));
                    });
                    $$(".vd-tab-content", detail).forEach((content) => {
                        content.classList.toggle("hidden", content.dataset.vdContent !== "ref");
                    });
                }

                // 근거 상세 확인 패널 닫기 및 탭 전환 이벤트 연결
                function bindVerifyDetailEvents(detail, splitArea, wrapper) {
                    $("#verifyDetailClose", detail)?.addEventListener("click", () => {
                        window.AIOneSplitHandler?.reset(splitArea);
                        detail.remove();
                        const resizeHandle = $(":scope > .split-handler-handle", splitArea);
                        if (resizeHandle) resizeHandle.remove();
                        wrapper.classList.remove("verify-split");

                        const currentSplitArea = $(".draft-split-area", wrapper);
                        const draftView = $(".draft-view", wrapper);
                        if (currentSplitArea && draftView) {
                            currentSplitArea.parentNode.insertBefore(draftView, currentSplitArea);
                            draftView.classList.remove("split-handler-left");
                            currentSplitArea.remove();
                        }
                    });

                    $$(".vd-tab", detail).forEach((tab) => {
                        tab.addEventListener("click", () => {
                            const target = tab.dataset.vdTab;
                            $$(".vd-tab", detail).forEach((item) => {
                                const active = item === tab;
                                item.classList.toggle("active", active);
                                item.setAttribute("aria-selected", String(active));
                            });
                            $$(".vd-tab-content", detail).forEach((content) => {
                                content.classList.toggle("hidden", content.dataset.vdContent !== target);
                            });
                        });
                    });
                }

                // 근거 상세 확인 패널 열기
                function openVerifyDetail(el) {
                    const wrapper = $("#centerBody .draft-view-wrapper");
                    if (!wrapper) return;

                    // 분할 컨테이너가 없으면 생성합니다.
                    let splitArea = $(".draft-split-area", wrapper);
                    const draftView = $(".draft-view", wrapper);
                    if (!splitArea && draftView) {
                        splitArea = document.createElement("div");
                        splitArea.className = "draft-split-area split-handler";
                        splitArea.dataset.component = "split-handler";
                        splitArea.dataset.splitMin = "200";
                        draftView.parentNode.insertBefore(splitArea, draftView);
                        draftView.classList.add("split-handler-left");
                        splitArea.appendChild(draftView);
                    }
                    if (!splitArea) return;

                    // 분할 모드를 추가합니다.
                    wrapper.classList.add("verify-split");

                    // 상세 패널을 가져오거나 생성합니다.
                    let detail = $(".verify-detail-panel", splitArea);
                    if (!detail) {
                        detail = cloneVerifyDetailTemplate();
                        if (!detail) return;

                        let resizeHandle = $(":scope > .split-handler-handle", splitArea);
                        if (!resizeHandle) {
                            resizeHandle = document.createElement("div");
                            resizeHandle.className = "split-handler-handle";
                            resizeHandle.setAttribute("role", "separator");
                            resizeHandle.setAttribute("aria-label", "답변서 초안과 근거 상세 패널 너비 조절");
                            resizeHandle.setAttribute("aria-orientation", "vertical");
                            resizeHandle.tabIndex = 0;
                            splitArea.appendChild(resizeHandle);
                        }
                        splitArea.appendChild(detail);
                        window.AIOneSplitHandler?.init(splitArea);
                        bindVerifyDetailEvents(detail, splitArea, wrapper);
                    }

                    const sentText = el.textContent.replace(/\[\d+\]|\[주의\]|\[출처없음\]/g, "").trim();
                    const idx = el.dataset.verifyIdx || "01";
                    const verifyTone = el.dataset.verifyTone;
                    const isGreen = el.classList.contains("verify-green") || verifyTone === "verify-green";
                    const isYellow = el.classList.contains("verify-yellow") || verifyTone === "verify-yellow";

                    // 참조 자료를 무작위로 선택합니다.
                    const status = isGreen ? { tone: "green", label: "근거 확인" } : isYellow ? { tone: "yellow", label: "주의" } : { tone: "red", label: "출처 누락" };

                    renderVerifyDetailContent(detail, {
                        sentenceText: sentText,
                        sentenceNumber: String(idx).padStart(2, "0"),
                        status,
                    });
                }

                /* ============================ 끝: 답변서 검증 ============================== */

                /* ============================ 시작: 공통 문서 상태 바 연결 ============================ */
                // 초안 문서 상태 바 초기화
                function initDraftStatusBar() {
                    const editor = $(".draft-editor");
                    const statusBar = $("#draftStatusBar");
                    if (!editor || !statusBar) return;

                    // 글자 수
                    const text = editor.innerText || editor.textContent || "";
                    const charCount = text.replace(/\s/g, "").length;
                    const charEl = $("#draftCharCount");
                    if (charEl) charEl.textContent = charCount.toLocaleString();

                    // 페이지 예상치 (페이지당 약 2,000자)
                    const pages = Math.max(1, Math.ceil(charCount / 2000));
                    const pageNum = $("#draftPageNum");
                    const pageTotal = $("#draftPageTotal");
                    if (pageNum) pageNum.textContent = "1";
                    if (pageTotal) pageTotal.textContent = pages;

                    if (statusBar.dataset.answerFullscreenToastBound !== "true") {
                        statusBar.dataset.answerFullscreenToastBound = "true";
                        statusBar.addEventListener("document-statusbar:fullscreenchange", (event) => {
                            showToast(event.detail?.fullscreen ? "전체보기 모드입니다. ESC 키를 누르면 종료됩니다." : "전체보기를 종료했습니다.");
                        });
                    }
                    window.AIOneDocumentStatusBar?.init(statusBar);
                }

                /* ============================ 끝: 공통 문서 상태 바 연결 ============================== */

                /* ============================ 시작: 확인 모달 ============================ */
                // Custom Confirm 패널 열기
                function openCustomConfirmPanel(panelName, strongText, onConfirm) {
                    const target = showCustomModalPanel(panelName);
                    if (!target) return;
                    const { modal, panel } = target;
                    panel.querySelector("[data-modal-strong]").textContent = strongText;
                    const confirmButton = panel.querySelector("[data-modal-confirm]");
                    panel.querySelector("[data-modal-cancel]").onclick = closeCustomModal;
                    confirmButton.onclick = () => {
                        closeCustomModal();
                        if (onConfirm) onConfirm();
                    };
                    modal.onclick = (event) => {
                        if (isModalBackgroundClick(event, modal)) closeCustomModal();
                    };
                }

                /* ============================ 끝: 확인 모달 ============================== */

                /* ============================ 시작: 보고서 드로어 ============================ */
                // 보고서 드로어 열기
                function openReportDrawer(trigger = null) {
                    window.AIOneSidePop?.setVariant("#answerReportSidepop", "content");
                    window.AIOneSidePop?.setSize("#answerReportSidepop", "small");
                    window.AIOneSidePop?.open("#answerReportSidepop", trigger);
                }
                // 보고서 드로어 닫기
                function closeReportDrawer() {
                    window.AIOneSidePop?.close("#answerReportSidepop");
                }

                // 토스트 메시지 표시
                function showToast(msg) {
                    window.AIOneToast?.show(msg, {
                        target: "#answerAfter9Toast",
                        duration: 2000,
                    });
                }

                /* ============================ 끝: 보고서 드로어 ============================== */

                /* ============================ 시작: AI 참조소스 검색 ============================ */
                // 소스 메시지 시각 조회
                function getSourceMessageTime() {
                    const now = new Date();
                    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
                }

                // Uploaded 소스 Description 추론
                function inferUploadedSourceDescription(file) {
                    const name = String(file?.name || "업로드 문서");
                    if (/답변|질의|국회|위원회/.test(name)) return "국회 질의 대응과 과거 답변 논리를 확인할 수 있는 자료로 분석했습니다.";
                    if (/법|의무|시행령|규정|지침/.test(name)) return "답변 근거로 활용할 수 있는 법령·제도 자료로 분석했습니다.";
                    if (/예산|추경|재정|통계|현황|실적/.test(name)) return "예산 규모, 정책 현황과 수치 근거를 보강할 수 있는 자료로 분석했습니다.";
                    if (/지방채|교부세|공자기금/.test(name)) return "지방채 인수와 지방재정 지원 논리를 보강할 수 있는 업무자료로 분석했습니다.";
                    return "문서 내용을 청크 단위로 나누어 질문 답변과 답변서 초안 생성에 활용할 수 있도록 준비했습니다.";
                }

                // Added 소스 Explanation 추가
                function appendAddedSourcesExplanation(items, origin = "upload") {
                    if (!items?.length || !chatConversations[activeChatTopic]) return;
                    const isSearch = origin === "search";
                    const lines = items.map((item, index) => {
                        const title = item.title || item.name || `소스 ${index + 1}`;
                        const description = isSearch ? item.desc || `${getSmartSourceTopic(item)} 관련 자료입니다.` : inferUploadedSourceDescription(item);
                        const topic = isSearch ? getSmartSourceTopic(item) : getSmartSourceTopic({ title, meta: "", desc: description, tags: [] });
                        return `• ${title}
  - 주제: ${topic}
  - 내용: ${description}`;
                    });
                    const totalChunks = items.reduce((sum, item) => sum + Number(item.chunks || 0), 0);
                    const sourceLabel = isSearch ? "검색하여 가져온 소스" : "업로드한 소스";
                    const text = `${sourceLabel} ${items.length}건의 청킹이 완료되었습니다. 기본적으로 모두 선택되어 답변 생성에 반영됩니다.

📚 추가된 소스 내용
${lines.join("\n")}

✅ 활용 안내
• 선택된 소스를 근거로 질문에 답변하거나 답변서 초안을 생성할 수 있습니다.${
                        totalChunks
                            ? `
• 총 ${totalChunks}개 청크로 분리되어 관련 문단을 우선 탐색합니다.`
                            : ""
                    }`;
                    chatConversations[activeChatTopic].push({ role: "ai", text, time: getSourceMessageTime() });
                    renderChatMessages();
                }

                // 지능형 소스 주제 조회
                function getSmartSourceTopic(item) {
                    const text = `${item?.title || ""} ${item?.meta || ""} ${item?.desc || ""} ${(item?.tags || []).join(" ")}`;
                    if (/법|시행령|규정|지침|의무/.test(text)) return "법령·제도";
                    if (/예산|통계|현황|실적|추이|수치|금리/.test(text)) return "재정·통계";
                    if (/추경|지방채|교부세|공자기금/.test(text)) return "지방채·추경";
                    if (/답변|질의|국회|위원회/.test(text)) return "국회답변";
                    return "기타 업무자료";
                }

                // 지능형 가져온 선택 동기화
                function syncSmartImportedSelection() {
                    const importedSet = new Set(smartImportedSourceIds);
                    selectedRecIds = selectedRecIds.filter((id) => !importedSet.has(id));
                    smartImportedSelectedIds.forEach((id) => {
                        if (!selectedRecIds.includes(id)) selectedRecIds.push(id);
                    });
                    renderSelectedRefs();
                    renderRecommendations();
                }

                // keep 지능형 소스 Dropzone Visible 동작 처리
                function keepSmartSourceDropzoneVisible() {
                    const guide = $("#smartSearchGuide");
                    if (guide) guide.classList.remove("hidden");
                }

                // 지능형 소스 유형별 개수 갱신
                function updateSmartSourceTypeCounts() {
                    const section = $("#smartImportedSection");
                    const searchCountEl = $("#smartImportedSearchCount");
                    const uploadCountEl = $("#smartImportedUploadCount");
                    const selectedCountEl = $("#smartImportedSelectedCount");
                    const searchCount = smartImportedSourceIds.length;
                    const uploadCount = files.length;
                    const selectedSearchCount = smartImportedSelectedIds.length;
                    const selectedUploadCount = files.filter((file) => file.status === "done" && file.selected !== false).length;
                    if (searchCountEl) searchCountEl.textContent = String(searchCount);
                    if (uploadCountEl) uploadCountEl.textContent = String(uploadCount);
                    if (selectedCountEl) selectedCountEl.textContent = String(selectedSearchCount + selectedUploadCount);
                    if (section) section.classList.toggle("hidden", searchCount + uploadCount === 0);
                }

                // 접힌 왼쪽 패널의 관련자료 및 참조소스 요약 렌더링
                function renderCollapsedAnswerSources() {
                    const collapsedIcons = $("#collapsedSmartSourceIcons");
                    if (!collapsedIcons) return;

                    const importedIds = new Set(smartImportedSourceIds);
                    const selectedRecommendations = selectedRecIds
                        .filter((id) => !importedIds.has(id))
                        .map((id) => recommendations.find((item) => item.id === id))
                        .filter(Boolean)
                        .map((item) => ({
                            name: item.title,
                            type: item.category === "similar" ? "docx" : "pdf",
                            status: "done",
                        }));
                    const importedSources = smartImportedSourceIds
                        .map((id) => recommendations.find((item) => item.id === id))
                        .filter(Boolean)
                        .map((item) => ({
                            name: item.title,
                            type: item.category === "similar" ? "docx" : "pdf",
                            status: smartImportedStatus.get(item.id) || "done",
                        }));
                    const uploadedSources = files.map((file) => ({
                        name: file.name,
                        type: file.type || "file",
                        status: file.status || "waiting",
                    }));

                    collapsedIcons.innerHTML = [...selectedRecommendations, ...importedSources, ...uploadedSources]
                        .map((source) => `<span class="collapsed-smart-source-item" title="${escapeHtml(source.name)}" aria-label="${escapeHtml(source.name)}">${renderReferenceFileIcon(source)}</span>`)
                        .join("");
                }

                // 지능형 가져온 소스 렌더링
                function renderSmartImportedSources() {
                    keepSmartSourceDropzoneVisible();
                    const section = $("#smartImportedSection");
                    const list = $("#smartImportedList");
                    const labelButton = $("#smartAutoLabelBtn");
                    const sortSelect = $("#smartImportedSort");
                    if (!section || !list) return;

                    const searchEntries = smartImportedSourceIds
                        .map((id, importIndex) => {
                            const item = recommendations.find((source) => source.id === id);
                            return item
                                ? {
                                      kind: "search",
                                      id,
                                      item,
                                      order: smartImportedOrder.get(id) || importIndex + 1,
                                  }
                                : null;
                        })
                        .filter(Boolean);

                    const uploadEntries = files.map((file, index) => ({
                        kind: "upload",
                        id: Number(file.id || index + 1),
                        item: file,
                        index,
                        order: Number(file.sourceOrder || file.id || index + 1),
                    }));

                    // Entry 고정 상태 확인
                    const isEntryPinned = (entry) => (entry.kind === "search" ? Boolean(entry.item.sourcePinned) : Boolean(entry.item.pinned));
                    const unified = [...searchEntries, ...uploadEntries].sort((a, b) => Number(isEntryPinned(b)) - Number(isEntryPinned(a)) || (smartImportedSortOrder === "latest" ? b.order - a.order : a.order - b.order));

                    updateSmartSourceTypeCounts();
                    if (sortSelect) sortSelect.value = smartImportedSortOrder;
                    if (labelButton) {
                        labelButton.classList.toggle("active", smartGroupMode);
                        labelButton.setAttribute("aria-pressed", String(smartGroupMode));
                        labelButton.title = smartGroupMode ? "자동 라벨 분류 해제" : "주제를 소스에 자동 라벨 지정";
                    }
                    renderCollapsedAnswerSources();
                    if (!unified.length) {
                        list.innerHTML = "";
                        return;
                    }

                    // entry Name 동작 처리
                    const entryName = (entry) => (entry.kind === "search" ? entry.item.title : entry.item.name);
                    // entry 주제 동작 처리
                    const entryTopic = (entry) => (entry.kind === "search" ? getSmartSourceTopic(entry.item) : getSmartSourceTopic({ title: entry.item.name, meta: "", desc: inferUploadedSourceDescription(entry.item), tags: [] }));

                    // 목록 행 HTML 구성
                    const rowHtml = (entry) => {
                        const isSearch = entry.kind === "search";
                        const status = isSearch ? smartImportedStatus.get(entry.id) || "done" : entry.item.status || "waiting";
                        const isFailed = status === "failed";
                        const isProcessing = !["done", "failed"].includes(status);
                        const isSelected = isSearch ? smartImportedSelectedIds.includes(entry.id) : entry.item.selected !== false;
                        const isPinned = isEntryPinned(entry);
                        const name = entryName(entry);
                        const sourceFile = { name, type: getReferenceFileType(name, entry.item.type || "file"), status };
                        const statusLabels = { waiting: "대기 중", parsing: "파싱 중", summarizing: "SLM 자연어화", chunking: "청킹 중" };
                        const statusTone = { waiting: "gray", parsing: "yellow", summarizing: "blue", chunking: "purple" }[status] || "gray";
                        const failedLabel = isSearch ? "불러오기 실패" : "청킹 실패";
                        const control = isFailed
                            ? `<span class="source-failed-controls"><span class="status-badge type1 red" data-status-icon="error">${failedLabel}</span><button type="button" class="source-retry-btn" data-source-retry-kind="${entry.kind}" data-source-retry-id="${entry.id}">재시도</button></span>`
                            : isProcessing
                              ? `<span class="status-badge type1 ${statusTone}" data-file-status="${escapeHtml(status)}">${statusLabels[status] || "처리 중"}</span>`
                              : `<span class="file-source-check-wrap" title="답변 생성에 사용할 소스 선택"><input type="checkbox" class="checkbox-control checkbox-control-sm file-source-check" data-unified-check-kind="${entry.kind}" data-unified-check-id="${entry.id}" ${isSelected ? "checked" : ""} aria-label="${escapeHtml(name)} 소스 선택" /></span>`;
                        const pinnedIndicator = isPinned
                            ? `<span class="source-pinned-indicator" title="고정된 파일" aria-label="고정된 파일"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v5"/><path d="M5 17h14"/><path d="M7 3h10l-1 5v3l2 3H6l2-3V8z"/></svg></span>`
                            : "";
                        return `<div class="file-item-simple smart-imported-file-item${isProcessing ? " is-processing" : ""}${isFailed ? " is-failed" : ""}${!isProcessing && !isFailed && !isSelected ? " source-unchecked" : ""}${isPinned ? " source-pinned" : ""}" data-source-kind="${entry.kind}" data-source-id="${entry.id}">
        ${renderReferenceFileIcon(sourceFile)}
        ${pinnedIndicator}
        <span class="file-name-simple" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
        ${control}
        <div class="source-action-wrap">
          <button type="button" class="source-more-btn" data-source-more-kind="${entry.kind}" data-source-more-id="${entry.id}" aria-label="${escapeHtml(name)} 파일 옵션" aria-expanded="false" title="파일 옵션">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>
          </button>
          <div class="source-more-menu hidden" data-source-menu-kind="${entry.kind}" data-source-menu-id="${entry.id}">
            <button type="button" class="source-menu-item" data-source-action="pin" data-source-action-kind="${entry.kind}" data-source-action-id="${entry.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v5"/><path d="M5 17h14"/><path d="M7 3h10l-1 5v3l2 3H6l2-3V8z"/></svg><span>${isPinned ? "고정 해제" : "고정"}</span></button>
            <button type="button" class="source-menu-item" data-source-action="rename" data-source-action-kind="${entry.kind}" data-source-action-id="${entry.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg><span>이름 변경</span></button>
            <button type="button" class="source-menu-item danger" data-source-action="delete" data-source-action-kind="${entry.kind}" data-source-action-id="${entry.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span>삭제</span></button>
          </div>
        </div>
      </div>`;
                    };

                    if (!smartGroupMode) {
                        list.innerHTML = unified.map(rowHtml).join("");
                    } else {
                        const groups = unified.reduce((map, entry) => {
                            const topic = entryTopic(entry);
                            if (!map.has(topic)) map.set(topic, []);
                            map.get(topic).push(entry);
                            return map;
                        }, new Map());
                        list.innerHTML = [...groups.entries()]
                            .map(
                                ([topic, entries]) => `<div class="smart-topic-group${smartExpandedTopics.has(topic) ? " open" : ""}" data-topic="${escapeHtml(topic)}">
        <button type="button" class="smart-topic-header" data-topic-toggle="${escapeHtml(topic)}" aria-expanded="${smartExpandedTopics.has(topic) ? "true" : "false"}">
          <span class="smart-topic-arrow">▶</span><span class="smart-topic-name">${escapeHtml(topic)}</span><span class="smart-topic-count">${entries.length}건</span>
        </button>
        <div class="smart-topic-files">${entries.map(rowHtml).join("")}</div>
      </div>`,
                            )
                            .join("");
                    }

                    $$("[data-unified-check-kind]", list).forEach((check) => {
                        check.addEventListener("change", () => {
                            const kind = check.dataset.unifiedCheckKind;
                            const id = Number(check.dataset.unifiedCheckId);
                            if (kind === "search") {
                                if (check.checked) {
                                    if (!smartImportedSelectedIds.includes(id)) smartImportedSelectedIds.push(id);
                                } else {
                                    smartImportedSelectedIds = smartImportedSelectedIds.filter((value) => value !== id);
                                }
                                syncSmartImportedSelection();
                            } else {
                                const file = files.find((source) => Number(source.id) === id);
                                if (file) file.selected = check.checked;
                                renderRecommendations();
                            }
                            renderSmartImportedSources();
                            showToast(check.checked ? "소스를 답변 생성에 포함했습니다." : "소스를 답변 생성에서 제외했습니다.");
                        });
                    });

                    // 실패한 검색 소스/업로드 파일을 개별 재시도합니다.
                    $$("[data-source-retry-kind]", list).forEach((button) => {
                        button.addEventListener("click", async (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const kind = button.dataset.sourceRetryKind;
                            const id = Number(button.dataset.sourceRetryId);
                            if (kind === "upload") {
                                const file = files.find((source) => Number(source.id) === id);
                                if (!file) return;
                                file.simulateFailure = false;
                                file.failureReason = "";
                                file.selected = false;
                                runFilePipeline(file, true);
                                showToast(`${file.name} 청킹을 다시 시도합니다.`);
                                return;
                            }
                            const item = recommendations.find((source) => source.id === id);
                            if (!item) return;
                            smartImportedStatus.set(id, "chunking");
                            renderSmartImportedSources();
                            showToast(`${item.title} 소스를 다시 불러옵니다.`);
                            try {
                                await window.AIOneAgentBridge.importReferenceSources({ sourceIds: [id], chatTopicId: chatTopics[activeChatTopic]?.id || activeChatTopic }, () => ({ ok: true, sourceIds: [id] }), 450);
                                smartImportedStatus.set(id, "done");
                                if (!smartImportedSelectedIds.includes(id)) smartImportedSelectedIds.push(id);
                                syncSmartImportedSelection();
                                renderSmartImportedSources();
                                showToast("소스를 정상적으로 불러왔습니다.");
                            } catch (error) {
                                smartImportedStatus.set(id, "failed");
                                renderSmartImportedSources();
                                showToast("소스 불러오기에 다시 실패했습니다.");
                            }
                        });
                    });

                    // 소스 동작 메뉴 닫기
                    const closeSourceActionMenus = () => {
                        $$(".source-more-menu", list).forEach((menu) => menu.classList.add("hidden"));
                        $$(".source-more-btn", list).forEach((button) => button.setAttribute("aria-expanded", "false"));
                    };

                    $$(".source-more-btn", list).forEach((button) => {
                        button.addEventListener("click", (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const kind = button.dataset.sourceMoreKind;
                            const id = button.dataset.sourceMoreId;
                            const menu = list.querySelector(`.source-more-menu[data-source-menu-kind="${kind}"][data-source-menu-id="${id}"]`);
                            const willOpen = menu?.classList.contains("hidden");
                            closeSourceActionMenus();
                            if (menu && willOpen) {
                                const listRect = list.getBoundingClientRect();
                                const buttonRect = button.getBoundingClientRect();
                                const spaceBelow = listRect.bottom - buttonRect.bottom;
                                const spaceAbove = buttonRect.top - listRect.top;
                                menu.classList.toggle("open-up", spaceBelow < 132 && spaceAbove > 132);
                                menu.classList.remove("hidden");
                                button.setAttribute("aria-expanded", "true");
                            }
                        });
                    });

                    $$(".source-menu-item", list).forEach((button) => {
                        button.addEventListener("click", (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const kind = button.dataset.sourceActionKind;
                            const id = Number(button.dataset.sourceActionId);
                            const action = button.dataset.sourceAction;
                            closeSourceActionMenus();

                            const searchItem = kind === "search" ? recommendations.find((source) => source.id === id) : null;
                            const uploadFile = kind === "upload" ? files.find((source) => Number(source.id) === id) : null;
                            const target = searchItem || uploadFile;
                            if (!target) return;

                            if (action === "pin") {
                                if (kind === "search") searchItem.sourcePinned = !searchItem.sourcePinned;
                                else uploadFile.pinned = !uploadFile.pinned;
                                renderSmartImportedSources();
                                if (kind === "upload") renderFiles();
                                showToast((kind === "search" ? searchItem.sourcePinned : uploadFile.pinned) ? "파일을 목록 상단에 고정했습니다." : "파일 고정을 해제했습니다.");
                            } else if (action === "rename") {
                                openUnifiedSourceRenameModal(kind, id);
                            } else if (action === "delete") {
                                const targetName = kind === "search" ? searchItem.title : uploadFile.name;
                                openCustomConfirmPanel("source-delete", targetName, () => {
                                    if (kind === "search") {
                                        smartImportedSourceIds = smartImportedSourceIds.filter((value) => value !== id);
                                        smartImportedSelectedIds = smartImportedSelectedIds.filter((value) => value !== id);
                                        smartImportedStatus.delete(id);
                                        smartImportedOrder.delete(id);
                                        syncSmartImportedSelection();
                                        renderSmartImportedSources();
                                        renderRecommendations();
                                        showToast("검색 소스를 삭제했습니다.");
                                    } else {
                                        const index = files.findIndex((source) => Number(source.id) === id);
                                        if (index >= 0) files.splice(index, 1);
                                        renderFiles();
                                        renderRecommendations();
                                        showToast("업로드 소스를 삭제했습니다.");
                                    }
                                });
                            }
                        });
                    });

                    $$("[data-topic-toggle]", list).forEach((button) => {
                        button.addEventListener("click", (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const topic = button.dataset.topicToggle;
                            const group = button.closest(".smart-topic-group");
                            const willOpen = !group?.classList.contains("open");
                            if (willOpen) smartExpandedTopics.add(topic);
                            else smartExpandedTopics.delete(topic);
                            group?.classList.toggle("open", willOpen);
                            button.setAttribute("aria-expanded", String(willOpen));
                        });
                    });
                }

                // Unified 소스 Rename 모달 열기
                function openUnifiedSourceRenameModal(kind, id) {
                    const searchItem = kind === "search" ? recommendations.find((source) => source.id === id) : null;
                    const uploadFile = kind === "upload" ? files.find((source) => Number(source.id) === id) : null;
                    const target = searchItem || uploadFile;
                    if (!target) return;
                    const currentName = kind === "search" ? searchItem.title : uploadFile.name;

                    const modal = $("#sourceRenameModal");
                    if (!modal) return;

                    const input = $("#sourceRenameInput");
                    input.value = currentName;
                    modal.classList.remove("hidden");
                    // 현재 안내 UI 닫기
                    const close = () => modal.classList.add("hidden");
                    // 변경 내용 저장
                    const save = () => {
                        const nextName = String(input.value || "").trim();
                        if (!nextName) {
                            input.focus();
                            showToast("변경할 파일 이름을 입력해주세요.");
                            return;
                        }
                        if (kind === "search") {
                            searchItem.title = nextName;
                            if (searchItem.preview) searchItem.preview.title = nextName;
                            renderSmartImportedSources();
                            renderSelectedRefs();
                            renderRecommendations();
                        } else {
                            uploadFile.name = nextName;
                            renderFiles();
                            renderRecommendations();
                        }
                        close();
                        showToast("파일 이름을 변경했습니다.");
                    };
                    $("#sourceRenameClose").onclick = close;
                    $("#sourceRenameCancel").onclick = close;
                    $("#sourceRenameConfirm").onclick = save;
                    modal.onclick = (event) => {
                        if (isModalBackgroundClick(event, modal)) close();
                    };
                    input.onkeydown = (event) => {
                        if (event.key === "Enter") save();
                        if (event.key === "Escape") close();
                    };
                    setTimeout(() => {
                        input.focus();
                        input.select();
                    }, 0);
                }

                // 지능형 검색 Results After 가져오기 닫기
                function dismissSmartSearchResultsAfterImport() {
                    smartLastResults = [];
                    smartSearchSelectedIds = [];
                    collapseSmartInlineResultsTemporary();
                    const resultWrap = $("#smartSearchResults");
                    const input = $("#smartSearchInput");
                    const searchBox = $("#smartSearchBox");
                    const progress = $("#smartSearchProgress");
                    const searchButton = $("#smartSearchBtn");
                    resultWrap?.classList.add("hidden");
                    resultWrap?.classList.remove("expanded");
                    $("#smartOtherSourcesBtn")?.classList.remove("expanded");
                    $("#smartOtherSourcesBtn")?.setAttribute("aria-expanded", "false");
                    if (input) {
                        input.value = "";
                        resizeSmartSearchTextarea(input);
                    }
                    searchBox?.classList.remove("searching");
                    progress?.classList.add("hidden");
                    if (searchButton) searchButton.disabled = true;
                    closeSmartSourceModal();
                }

                // 가져오기 지능형 소스 동작 처리
                async function importSmartSources(ids, closeModal = false) {
                    const runId = workspaceRunSeq;
                    const chatTopicIndex = activeChatTopic;
                    const validIds = [...new Set(ids.map(Number))].filter((id) => recommendations.some((item) => item.id === id));
                    if (!validIds.length) {
                        showToast("가져올 소스를 선택해주세요.");
                        return;
                    }
                    const newIds = validIds.filter((id) => !smartImportedSourceIds.includes(id));
                    if (!newIds.length) {
                        showToast("선택한 소스는 이미 목록에 추가되어 있습니다.");
                        dismissSmartSearchResultsAfterImport();
                        return;
                    }

                    // AI 에이전트 API 연계 지점 ⑥ 참조소스 가져오기/등록
                    try {
                        await window.AIOneAgentBridge.importReferenceSources(
                            {
                                sourceIds: newIds,
                                chatTopicId: chatTopics[chatTopicIndex]?.id || chatTopicIndex,
                            },
                            () => ({ ok: true, sourceIds: newIds }),
                            0,
                        );
                        if (runId !== workspaceRunSeq) return;
                    } catch (error) {
                        if (runId !== workspaceRunSeq) return;
                        console.error("[AI-ONE] 참조소스 가져오기 API 오류", error);
                        newIds.forEach((id) => {
                            if (!smartImportedSourceIds.includes(id)) smartImportedSourceIds.push(id);
                            smartImportedStatus.set(id, "failed");
                            if (!smartImportedOrder.has(id)) smartImportedOrder.set(id, ++smartUnifiedSourceOrderSeq);
                        });
                        renderSmartImportedSources();
                        renderRecommendations();
                        showToast("소스를 가져오는 중 오류가 발생했습니다. 실패 항목에서 재시도할 수 있습니다.");
                        return;
                    }

                    newIds.forEach((id) => {
                        smartImportedSourceIds.push(id);
                        smartImportedStatus.set(id, "chunking");
                        smartImportedOrder.set(id, ++smartUnifiedSourceOrderSeq);
                        smartImportedSelectedIds = smartImportedSelectedIds.filter((value) => value !== id);
                    });
                    renderSmartImportedSources();
                    renderRecommendations();
                    keepSmartSourceDropzoneVisible();

                    // 가져오기를 실행하면 검색 결과 목록을 닫고, 다음 검색은 새 상태로 시작한다.
                    dismissSmartSearchResultsAfterImport();

                    const first = recommendations.find((item) => item.id === newIds[0]);
                    if (first) renderPreview(first);
                    showToast(`소스 ${newIds.length}개의 문서 청킹을 시작합니다.`);

                    let completed = 0;
                    newIds.forEach((id, index) => {
                        setTimeout(
                            () => {
                                if (runId !== workspaceRunSeq) return;
                                if (!smartImportedSourceIds.includes(id)) return;
                                const item = recommendations.find((source) => source.id === id);
                                // 프로토타입 실패 케이스: '성과평가 보고서' 소스는 최초 불러오기에서 실패하고 재시도 시 정상 완료됩니다.
                                const shouldFail = Boolean(item && /성과평가 보고서/.test(item.title));
                                if (shouldFail) {
                                    smartImportedStatus.set(id, "failed");
                                    smartImportedSelectedIds = smartImportedSelectedIds.filter((value) => value !== id);
                                } else {
                                    smartImportedStatus.set(id, "done");
                                    if (!smartImportedSelectedIds.includes(id)) smartImportedSelectedIds.push(id);
                                }
                                completed += 1;
                                syncSmartImportedSelection();
                                renderSmartImportedSources();
                                if (completed === newIds.length) {
                                    const completedItems = recommendations
                                        .filter((item) => newIds.includes(item.id) && smartImportedSourceIds.includes(item.id) && smartImportedStatus.get(item.id) === "done")
                                        .map((item) => ({ ...item, chunks: Math.max(6, Math.round((item.desc.length + item.title.length) / 18)) }));
                                    const failedCount = newIds.filter((itemId) => smartImportedStatus.get(itemId) === "failed").length;
                                    if (completedItems.length) appendAddedSourcesExplanation(completedItems, "search");
                                    showToast(failedCount ? `소스 ${completedItems.length}개 불러오기 완료 · ${failedCount}개 실패` : `소스 ${completedItems.length}개를 모두 가져왔습니다.`);
                                }
                            },
                            850 + index * 260,
                        );
                    });
                }

                // 지능형 Compact Results 렌더링
                function renderSmartCompactResults() {
                    const resultWrap = $("#smartSearchResults");
                    const resultList = $("#smartSearchResultsList");
                    const resultCount = $("#smartSearchResultCount");
                    const otherCount = $("#smartOtherSourceCount");
                    if (!resultWrap || !resultList) return;
                    if (resultCount) resultCount.textContent = String(smartLastResults.length);
                    if (otherCount) otherCount.textContent = String(Math.max(0, smartLastResults.length - 3));
                    const inlineSelectedCount = $("#smartInlineSelectedCount");
                    if (inlineSelectedCount) {
                        inlineSelectedCount.textContent = `선택 ${smartSearchSelectedIds.length}건`;
                        inlineSelectedCount.classList.toggle("hidden", !smartInlineResultsExpanded);
                    }

                    const visibleResults = smartInlineResultsExpanded ? smartLastResults : smartLastResults.slice(0, 3);
                    resultWrap.classList.toggle("expanded", smartInlineResultsExpanded);
                    const otherButton = $("#smartOtherSourcesBtn");
                    if (otherButton) {
                        otherButton.classList.toggle("expanded", smartInlineResultsExpanded);
                        otherButton.setAttribute("aria-expanded", String(smartInlineResultsExpanded));
                        otherButton.title = smartInlineResultsExpanded ? "검색 결과 접기" : "패널에서 전체 검색 소스 펼치기";
                    }
                    resultList.innerHTML = visibleResults.length
                        ? visibleResults
                              .map((item) => {
                                  const checked = smartSearchSelectedIds.includes(item.id);
                                  const checkbox = smartInlineResultsExpanded
                                      ? `<input type="checkbox" class="checkbox-control checkbox-control-sm smart-result-check" data-smart-inline-check="${item.id}" ${checked ? "checked" : ""} aria-label="${escapeHtml(item.title)} 선택" />`
                                      : "";
                                  return `<div class="smart-result-item${smartInlineResultsExpanded ? "" : " no-inline-check"}" data-smart-result-id="${item.id}">
        ${checkbox}
        <div class="smart-result-main" data-smart-preview-id="${item.id}" title="${escapeHtml(item.title)} 미리보기">
          <div class="smart-result-title"><span class="smart-result-name">${escapeHtml(item.title)}</span></div>
        </div>
      </div>`;
                              })
                              .join("")
                        : '<div class="smart-source-list-empty">검색 결과가 없습니다.</div>';

                    $$("[data-smart-inline-check]", resultList).forEach((check) => {
                        check.addEventListener("change", (event) => {
                            event.stopPropagation();
                            const id = Number(check.dataset.smartInlineCheck);
                            if (check.checked) {
                                if (!smartSearchSelectedIds.includes(id)) smartSearchSelectedIds.push(id);
                            } else {
                                smartSearchSelectedIds = smartSearchSelectedIds.filter((value) => value !== id);
                            }
                            updateSmartModalSelectionUi();
                        });
                        check.addEventListener("click", (event) => event.stopPropagation());
                    });

                    $$("[data-smart-preview-id]", resultList).forEach((preview) => {
                        preview.addEventListener("click", () => {
                            const rec = recommendations.find((item) => item.id === Number(preview.dataset.smartPreviewId));
                            if (rec) {
                                renderPreview(rec);
                                showToast("선택한 소스를 미리보기에 표시했습니다.");
                            }
                        });
                    });
                    resultWrap.classList.toggle("hidden", smartLastResults.length === 0);
                    updateSmartModalSelectionUi();
                }

                // 지능형 모달 선택 UI 갱신
                function updateSmartModalSelectionUi() {
                    const selectAll = $("#smartSourceSelectAll");
                    const selectedCount = $("#smartSourceSelectedCount");
                    const importButton = $("#smartSourceModalImport");
                    if (selectAll) {
                        selectAll.checked = smartLastResults.length > 0 && smartLastResults.every((item) => smartSearchSelectedIds.includes(item.id));
                        selectAll.indeterminate = smartSearchSelectedIds.length > 0 && !selectAll.checked;
                    }
                    if (selectedCount) selectedCount.textContent = `소스 ${smartSearchSelectedIds.length}개 선택됨`;
                    const inlineSelectedCount = $("#smartInlineSelectedCount");
                    if (inlineSelectedCount) inlineSelectedCount.textContent = `선택 ${smartSearchSelectedIds.length}건`;
                    const inlineSelectAll = $("#smartInlineSelectAll");
                    if (inlineSelectAll) {
                        inlineSelectAll.checked = smartLastResults.length > 0 && smartLastResults.every((item) => smartSearchSelectedIds.includes(item.id));
                        inlineSelectAll.indeterminate = smartSearchSelectedIds.length > 0 && !inlineSelectAll.checked;
                    }
                    const inlineSelectionSummary = $("#smartInlineSelectionSummary");
                    if (inlineSelectionSummary) inlineSelectionSummary.textContent = `선택 ${smartSearchSelectedIds.length}건 / 전체 ${smartLastResults.length}건`;
                    const inlineImportButton = $("#smartSearchImportBtn");
                    if (inlineImportButton) {
                        inlineImportButton.disabled = smartSearchSelectedIds.length === 0;
                        inlineImportButton.textContent = smartSearchSelectedIds.length ? `가져오기 ${smartSearchSelectedIds.length}` : "가져오기";
                    }
                    if (importButton) importButton.disabled = smartSearchSelectedIds.length === 0;
                }

                // 지능형 소스 모달 목록 렌더링
                function renderSmartSourceModalList() {
                    const list = $("#smartSourceModalList");
                    if (!list) return;
                    list.innerHTML = smartLastResults
                        .map((item) => {
                            const sourceText = `${item.title || ""} ${item.meta || ""} ${(item.tags || []).join(" ")}`;
                            let modalType = getReferenceFileType(item.title, item.type || "file");
                            if (modalType === "file") {
                                if (/현황표|통계|세수추계|예산 현황|수치/.test(sourceText)) modalType = "xlsx";
                                else if (/법|시행령|규정|지침|분석보고서|근거자료/.test(sourceText)) modalType = "pdf";
                                else if (item.category === "similar" || /답변|질의|국회/.test(sourceText)) modalType = "hwp";
                                else modalType = "pdf";
                            }
                            const modalExt = { pdf: "PDF", hwp: "HWP", docx: "DOCX", xlsx: "XLSX", pptx: "PPTX", img: "IMG", txt: "TXT" }[modalType] || "FILE";
                            return `<label class="smart-source-modal-item">
        <input type="checkbox" class="checkbox-control checkbox-control-sm" data-smart-modal-check="${item.id}" ${smartSearchSelectedIds.includes(item.id) ? "checked" : ""} />
        <span class="smart-source-modal-file-icon file-icon file-icon-collapsed ${modalType}" aria-hidden="true">${escapeHtml(modalExt)}</span>
        <span class="smart-source-modal-main" data-smart-modal-preview="${item.id}">
          <span class="smart-source-modal-name">${escapeHtml(item.title)}</span>
        </span>
      </label>`;
                        })
                        .join("");

                    $$("[data-smart-modal-check]", list).forEach((check) => {
                        check.addEventListener("change", () => {
                            const id = Number(check.dataset.smartModalCheck);
                            if (check.checked) {
                                if (!smartSearchSelectedIds.includes(id)) smartSearchSelectedIds.push(id);
                            } else {
                                smartSearchSelectedIds = smartSearchSelectedIds.filter((value) => value !== id);
                            }
                            updateSmartModalSelectionUi();
                        });
                    });
                    $$("[data-smart-modal-preview]", list).forEach((preview) => {
                        preview.addEventListener("click", (event) => {
                            if (event.target.closest("input")) return;
                            const rec = recommendations.find((item) => item.id === Number(preview.dataset.smartModalPreview));
                            if (rec) renderPreview(rec);
                        });
                    });
                    updateSmartModalSelectionUi();
                }

                // 지능형 소스 모달 열기
                function openSmartSourceModal() {
                    if (!smartLastResults.length) {
                        showToast("먼저 검색을 실행해주세요.");
                        return;
                    }
                    smartSearchSelectedIds = smartLastResults.map((item) => item.id);
                    renderSmartSourceModalList();
                    $("#smartSourceModal")?.classList.remove("hidden");
                    document.body.style.overflow = "hidden";
                }

                // 지능형 소스 모달 닫기
                function closeSmartSourceModal() {
                    $("#smartSourceModal")?.classList.add("hidden");
                    document.body.style.overflow = "";
                }

                // 크기 조절 지능형 검색 입력창 동작 처리
                function resizeSmartSearchTextarea(input = $("#smartSearchInput")) {
                    if (!input) return;
                    input.style.height = "auto";
                    const maxHeight = 96;
                    const minHeight = 34;
                    const nextHeight = Math.max(minHeight, Math.min(maxHeight, input.scrollHeight));
                    input.style.height = `${nextHeight}px`;
                    input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
                }

                // 지능형 소스 UI 초기화
                function resetSmartSourceUi() {
                    smartSearchRunSeq += 1;
                    if (smartSearchTimer) {
                        clearTimeout(smartSearchTimer);
                        smartSearchTimer = null;
                    }
                    smartLastResults = [];
                    smartSearchSelectedIds = [];
                    collapseSmartInlineResultsTemporary();
                    const input = $("#smartSearchInput");
                    if (input) {
                        input.value = "";
                        resizeSmartSearchTextarea(input);
                    }
                    $("#smartSearchBox")?.classList.remove("searching");
                    $("#smartSearchProgress")?.classList.add("hidden");
                    $("#smartSearchResults")?.classList.add("hidden");
                    $("#smartSearchGuide")?.classList.remove("hidden", "drag-over");
                    $("#smartImportedSection")?.classList.add("hidden");
                    $("#smartSearchHelpPopover")?.classList.add("hidden");
                    $("#smartSearchHelpBtn")?.classList.remove("active");
                    renderSmartImportedSources();
                    closeSmartSourceModal();
                }

                // 지능형 Expand 패널 컨트롤 동기화
                function syncSmartExpandPanelControl() {
                    const button = $("#leftPanelCollapseBtn");
                    if (!button) return;
                    if (!button.dataset.defaultPanelIcon) button.dataset.defaultPanelIcon = button.innerHTML;
                    if (smartInlineResultsExpanded) {
                        button.classList.add("smart-expand-cancel");
                        button.title = "전체 검색 소스 펼치기 취소";
                        button.setAttribute("aria-label", "전체 검색 소스 펼치기 취소");
                        button.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/><path d="M4 4h16v16H4z"/></svg>';
                    } else {
                        button.classList.remove("smart-expand-cancel");
                        button.title = "패널 접기";
                        button.setAttribute("aria-label", "패널 접기");
                        if (button.dataset.defaultPanelIcon) button.innerHTML = button.dataset.defaultPanelIcon;
                    }
                }

                // 지능형 Inline Results Expanded 설정
                function setSmartInlineResultsExpanded(expanded) {
                    const nextExpanded = Boolean(expanded);
                    const panel = $('[data-panel="folder"]');
                    const container = $(ANSWER_PANEL_SELECTOR);

                    if (nextExpanded === smartInlineResultsExpanded) {
                        panel?.classList.toggle("smart-results-expanded", nextExpanded);
                        syncSmartExpandPanelControl();
                        renderSmartCompactResults();
                        return;
                    }

                    if (panel && container && !isResponsiveAnswerMode()) {
                        if (nextExpanded) {
                            smartTemporaryLayoutSnapshot = getCurrentPanelLayoutState(container);
                            smartTemporaryLayoutActive = true;
                            const tempState = smartTemporaryLayoutSnapshot ? JSON.parse(JSON.stringify(smartTemporaryLayoutSnapshot)) : getDefaultPanelLayoutState(container);
                            const folderKey = getPanelKey(panel);
                            tempState.widthsByPanel[folderKey] = Math.min(610, Math.max(540, Math.round(container.clientWidth * 0.34)));
                            applyPanelLayoutState(container, tempState);
                        } else if (smartTemporaryLayoutSnapshot) {
                            applyPanelLayoutState(container, smartTemporaryLayoutSnapshot);
                            smartTemporaryLayoutSnapshot = null;
                            smartTemporaryLayoutActive = false;
                        } else {
                            smartTemporaryLayoutActive = false;
                        }
                    } else if (!nextExpanded) {
                        smartTemporaryLayoutSnapshot = null;
                        smartTemporaryLayoutActive = false;
                    }

                    smartInlineResultsExpanded = nextExpanded;
                    panel?.classList.toggle("smart-results-expanded", nextExpanded);
                    syncSmartExpandPanelControl();
                    renderSmartCompactResults();
                }

                // 지능형 Inline Results Temporary 접기
                function collapseSmartInlineResultsTemporary() {
                    if (smartInlineResultsExpanded || smartTemporaryLayoutActive) setSmartInlineResultsExpanded(false);
                    else {
                        $('[data-panel="folder"]')?.classList.remove("smart-results-expanded");
                        syncSmartExpandPanelControl();
                    }
                }

                // 지능형 Help Popover 위치 조정
                function positionSmartHelpPopover(button, popover) {
                    if (!button || !popover || popover.classList.contains("hidden")) return;
                    const rect = button.getBoundingClientRect();
                    const width = Math.min(360, window.innerWidth - 32);
                    let left = rect.right + 12;
                    if (left + width > window.innerWidth - 12) left = Math.max(12, rect.left - width - 12);
                    const top = Math.max(12, Math.min(window.innerHeight - 220, rect.top - 10));
                    popover.style.left = `${left}px`;
                    popover.style.top = `${top}px`;
                }

                // 지능형 소스 검색 초기화
                function initSmartAiSearch() {
                    const input = $("#smartSearchInput");
                    const searchButton = $("#smartSearchBtn");
                    const searchBox = $("#smartSearchBox");
                    const progress = $("#smartSearchProgress");
                    const guide = $("#smartSearchGuide");
                    const resultWrap = $("#smartSearchResults");
                    const collapsedButton = $("#collapsedAddBtn");
                    const helpButton = $("#smartSearchHelpBtn");
                    const helpPopover = $("#smartSearchHelpPopover");
                    const modal = $("#smartSourceModal");
                    if (!input || !searchButton || !resultWrap) return;
                    searchButton.disabled = input.value.trim().length === 0;

                    // 검색 Tokens 동작 처리
                    const searchTokens = (value) =>
                        String(value || "")
                            .toLowerCase()
                            .replace(/[^0-9a-zA-Z가-힣]+/g, " ")
                            .trim()
                            .split(/\s+/)
                            .filter((token) => token.length > 1);

                    // rank 추천자료 동작 처리
                    const rankRecommendations = (query) => {
                        const tokens = searchTokens(query);
                        return recommendations
                            .filter((item) => !smartImportedSourceIds.includes(item.id))
                            .map((item) => {
                                const haystack = `${item.title} ${item.meta} ${item.desc} ${(item.tags || []).join(" ")}`.toLowerCase();
                                const hits = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
                                const intentBoost = /법|근거|시행령|규정|지침/.test(query) && /법|근거|시행령|규정|지침/.test(haystack) ? 18 : 0;
                                const answerBoost = /답변|질의|국회/.test(query) && item.category === "similar" ? 12 : 0;
                                const dataBoost = /현황|통계|예산|수치|추이/.test(query) && /현황|통계|예산|수치|추이/.test(haystack) ? 14 : 0;
                                return { item, rankScore: item.score + hits * 16 + intentBoost + answerBoost + dataBoost };
                            })
                            .sort((a, b) => b.rankScore - a.rankScore || b.item.score - a.item.score)
                            .map(({ item }, index) => ({ ...item, aiScore: Math.max(71, Math.min(98, item.score + 4 - index)) }));
                    };

                    // 지능형 검색 실행
                    const runSmartSearch = () => {
                        const query = input.value.trim();
                        if (!query) {
                            input.focus();
                            showToast("검색할 질의나 키워드를 입력해주세요.");
                            return;
                        }

                        const runId = ++smartSearchRunSeq;
                        if (smartSearchTimer) clearTimeout(smartSearchTimer);
                        closeSmartSourceModal();
                        collapseSmartInlineResultsTemporary();
                        smartLastResults = [];
                        smartSearchSelectedIds = [];
                        renderSmartCompactResults();
                        searchBox?.classList.add("searching");
                        progress?.classList.remove("hidden");
                        searchButton.disabled = true;
                        resultWrap.classList.add("hidden");

                        // AI 에이전트 API 연계 지점 ⑤ AI 참조소스 검색
                        // runId로 이전 검색 응답을 무시하여 실제 비동기 API에서도 최신 요청만 화면에 반영합니다.
                        smartSearchTimer = setTimeout(() => {}, 0);
                        window.AIOneAgentBridge.searchReferenceSources(
                            {
                                query,
                                chatTopicId: chatTopics[activeChatTopic]?.id || activeChatTopic,
                            },
                            () => rankRecommendations(query),
                            820,
                        )
                            .then((results) => {
                                if (runId !== smartSearchRunSeq) return;
                                if (smartSearchTimer) clearTimeout(smartSearchTimer);
                                smartSearchTimer = null;
                                smartLastResults = Array.isArray(results) ? results : [];
                                smartSearchSelectedIds = smartLastResults.slice(0, 3).map((item) => item.id);
                                renderSmartCompactResults();
                                keepSmartSourceDropzoneVisible();
                                searchBox?.classList.remove("searching");
                                progress?.classList.add("hidden");
                                searchButton.disabled = false;
                                if (!smartLastResults.length) showToast("새롭게 가져올 수 있는 검색 결과가 없습니다.");
                            })
                            .catch((error) => {
                                if (runId !== smartSearchRunSeq) return;
                                console.error("[AI-ONE] 참조소스 검색 API 오류", error);
                                smartSearchTimer = null;
                                searchBox?.classList.remove("searching");
                                progress?.classList.add("hidden");
                                searchButton.disabled = false;
                                showToast("소스 검색 중 오류가 발생했습니다. 다시 시도해 주세요.");
                            });
                    };

                    searchButton.addEventListener("click", runSmartSearch);
                    input.addEventListener("input", () => {
                        resizeSmartSearchTextarea(input);
                        if (!searchBox?.classList.contains("searching")) searchButton.disabled = input.value.trim().length === 0;
                        if (!resultWrap.classList.contains("hidden")) {
                            smartLastResults = [];
                            smartSearchSelectedIds = [];
                            collapseSmartInlineResultsTemporary();
                            renderSmartCompactResults();
                            resultWrap.classList.add("hidden");
                        }
                    });
                    input.addEventListener("keydown", (event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            runSmartSearch();
                        }
                    });
                    resizeSmartSearchTextarea(input);

                    $("#smartListViewBtn")?.addEventListener("click", openSmartSourceModal);
                    $("#smartOtherSourcesBtn")?.addEventListener("click", () => {
                        if (smartLastResults.length <= 3) {
                            showToast("추가 검색 소스가 없습니다.");
                            return;
                        }
                        setSmartInlineResultsExpanded(!smartInlineResultsExpanded);
                    });
                    $("#smartSearchImportBtn")?.addEventListener("click", () => importSmartSources([...smartSearchSelectedIds]));
                    $("#smartSearchDeleteBtn")?.addEventListener("click", () => {
                        if (!smartLastResults.length) {
                            showToast("삭제할 검색 결과가 없습니다.");
                            return;
                        }
                        const resultTotal = smartLastResults.length;
                        openCustomConfirmPanel("search-results-delete", `검색 결과 ${resultTotal}건 전체`, () => {
                            smartLastResults = [];
                            smartSearchSelectedIds = [];
                            collapseSmartInlineResultsTemporary();
                            renderSmartCompactResults();
                            closeSmartSourceModal();
                            showToast("전체 검색 결과를 삭제했습니다.");
                        });
                    });

                    helpButton?.addEventListener("click", (event) => {
                        event.stopPropagation();
                        const willOpen = helpPopover?.classList.contains("hidden");
                        helpPopover?.classList.toggle("hidden", !willOpen);
                        helpButton.classList.toggle("active", Boolean(willOpen));
                        helpButton.setAttribute("aria-expanded", String(Boolean(willOpen)));
                        if (willOpen) requestAnimationFrame(() => positionSmartHelpPopover(helpButton, helpPopover));
                    });
                    document.addEventListener("click", (event) => {
                        if (!event.target.closest("#smartSearchHelpBtn") && !event.target.closest("#smartSearchHelpPopover")) {
                            helpPopover?.classList.add("hidden");
                            helpButton?.classList.remove("active");
                            helpButton?.setAttribute("aria-expanded", "false");
                        }
                    });

                    // 지능형 Uploaded 파일 추가
                    const addSmartUploadedFiles = (dropped) => {
                        if (!dropped.length) return;
                        const runId = workspaceRunSeq;
                        const addedFiles = dropped.map((file) => {
                            const size = file.size >= 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)}MB` : `${Math.max(1, Math.round(file.size / 1024))}KB`;
                            const source = {
                                id: ++fileIdSeq,
                                name: file.name,
                                size,
                                type: getReferenceFileType(file.name),
                                status: "chunking",
                                chunks: 0,
                                selected: false,
                                sourceOrder: ++smartUnifiedSourceOrderSeq,
                                simulateFailure: /오류|손상|실패|error|broken/i.test(file.name),
                            };
                            files.push(source);
                            return source;
                        });
                        renderFiles();
                        keepSmartSourceDropzoneVisible();
                        showToast(`파일 ${addedFiles.length}개의 문서 청킹을 시작합니다.`);

                        let completed = 0;
                        addedFiles.forEach((source, index) => {
                            setTimeout(
                                () => {
                                    if (runId !== workspaceRunSeq || !files.includes(source)) return;
                                    const originalFile = dropped[index];
                                    if (source.simulateFailure) {
                                        source.status = "failed";
                                        source.selected = false;
                                        source.failureReason = "문서 내용을 분석하지 못했습니다.";
                                    } else {
                                        source.status = "done";
                                        source.selected = true;
                                        source.chunks = Math.max(3, Math.min(18, Math.round((originalFile?.size || 540000) / 180000)));
                                    }
                                    completed += 1;
                                    renderFiles();
                                    renderRecommendations();
                                    if (completed === addedFiles.length) {
                                        const succeeded = addedFiles.filter((item) => item.status === "done");
                                        const failed = addedFiles.filter((item) => item.status === "failed");
                                        if (succeeded.length) appendAddedSourcesExplanation(succeeded, "upload");
                                        showToast(failed.length ? `파일 ${succeeded.length}개 추가 완료 · ${failed.length}개 청킹 실패` : `파일 ${succeeded.length}개가 소스로 추가되었습니다.`);
                                    }
                                },
                                850 + index * 260,
                            );
                        });
                    };

                    guide?.addEventListener("app:file-upload", (event) => {
                        event.stopPropagation();
                        const uploadedFiles = [...(event.detail?.files || [])];
                        validateFilesBeforeUpload(uploadedFiles, addSmartUploadedFiles);
                    });

                    $("#smartImportedSort")?.addEventListener("change", (event) => {
                        smartImportedSortOrder = event.target.value === "latest" ? "latest" : "oldest";
                        renderSmartImportedSources();
                    });

                    $("#smartAutoLabelBtn")?.addEventListener("click", () => {
                        smartGroupMode = !smartGroupMode;
                        smartExpandedTopics.clear();
                        if (smartGroupMode) showToast("소스를 주제별 자동 라벨로 분류했습니다.");
                        renderSmartImportedSources();
                    });

                    $("#smartInlineSelectAll")?.addEventListener("change", (event) => {
                        smartSearchSelectedIds = event.target.checked ? smartLastResults.map((item) => item.id) : [];
                        $$("#smartSearchResultsList [data-smart-inline-check]").forEach((check) => {
                            check.checked = event.target.checked;
                        });
                        updateSmartModalSelectionUi();
                    });

                    $("#smartSourceSelectAll")?.addEventListener("change", (event) => {
                        smartSearchSelectedIds = event.target.checked ? smartLastResults.map((item) => item.id) : [];
                        renderSmartSourceModalList();
                        renderSmartCompactResults();
                    });
                    $("#smartSourceModalImport")?.addEventListener("click", () => importSmartSources([...smartSearchSelectedIds], true));
                    $("#smartSourceModalClose")?.addEventListener("click", closeSmartSourceModal);
                    $("#smartSourceModalCancel")?.addEventListener("click", closeSmartSourceModal);
                    modal?.addEventListener("click", (event) => {
                        if (isModalBackgroundClick(event, modal)) closeSmartSourceModal();
                    });
                    document.addEventListener("keydown", (event) => {
                        if (event.key === "Escape") {
                            closeSmartSourceModal();
                            helpPopover?.classList.add("hidden");
                            helpButton?.classList.remove("active");
                        }
                    });

                    if (collapsedButton) {
                        collapsedButton.addEventListener("click", () => {
                            const panel = $('[data-panel="folder"]');
                            if (panel?.classList.contains("panel-collapsed")) setPanelCollapsed(panel, false);
                            setTimeout(() => input.focus(), 80);
                        });
                    }

                    renderSmartImportedSources();
                }

                /* ============================ 끝: AI 참조소스 검색 ============================== */

                initSmartAiSearch();
                init();
            })();
        } catch (error) {
            console.error("[AI-ONE] after-9 화면 초기화 오류", error);
        }

        /* ============================ 끝: 화면 핵심 동작 ============================== */

        /* ============================ 시작: 옵션 메뉴 방향 ============================ */

        (function () {
            const buttonSelector = ".btn-more.small,.source-more-btn,.msg-more-btn";
            const menuSelector = ".file-more-menu,.source-more-menu,.msg-more-menu";

            // 메뉴 해결
            function resolveMenu(button) {
                if (!button) return null;
                if (button.matches(".btn-more.small")) return button.closest(".file-action-wrap")?.querySelector(".file-more-menu");
                if (button.matches(".source-more-btn")) return button.closest("li,.source-file-item,.smart-imported-item")?.querySelector(".source-more-menu");
                if (button.matches(".msg-more-btn")) return button.closest(".msg-more-wrap")?.querySelector(".msg-more-menu");
                return null;
            }

            // 메뉴 배치 경계 조회
            function getBoundary(button) {
                const container = button.closest(".file-list,.smart-imported-source-list,.smart-imported-list,.messages-container,.chat-messages");
                if (container) {
                    const rect = container.getBoundingClientRect();
                    return { top: Math.max(8, rect.top), bottom: Math.min(window.innerHeight - 8, rect.bottom) };
                }
                return { top: 8, bottom: window.innerHeight - 8 };
            }

            // 메뉴 위치 조정
            function positionMenu(button, menu) {
                if (!button || !menu || menu.classList.contains("hidden")) return;
                menu.classList.remove("menu-open-up");
                const boundary = getBoundary(button);
                const buttonRect = button.getBoundingClientRect();
                const menuHeight = Math.max(menu.scrollHeight || 0, menu.offsetHeight || 0, 126);
                const spaceBelow = boundary.bottom - buttonRect.bottom;
                const spaceAbove = buttonRect.top - boundary.top;
                const openUp = spaceBelow < menuHeight + 10 && spaceAbove > spaceBelow;
                menu.classList.toggle("menu-open-up", openUp);
            }

            document.addEventListener("click", function (event) {
                const button = event.target.closest(buttonSelector);
                if (!button) return;
                window.setTimeout(function () {
                    const menu = resolveMenu(button);
                    if (menu) positionMenu(button, menu);
                }, 0);
            });

            document.addEventListener("click", function (event) {
                if (event.target.closest(buttonSelector + "," + menuSelector)) return;
                document.querySelectorAll(menuSelector).forEach(function (menu) {
                    menu.classList.remove("menu-open-up");
                });
            });

            window.addEventListener("resize", function () {
                document.querySelectorAll(buttonSelector).forEach(function (button) {
                    const menu = resolveMenu(button);
                    if (menu && !menu.classList.contains("hidden")) positionMenu(button, menu);
                });
            });
        })();

        /* ============================ 끝: 옵션 메뉴 방향 ============================== */

        /* ============================ 시작: 옵션 메뉴 경계 ============================ */

        (function () {
            if (window.__aiOneOptionBoundaryClickAwayV2) return;
            window.__aiOneOptionBoundaryClickAwayV2 = true;

            const buttonSelector = ".btn-more.small,.source-more-btn,.msg-more-btn";
            const menuSelector = ".file-more-menu,.source-more-menu,.msg-more-menu";

            // 메뉴 해결
            function resolveMenu(button) {
                if (!button) return null;
                const parentSelectors = ".file-action-wrap,.source-action-wrap,.msg-more-wrap,.file-item-simple,.smart-imported-file-item,li";
                const parent = button.closest(parentSelectors);
                if (!parent) return null;
                if (button.matches(".btn-more.small")) return parent.querySelector(".file-more-menu");
                if (button.matches(".source-more-btn")) return parent.querySelector(".source-more-menu");
                if (button.matches(".msg-more-btn")) return parent.querySelector(".msg-more-menu");
                return parent.querySelector(menuSelector);
            }

            // 메뉴 배치 경계 조회
            function getBoundary(button) {
                const container = button.closest(".file-list,.smart-imported-list,.smart-topic-files,.messages-container,.chat-messages");
                if (!container) return { top: 8, bottom: window.innerHeight - 8 };
                const rect = container.getBoundingClientRect();
                return { top: Math.max(8, rect.top), bottom: Math.min(window.innerHeight - 8, rect.bottom) };
            }

            // Near 목록 End 상태 확인
            function isNearListEnd(button) {
                const item = button.closest("li,.file-item-simple,.smart-imported-file-item,.message");
                if (!item || !item.parentElement) return false;
                const visible = Array.from(item.parentElement.children).filter((el) => {
                    const style = getComputedStyle(el);
                    return style.display !== "none" && !el.classList.contains("hidden");
                });
                const index = visible.indexOf(item);
                return index >= 0 && index >= visible.length - 2;
            }

            // 메뉴 위치 조정
            function positionMenu(button, menu) {
                if (!button || !menu || menu.classList.contains("hidden")) return;
                menu.classList.remove("menu-open-up", "open-up");
                const boundary = getBoundary(button);
                const buttonRect = button.getBoundingClientRect();
                const menuHeight = Math.max(menu.offsetHeight || 0, menu.scrollHeight || 0, 132);
                const spaceBelow = boundary.bottom - buttonRect.bottom;
                const spaceAbove = buttonRect.top - boundary.top;
                const openUp = isNearListEnd(button) || spaceBelow < menuHeight + 12 || buttonRect.bottom > window.innerHeight - menuHeight - 16;
                if (openUp && spaceAbove > 48) menu.classList.add("menu-open-up", "open-up");
            }

            // 모든 옵션 메뉴 닫기
            function closeAll(except) {
                document.querySelectorAll(menuSelector).forEach((menu) => {
                    if (except && menu === except) return;
                    menu.classList.add("hidden");
                    menu.classList.remove("menu-open-up", "open-up");
                });
                document.querySelectorAll(buttonSelector).forEach((button) => {
                    const menu = resolveMenu(button);
                    if (!except || menu !== except) button.setAttribute("aria-expanded", "false");
                });
            }

            document.addEventListener(
                "click",
                function (event) {
                    const button = event.target.closest(buttonSelector);
                    const insideMenu = event.target.closest(menuSelector);
                    if (!button && !insideMenu) closeAll(null);
                    if (button) {
                        window.setTimeout(function () {
                            const menu = resolveMenu(button);
                            if (menu && !menu.classList.contains("hidden")) positionMenu(button, menu);
                        }, 0);
                    }
                },
                true,
            );

            window.addEventListener("resize", function () {
                document.querySelectorAll(buttonSelector).forEach((button) => {
                    const menu = resolveMenu(button);
                    if (menu && !menu.classList.contains("hidden")) positionMenu(button, menu);
                });
            });
        })();

        /* ============================ 끝: 옵션 메뉴 경계 ============================== */

        /* ============================ 시작: 지능형 검색 버튼 상태 ============================ */

        (function () {
            // 화면 초기화
            function init() {
                const input = document.getElementById("smartSearchInput");
                const button = document.getElementById("smartSearchBtn");
                const box = document.getElementById("smartSearchBox");
                if (!input || !button || input.dataset.disabledStateV4 === "true") return;
                input.dataset.disabledStateV4 = "true";
                // 화면 상태 동기화
                const sync = () => {
                    if (!box?.classList.contains("searching")) button.disabled = input.value.trim().length === 0;
                    button.setAttribute("aria-disabled", String(button.disabled));
                };
                input.addEventListener("input", sync);
                input.addEventListener("change", sync);
                const observer = new MutationObserver(sync);
                observer.observe(box, { attributes: true, attributeFilter: ["class"] });
                sync();
            }
            if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
            else init();
        })();

        /* ============================ 끝: 지능형 검색 버튼 상태 ============================== */

        /* ============================ 시작: 옵션 메뉴 외부 클릭 ============================ */

        (function () {
            if (window.__aiOneOptionMenuClickOnlyV3) return;
            window.__aiOneOptionMenuClickOnlyV3 = true;
            const menuSelector = ".file-more-menu,.source-more-menu,.msg-more-menu";
            const buttonSelector = ".btn-more.small,.source-more-btn,.msg-more-btn";
            // 옵션 메뉴는 포인터 이동으로 닫지 않고, 메뉴/버튼 외부의 실제 클릭에서만 닫는다.
            document.addEventListener("click", function (event) {
                if (event.target.closest(buttonSelector) || event.target.closest(menuSelector)) return;
                document.querySelectorAll(menuSelector).forEach((menu) => {
                    menu.classList.add("hidden");
                    menu.classList.remove("menu-open-up", "open-up");
                });
                document.querySelectorAll(buttonSelector).forEach((button) => button.setAttribute("aria-expanded", "false"));
            });
        })();

        /* ============================ 끝: 옵션 메뉴 외부 클릭 ============================== */

        /* ============================ 시작: AI 에이전트 연동 ============================ */

        /*
         * AI-ONE AI Agent API 연계 지점
         * 현재 프로토타입은 mode='mock'으로 기존 예시 데이터를 그대로 사용합니다.
         * API 규격 확정 후 endpoint와 mode만 변경하면 화면 이벤트 코드는 유지할 수 있습니다.
         * 버전 비교/답변서 비교는 채팅 프롬프트를 생성하지 않고 선택 이벤트에서 조회·차이점 분석 API를 직접 호출합니다.
         */
        (function () {
            if (window.AIOneAgentBridge) return;
            const config = {
                mode: window.AI_ONE_AGENT_API_MODE || "mock",
                endpoints: {
                    questionUpload: null, // 질의 업로드 → OCR/파싱/질의추출/분류
                    questionReclassify: null, // 재분류
                    notificationSend: null, // 확정 결과 전달 → AI Agent → Brity Works
                    chatPrompt: null, // 채팅 프롬프트 전송
                    referenceSearch: null, // AI 참조소스 검색
                    referenceImport: null, // 선택 소스 가져오기/등록/청킹
                    draftVersionGet: null, // 초안 버전 본문 조회 (선택 버전만)
                    similarAnswerGet: null, // 유사답변서 본문 조회 (선택 문서만)
                    draftDifferenceAnalyze: null, // 초안 버전 간 AI 차이점 분석
                    answerDifferenceAnalyze: null, // 유사답변서 ↔ 초안 버전 AI 차이점 분석
                },
            };

            // 목업 응답 지연 처리
            function resolveMock(mockFactory, delay) {
                return new Promise((resolve, reject) => {
                    window.setTimeout(
                        () => {
                            try {
                                resolve(typeof mockFactory === "function" ? mockFactory() : mockFactory);
                            } catch (error) {
                                reject(error);
                            }
                        },
                        Math.max(0, Number(delay) || 0),
                    );
                });
            }

            // AI 에이전트 API 요청
            async function request(key, payload, mockFactory, mockDelay) {
                if (config.mode !== "live") return resolveMock(mockFactory, mockDelay);
                const endpoint = config.endpoints[key];
                if (!endpoint) throw new Error("AI Agent API endpoint가 설정되지 않았습니다: " + key);
                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(payload || {}),
                });
                if (!response.ok) throw new Error("AI Agent API 호출 실패: " + response.status);
                return response.json();
            }

            window.AIOneAgentBridge = {
                config,
                classifyUploadedQuestions(payload, mockFactory, delay) {
                    return request("questionUpload", payload, mockFactory, delay);
                },
                reclassifyQuestions(payload, mockFactory, delay) {
                    return request("questionReclassify", payload, mockFactory, delay);
                },
                sendClassificationNotification(payload, mockFactory, delay) {
                    return request("notificationSend", payload, mockFactory, delay);
                },
                sendChatPrompt(payload, mockFactory, delay) {
                    return request("chatPrompt", payload, mockFactory, delay);
                },
                searchReferenceSources(payload, mockFactory, delay) {
                    return request("referenceSearch", payload, mockFactory, delay);
                },
                importReferenceSources(payload, mockFactory, delay) {
                    return request("referenceImport", payload, mockFactory, delay);
                },
                getDraftVersion(payload, mockFactory, delay) {
                    return request("draftVersionGet", payload, mockFactory, delay);
                },
                getSimilarAnswer(payload, mockFactory, delay) {
                    return request("similarAnswerGet", payload, mockFactory, delay);
                },
                analyzeDraftDifference(payload, mockFactory, delay) {
                    return request("draftDifferenceAnalyze", payload, mockFactory, delay);
                },
                analyzeAnswerDifference(payload, mockFactory, delay) {
                    return request("answerDifferenceAnalyze", payload, mockFactory, delay);
                },
            };
        })();

        /* ============================ 끝: AI 에이전트 연동 ============================== */

        /* ============================ 시작: 전체보기 UI ============================ */

        (function () {
            if (window.__aiOneFullviewCommonV154) return;
            window.__aiOneFullviewCommonV154 = true;
            const ENTER_ICON =
                '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            const EXIT_ICON =
                '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8 3v5H3M21 8h-5V3M16 21v-5h5M3 16h5v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            const ENTER_MESSAGE = "전체보기 모드입니다. ESC 키를 누르면 종료됩니다.";
            const EXIT_MESSAGE = "전체보기를 종료했습니다.";

            // 아이콘 설정
            function setIcon(button, active, enterLabel) {
                if (!button) return;
                const label = enterLabel || button.dataset.fullviewBaseLabel || button.getAttribute("aria-label") || "전체보기";
                if (!button.dataset.fullviewBaseLabel) button.dataset.fullviewBaseLabel = label.replace(/ 종료$/, "");
                const base = button.dataset.fullviewBaseLabel;
                const iconHost = button.matches(".accessory-action") ? button.querySelector(".accessory-action-icon") : null;
                if (iconHost) iconHost.innerHTML = active ? EXIT_ICON : ENTER_ICON;
                else button.innerHTML = active ? EXIT_ICON : ENTER_ICON;
                button.classList.toggle("fullview-exit-state", !!active);
                button.setAttribute("aria-pressed", String(!!active));
                button.setAttribute("aria-label", active ? `${base} 종료` : base);
                button.setAttribute("title", active ? `${base} 종료` : base);
            }

            // 화면 상태 동기화
            function sync() {
                document.querySelectorAll('.doc-viewer-panel [data-action="fullscreen"]').forEach((btn) => {
                    const panel = btn.closest(".doc-viewer-panel");
                    setIcon(btn, !!panel?.classList.contains("doc-viewer-fullscreen"));
                });
                const versionBtn = document.getElementById("draftCompareFullscreen");
                if (versionBtn) setIcon(versionBtn, !!document.querySelector("#draftVersionCompare.is-fullscreen"), "버전 비교 전체보기");
                document.querySelectorAll('[data-accessory-action="fullscreen"]').forEach((btn) => setIcon(btn, !!(document.fullscreenElement || document.webkitFullscreenElement), "전체화면"));
            }

            // Enter 토스트 표시
            function toastEnter() {
                if (typeof window.showToast === "function") window.showToast(ENTER_MESSAGE);
            }
            // Exit 토스트 표시
            function toastExit() {
                if (typeof window.showToast === "function") window.showToast(EXIT_MESSAGE);
            }
            window.AIOneFullviewUI = { ENTER_ICON, EXIT_ICON, ENTER_MESSAGE, EXIT_MESSAGE, setIcon, sync, toastEnter, toastExit };

            document.addEventListener(
                "click",
                function (e) {
                    if (e.target.closest('[data-action="fullscreen"],#draftCompareFullscreen,[data-accessory-action="fullscreen"]')) {
                        setTimeout(sync, 0);
                        setTimeout(sync, 80);
                    }
                },
                true,
            );
            document.addEventListener("fullscreenchange", sync);
            document.addEventListener("webkitfullscreenchange", sync);
            document.addEventListener(
                "keydown",
                function (e) {
                    if (e.key !== "Escape") return;
                    let changed = false;
                    document.querySelectorAll(".doc-viewer-panel.doc-viewer-fullscreen").forEach((el) => {
                        el.classList.remove("doc-viewer-fullscreen");
                        changed = true;
                    });
                    document.querySelectorAll(".compare-view.compare-view-fullscreen").forEach((el) => {
                        el.classList.remove("compare-view-fullscreen");
                        changed = true;
                    });
                    document.querySelectorAll("#draftVersionCompare.is-fullscreen").forEach((el) => {
                        el.classList.remove("is-fullscreen");
                        changed = true;
                    });
                    if (changed) setTimeout(sync, 0);
                },
                true,
            );
            if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(sync, 0));
            else setTimeout(sync, 0);
        })();

        /* ============================ 끝: 전체보기 UI ============================== */
    }

    /* ============================ 시작: 화면 시작 조건 ============================ */

    // 완료 답변 화면 시작 조건 확인
    function tryStartAfter9Workspace() {
        hydrateIcons(document);
        if (workspaceStarted) return;

        const sidebar = document.querySelector(".app > .sidebar");
        const panelArea = document.querySelector(".three-panel-area");
        const threePanel = panelArea?.querySelector(".three-panel");
        const topbarArea = document.querySelector(".app > .main-wrap > .topbar-area");
        const topbar = topbarArea?.querySelector(".app-topbar");
        const smartUpload = document.querySelector("#smartSearchGuide [data-file-upload-zone]");
        const reportSidepop = document.querySelector("#answerReportSidepop[data-sidepop]");
        const reportUpload = reportSidepop?.querySelector("#reportUploadZone [data-file-upload-zone]");
        const toast = document.querySelector("#answerAfter9Toast[data-toast]");

        if (!sidebar || !topbar || !threePanel || !smartUpload || !reportSidepop || !reportUpload || !toast) return;

        window.AIOneSidebar?.configure(sidebar, {
            initialCollapsed: false,
            storageKey: "sidebar-collapsed",
            collapseOnNavigate: true,
        });
        startAfter9Workspace();
    }

    document.addEventListener("DOMContentLoaded", tryStartAfter9Workspace);
    tryStartAfter9Workspace();

    /* ============================ 끝: 화면 시작 조건 ============================== */
})();

/* ============================ 끝: AI 답변 완료 화면 ============================== */
