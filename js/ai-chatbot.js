(function () {
    "use strict";

    /* 파일 구성: 팝업/보고서 드로어 -> 채팅 상태 및 렌더링 -> 페이지 이벤트 연결. */

    /* ============================ 시작: 기본 화면과 팝업 ============================ */

    // DOM 요소 하나 조회
    const $ = (s, c = document) => c.querySelector(s);
    // DOM 요소 목록 조회
    const $$ = (s, c = document) => [...c.querySelectorAll(s)];

    const messages = [];
    let pageReady = false;

    // Prototype Element 복제
    function clonePrototypeElement(prototypeId) {
        const prototype = document.getElementById(prototypeId);
        if (!prototype) return null;
        const clone = prototype.cloneNode(true);
        clone.removeAttribute("id");
        clone.removeAttribute("hidden");
        clone.removeAttribute("data-dom-prototype");
        return clone;
    }

    // 아이콘 경로 보정
    function hydrateIcons(root = document) {
        root.querySelectorAll?.("img[data-icon]").forEach((icon) => {
            if (icon.src) return;
            icon.src = new URL(`../assets/icons/${icon.dataset.icon}.svg`, document.baseURI).href;
        });
    }

    // 채팅 작성창 입력 요소 조회
    function getComposerInput(hostId) {
        return document.querySelector(`#${hostId} [data-prompt-input]`);
    }

    // 작성창 정리
    function clearComposer(hostId) {
        const input = getComposerInput(hostId);
        if (!input) return;
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // 작성창 포커스 이동
    function focusComposer(hostId) {
        const input = getComposerInput(hostId);
        if (!input) return;
        input.focus({ preventScroll: true });
    }

    // 페이지 컴포넌트 준비 상태 확인
    function arePageComponentsReady() {
        return ["chatPromptCenter", "chatPromptBottom"].every((id) => document.querySelector(`#${id} [data-prompt-composer]`)) && document.querySelector(".chatbot-sidebar");
    }

    // 화면 초기화
    function init() {
        if (pageReady || !arePageComponentsReady()) return;
        pageReady = true;
        hydrateIcons();
        const sidebar = document.querySelector(".chatbot-sidebar");
        window.AIOneSidebar?.configure(sidebar, {
            activePage: "chatbot",
            initialCollapsed: false,
        });
        applyPopupMode();
        bindEvents();
        document.addEventListener("click", () => {
            $$(".msg-more-menu").forEach((m) => m.classList.add("hidden"));
        });

        // AI-ONE 홈 채팅바에서 넘어온 질의 자동 전송
        const pending = sessionStorage.getItem("ai-one-pending-query");
        if (pending) {
            sessionStorage.removeItem("ai-one-pending-query");
            sendFromCenter(pending);
        }
    }

    // Popup Mode 적용
    function applyPopupMode() {
        const params = new URLSearchParams(window.location.search);
        const isPopupMode = params.get("popup") === "1";
        if (!isPopupMode) return;

        document.body.classList.add("chat-popup-mode");
        document.title = "AI-ONE 챗봇";
    }

    // 채팅 In Popup 열기
    function openChatInPopup() {
        const popupUrl = new URL("ai-chatbot.html", window.location.href);
        popupUrl.searchParams.set("popup", "1");

        const width = Math.min(1440, Math.max(1024, window.screen.availWidth - 80));
        const height = Math.min(960, Math.max(720, window.screen.availHeight - 80));
        const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
        const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
        const features = ["popup=yes", `width=${width}`, `height=${height}`, `left=${left}`, `top=${top}`, "location=yes", "toolbar=no", "menubar=no", "status=no", "scrollbars=yes", "resizable=yes"].join(",");

        const popup = window.open(popupUrl.href, "AI_ONE_CHATBOT_WINDOW", features);
        if (!popup) {
            alert("새창이 차단되었습니다. 브라우저의 팝업 차단을 해제한 후 다시 시도해 주세요.");
            return;
        }
        popup.focus();
    }

    // 보고서 드로어 열기
    function openReportDrawer() {
        const drawer = $("#reportDrawer");
        const backdrop = $("#reportDrawerBackdrop");
        if (drawer) drawer.classList.remove("hidden");
        if (backdrop) backdrop.classList.remove("hidden");
    }

    // 보고서 드로어 닫기
    function closeReportDrawer() {
        const drawer = $("#reportDrawer");
        const backdrop = $("#reportDrawerBackdrop");
        if (drawer) drawer.classList.add("hidden");
        if (backdrop) backdrop.classList.add("hidden");
        resetReportForm();
    }

    /* ============================ 끝: 기본 화면과 팝업 ============================== */

    /* ============================ 시작: 보고서 파일 첨부 ============================ */
    // 보고서 폼 초기화
    function resetReportForm() {
        const detail = $("#reportDetail");
        if (detail) detail.value = "";
        const firstType = $('input[name="reportType"]');
        if (firstType) firstType.checked = true;
    }

    /* ============================ 끝: 보고서 파일 첨부 ============================== */

    /* ============================ 시작: 화면 이벤트 연결 ============================ */

    // 챗봇 사이드바 활성 메뉴 전환
    function setActiveChatbotNavLink(activeLink) {
        const sidebar = activeLink?.closest(".chatbot-sidebar");
        if (!sidebar) return;

        $$(".nav-link", sidebar).forEach((link) => {
            const isActive = link === activeLink;
            link.classList.toggle("active", isActive);
            if (isActive) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
    }

    // 화면 주요 이벤트 연결
    function bindEvents() {
        // 최소 브라우저 창에서 챗봇을 엽니다.
        const openChatWindowBtn = $("#openChatWindowBtn");
        if (openChatWindowBtn) openChatWindowBtn.addEventListener("click", openChatInPopup);

        document.addEventListener("promptcomposer:submit", (event) => {
            const value = event.detail?.value || "";
            if (event.target.closest("#chatPromptCenter")) sendFromCenter(value);
            else if (event.target.closest("#chatPromptBottom")) sendMessage(value);
        });

        const sidebarNav = $(".chatbot-sidebar .sidebar-nav");
        if (sidebarNav) {
            sidebarNav.addEventListener("click", (event) => {
                const navLink = event.target.closest(".nav-link");
                if (!navLink || !sidebarNav.contains(navLink) || navLink.dataset.page === "home" || navLink.getAttribute("aria-disabled") === "true") return;
                if (navLink.matches('a[href="#"]')) event.preventDefault();
                setActiveChatbotNavLink(navLink);
            });
        }

        // 새 대화
        const newChatBtn = $("#newChatBtn");
        const newChatLink = $("#newChatLink");
        if (newChatLink) newChatLink.addEventListener("click", resetChat);
        if (newChatBtn) {
            newChatBtn.addEventListener("click", () => {
                resetChat();
                setActiveChatbotNavLink(newChatLink);
            });
        }

        // 보고서 드로어
        const reportDrawerClose = $("#reportDrawerClose");
        const reportDrawerBackdrop = $("#reportDrawerBackdrop");
        const reportCancelBtn = $("#reportCancelBtn");
        const reportSubmitBtn = $("#reportSubmitBtn");
        if (reportDrawerClose) reportDrawerClose.addEventListener("click", closeReportDrawer);
        if (reportDrawerBackdrop) reportDrawerBackdrop.addEventListener("click", closeReportDrawer);
        if (reportCancelBtn) reportCancelBtn.addEventListener("click", closeReportDrawer);
        if (reportSubmitBtn) {
            reportSubmitBtn.addEventListener("click", () => {
                closeReportDrawer();
                alert("신고가 접수되었습니다. 감사합니다.");
            });
        }
    }

    /* ============================ 끝: 화면 이벤트 연결 ============================== */

    /* ============================ 시작: 채팅 메시지와 응답 ============================ */

    // AI Response 예약
    function queueAiResponse(text, onComplete) {
        const pendingMessage = { role: "ai", text: "", pending: true };
        messages.push(pendingMessage);
        renderMessages();

        setTimeout(() => {
            pendingMessage.text = generateResponse(text);
            pendingMessage.pending = false;
            renderMessages();
            if (typeof onComplete === "function") onComplete();
        }, 800);
    }

    // AI Response 재시도
    function retryAiResponse(index) {
        const message = messages[index];
        if (!message || message.role !== "ai" || message.pending) return;

        let query = "";
        for (let messageIndex = index - 1; messageIndex >= 0; messageIndex -= 1) {
            if (messages[messageIndex].role === "user") {
                query = messages[messageIndex].text;
                break;
            }
        }
        if (!query) return;

        message.text = "";
        message.pending = true;
        renderMessages();

        setTimeout(() => {
            message.text = generateResponse(query);
            message.pending = false;
            renderMessages();
        }, 800);
    }

    // 중앙 입력창 메시지 전송
    function sendFromCenter(value) {
        const text = String(value ?? getComposerInput("chatPromptCenter")?.value ?? "").trim();
        if (!text) return;
        clearComposer("chatPromptCenter");
        // 채팅 모드로 전환합니다.
        const empty = $("#chatEmpty");
        if (empty) empty.style.display = "none";
        const msgContainer = $("#chatMessages");
        msgContainer.style.display = "block";
        const container = $("#chatContainer");
        container.classList.add("has-messages");
        const wrapper = $("#chatInputWrapper");
        if (wrapper) wrapper.classList.remove("hidden");

        messages.push({ role: "user", text });
        queueAiResponse(text, () => focusComposer("chatPromptBottom"));
    }

    // 메시지 전송
    function sendMessage(value) {
        const text = String(value ?? getComposerInput("chatPromptBottom")?.value ?? "").trim();
        if (!text) return;

        // 빈 상태를 숨깁니다.
        const empty = $("#chatEmpty");
        if (empty) empty.style.display = "none";
        const msgContainer = $("#chatMessages");
        msgContainer.style.display = "block";
        const container = $("#chatContainer");
        container.classList.add("has-messages");

        // 사용자 메시지
        messages.push({ role: "user", text });
        clearComposer("chatPromptBottom");

        // AI 응답을 시뮬레이션합니다.
        queueAiResponse(text, () => focusComposer("chatPromptBottom"));
    }

    // Response 생성
    function generateResponse(query) {
        if (query.includes("지방채") || query.includes("추경")) {
            return "공공자금관리기금(공자기금)은 지방재정 지원을 목적으로 지방자치단체가 발행하는 지방채를 장기 저리로 인수하여 자금을 지원합니다.\n\n주요 내용:\n• 지원대상: 지방자치단체(시·도)\n• 지원사업: 도로, 지하철건설, 공공시설 설치, 지역개발사업 등\n• 인수금리: 공자기금 예탁금리와 동일(분기별 고정)\n• 인수기간: 5년 거치 10년 분할 상환\n\n광주·전남 통합특별시 출범(2026.7.1.)과 관련하여 약 1,000억 원 규모의 추경이 편성되었습니다.";
        }
        if (query.includes("예산") || query.includes("재정")) {
            return "2026년도 예산안에 대한 주요 재정지표를 안내드립니다.\n\n• 총수입: 약 625조원\n• 총지출: 약 657조원\n• 관리재정수지: GDP 대비 -2.8%\n• 국가채무비율: 약 49.1%\n\n추가 질문이 있으시면 말씀해주세요.";
        }
        return "안녕하세요! AI-ONE 챗봇입니다.\n\n국회 질의 관련 답변서 작성, 경제 동향 분석, 재정 데이터 조회 등 업무를 도와드리겠습니다.\n\n무엇을 도와드릴까요?";
    }

    // 메시지 렌더링
    function renderMessages() {
        const container = $("#chatMessages");
        const renderedMessages = messages
            .map((message, index) => {
                const templateId = message.role === "user" ? "chatbotUserMessagePrototype" : message.pending ? "chatbotPendingMessagePrototype" : "chatbotAiMessagePrototype";
                const element = clonePrototypeElement(templateId);
                if (!element) return null;

                const textTarget = element.matches("[data-chat-message-text]") ? element : element.querySelector("[data-chat-message-text]");
                if (textTarget) textTarget.textContent = message.text;
                element.querySelectorAll("[data-action], .msg-more-btn").forEach((button) => {
                    button.dataset.msgIdx = String(index);
                });
                const menu = element.querySelector(".msg-more-menu");
                if (menu) menu.dataset.menuIdx = String(index);
                return { element, index, message };
            })
            .filter(Boolean);
        const messageElements = renderedMessages.map(({ element }) => element);
        container.replaceChildren(...messageElements);
        const scrollContainer = $("#chatContainer");
        if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;

        window.ChatMessage?.bind(container, {
            getText: ({ button }) => messages[Number(button.dataset.msgIdx)]?.text || "",
            onRetry: ({ button }) => retryAiResponse(Number(button.dataset.msgIdx)),
        });

        // 화면별 보고서 동작을 연결합니다.
        $$(".msg-report-btn", container).forEach((btn) => {
            btn.addEventListener("click", (event) => {
                event.stopPropagation();
                openReportDrawer();
            });
        });

        // 더보기 버튼 동작을 연결합니다.
        $$(".msg-more-btn", container).forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const idx = btn.dataset.msgIdx;
                $$(".msg-more-menu", container).forEach((m) => {
                    if (m.dataset.menuIdx !== idx) m.classList.add("hidden");
                });
                const menu = $(`.msg-more-menu[data-menu-idx="${idx}"]`, container);
                if (menu) menu.classList.toggle("hidden");
            });
        });

        // 메뉴 항목 동작을 연결합니다.
        $$(".msg-more-item", container).forEach((item) => {
            item.addEventListener("click", (e) => {
                e.stopPropagation();
                const action = item.dataset.action;
                const menu = item.closest(".msg-more-menu");
                if (menu) menu.classList.add("hidden");
                if (action === "legal") {
                    openReportDrawer();
                } else {
                    handleMoreAction(action);
                }
            });
        });
    }

    // More 동작 처리
    function handleMoreAction(action) {
        const labels = {
            branch: "새 채팅에서 브랜치를 생성했습니다.",
            recheck: "대답을 재확인하고 있습니다...",
            listen: "음성으로 읽어드립니다.",
            export: "Docs로 내보냈습니다.",
            mail: "Gmail 초안을 작성했습니다.",
            detail: "응답 세부정보를 확인합니다.",
        };
        alert(labels[action] || "");
    }

    // 채팅 초기화
    function resetChat() {
        messages.length = 0;
        const empty = $("#chatEmpty");
        if (empty) empty.style.display = "flex";
        const msgContainer = $("#chatMessages");
        msgContainer.replaceChildren();
        msgContainer.style.display = "none";
        const container = $("#chatContainer");
        container.classList.remove("has-messages");
        const wrapper = $("#chatInputWrapper");
        if (wrapper) wrapper.classList.add("hidden");
        clearComposer("chatPromptCenter");
        clearComposer("chatPromptBottom");
        focusComposer("chatPromptCenter");
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

    /* ============================ 끝: 채팅 메시지와 응답 ============================== */
})();
