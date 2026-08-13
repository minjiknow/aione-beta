(() => {
    "use strict";
    /* 파일 구성: 홈 정적 화면 보강 -> 기록 모달 -> 이동 및 서비스 동작. */
    // 정적 페이지 마크업을 사용하는 AI-ONE 홈 전용 로직입니다.

    const isComponentCatalog = new URLSearchParams(window.location.search).get("view") === "component-catalog";
    if (isComponentCatalog) {
        document.documentElement.classList.add("component-catalog-preview");
    }

    const iconBaseUrl = new URL("../assets/icons/", document.baseURI);
    let historyModalReturnFocus = null;

    // 아이콘 경로 보정
    function hydrateIcons(root = document) {
        root.querySelectorAll?.("img[data-icon]").forEach((icon) => {
            if (icon.src) return;
            icon.src = new URL(`${icon.dataset.icon}.svg`, iconBaseUrl).href;
        });
    }

    // Open 준비 모달 시도
    function tryOpenPreparingModal(trigger) {
        const modal = document.getElementById("preparingServiceModal");
        if (modal && window.AIOneModal) {
            window.AIOneModal.open(modal, trigger);
            return true;
        }
        return false;
    }

    // 준비 모달 열기
    function openPreparingModal(trigger) {
        tryOpenPreparingModal(trigger);
    }

    // 이력 Row 열기
    function openHistoryRow(row) {
        if (!row) return;
        const target = row.dataset.historyTarget || "ai-answer.html";

        sessionStorage.setItem("ai-one-history-task", row.dataset.historyTitle || "");
        window.location.href = target;
    }

    // 전체 이력 Row 열기
    function openFullHistoryRow(row) {
        if (!row) return;

        sessionStorage.setItem("ai-one-history-task", row.dataset.historyTitle || "");
        window.location.href = row.dataset.historyTarget || "ai-answer.html";
    }

    // 전체 이력 필터링
    function filterFullHistory() {
        const modal = document.querySelector("[data-home-history-modal]");
        const search = modal?.querySelector("[data-home-history-search]");
        const clear = modal?.querySelector("[data-home-history-clear]");
        const result = modal?.querySelector("[data-home-history-result]");
        const table = modal?.querySelector(".history-table.full");
        const empty = modal?.querySelector("[data-home-history-empty]");
        if (!modal || !search) return;

        const keyword = search.value.trim().toLocaleLowerCase("ko-KR");
        let visibleCount = 0;
        const rows = Array.from(modal.querySelectorAll("[data-full-history-row]"));
        rows.forEach((row) => {
            const isVisible = !keyword || row.textContent.toLocaleLowerCase("ko-KR").includes(keyword);
            row.hidden = !isVisible;
            if (isVisible) visibleCount += 1;
        });
        if (clear) clear.hidden = !keyword;
        if (result) {
            result.textContent = keyword ? `검색 결과 ${visibleCount}건` : `총 ${rows.length}건`;
        }
        if (table) table.hidden = visibleCount === 0;
        if (empty) empty.hidden = visibleCount !== 0;
    }

    // 전체 이력 닫기
    function closeFullHistory() {
        const modal = document.querySelector("[data-home-history-modal]");
        if (!modal || modal.hidden) return;
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
        historyModalReturnFocus?.focus();
        historyModalReturnFocus = null;
    }

    // 전체 이력 열기
    function openFullHistory(trigger) {
        const modal = document.querySelector("[data-home-history-modal]");
        const search = modal?.querySelector("[data-home-history-search]");
        if (!modal) return;

        historyModalReturnFocus = trigger || document.activeElement;
        modal.hidden = false;
        modal.setAttribute("aria-hidden", "false");
        if (search) search.value = "";
        filterFullHistory();
        window.requestAnimationFrame(() => search?.focus());
    }

    // 전체 이력 모달 초기화
    function initFullHistoryModal() {
        const modal = document.querySelector("[data-home-history-modal]");
        if (!modal || modal.dataset.ready === "true") return;
        modal.dataset.ready = "true";
        modal.querySelector("[data-home-history-close]")?.addEventListener("click", closeFullHistory);
        modal.querySelector("[data-home-history-search]")?.addEventListener("input", filterFullHistory);
        modal.querySelector("[data-home-history-clear]")?.addEventListener("click", () => {
            const search = modal.querySelector("[data-home-history-search]");
            search.value = "";
            filterFullHistory();
            search.focus();
        });
        modal.addEventListener("click", (event) => {
            if (event.target === modal) {
                closeFullHistory();
                return;
            }
            const row = event.target.closest("[data-full-history-row]");
            if (row) openFullHistoryRow(row);
        });
        modal.addEventListener("keydown", (event) => {
            const row = event.target.closest("[data-full-history-row]");
            if (row && ["Enter", " "].includes(event.key)) {
                event.preventDefault();
                openFullHistoryRow(row);
                return;
            }
            if (event.key === "Escape") {
                event.preventDefault();
                closeFullHistory();
                return;
            }
            if (event.key !== "Tab") return;

            const focusable = Array.from(modal.querySelectorAll('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hidden && element.getClientRects().length > 0);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable.at(-1);
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    }

    // 사이드바 보강
    function enhanceSidebar(host) {
        const sidebar = host.querySelector(".app-sidebar");
        if (!sidebar || sidebar.dataset.homeReady === "true") return;

        sidebar.dataset.homeReady = "true";
        const sidebarHost = sidebar.closest(".home-sidebar-host");
        window.AIOneSidebar?.configure(sidebar, {
            activePage: "home",
            initialCollapsed: false,
            stateTarget: sidebarHost,
            collapsedClass: "sidebar-collapsed",
            expandedClass: "sidebar-expanded",
        });

        sidebar.querySelectorAll(".nav-link").forEach((link) => {
            if (link.getAttribute("aria-disabled") === "true") {
                link.addEventListener("click", (event) => {
                    event.preventDefault();
                    openPreparingModal(link);
                });
            }
        });
    }

    // 데이터 테이블 보강
    function enhanceDataTable(host) {
        const table = host?.querySelector("[data-home-datatable]");
        if (!table || table.dataset.homeReady === "true") return;

        table.dataset.homeReady = "true";
        table.querySelectorAll("tbody tr[data-history-title]").forEach((row) => {
            row.tabIndex = 0;
            row.setAttribute("role", "link");
            row.setAttribute("aria-label", `${row.dataset.historyTitle} 열기`);
        });

        const moreLink = host.querySelector(".data-table-more");
        moreLink?.addEventListener("click", (event) => {
            event.preventDefault();
            openFullHistory(moreLink);
        });
    }

    // 프롬프트 작성창 초기화
    function initPromptComposer() {
        const host = document.querySelector("[data-home-prompt-composer]");
        if (!host || host.dataset.homePromptComposerReady === "true") return;

        host.dataset.homePromptComposerReady = "true";
        host.addEventListener("promptcomposer:submit", (event) => {
            if (!host.contains(event.target)) return;
            openPreparingModal(host.querySelector("[data-prompt-submit]"));
        });
    }

    // 이력 화면 이벤트 연결
    function initHistoryEvents() {
        document.addEventListener("click", (event) => {
            if (event.target.closest(".data-table-actions")) return;
            const row = event.target.closest(".data-table tbody tr[data-history-title]");
            if (row) openHistoryRow(row);
        });

        document.addEventListener("keydown", (event) => {
            if (!["Enter", " "].includes(event.key)) return;
            if (event.target.closest(".data-table-actions")) return;
            const row = event.target.closest(".data-table tbody tr[data-history-title]");
            if (!row) return;
            event.preventDefault();
            openHistoryRow(row);
        });
    }

    // 준비 중 카드 초기화
    function initPreparingCards() {
        document.addEventListener("click", (event) => {
            const card = event.target.closest(".service-card[data-soon], .service-card[data-modal-open]");
            if (!card) return;
            event.preventDefault();
            if (card.dataset.modalOpen) {
                if (!document.getElementById(card.dataset.modalOpen) || !window.AIOneModal) {
                    openPreparingModal(card);
                }
                return;
            }
            openPreparingModal(card);
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        hydrateIcons();
        enhanceSidebar(document);
        enhanceDataTable(document.querySelector(".home-history"));
        initPromptComposer();
        initFullHistoryModal();
        initHistoryEvents();
        initPreparingCards();
    });
})();
