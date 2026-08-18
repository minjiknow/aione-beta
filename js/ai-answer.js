(() => {
    "use strict";

    /* 파일 구성: 페이지 수명주기와 탭 -> 참조/소스 상태 -> 근거 검증 -> 채팅/초기화 동작. */

    /* ============================ 시작: 화면 초기화와 공통 도우미 ============================ */

    let initialized = false;
    const pendingWorkspaceTasks = new Set();
    const AI_CHAT_INTRO =
        "국회 질의를 입력해 보세요!\n" +
        "AI가 지능형 검색을 통해 관련자료를 추천하고 국회 답변서 초안 생성을 시작합니다.\n" +
        "① (선택) 좌측 AI 참조소스에서 첨부파일을 업로드하고\n" +
        "② 이 채팅에 국회질의를 입력하시면\n" +
        "과거 유사답변서나 관련자료 추천하고 초안을 생성합니다.";
    const ANSWER_PAGE_SELECTOR = 'body[data-page="answer"] > .app';

    const requiredSelectors = [
        ANSWER_PAGE_SELECTOR,
        `${ANSWER_PAGE_SELECTOR} .three-panel-area > .three-panel`,
        `${ANSWER_PAGE_SELECTOR} > .sidebar`,
        `${ANSWER_PAGE_SELECTOR} .app-topbar`,
        ".answer-upload-component [data-file-upload-zone]",
        "#answerChatMessages",
        "#answerChatListSidepop[data-sidepop]",
        "#answerPageToast",
    ];

    // 공통 컴포넌트 준비 상태 확인
    function allComponentsReady() {
        return requiredSelectors.every((selector) => document.querySelector(selector));
    }

    // 토스트 메시지 표시
    function showToast(message) {
        window.AIOneToast?.show(message, {
            target: "#answerPageToast",
            duration: 1800,
        });
    }

    // 워크스페이스 Task 예약
    function scheduleWorkspaceTask(callback, delay) {
        const taskId = window.setTimeout(() => {
            pendingWorkspaceTasks.delete(taskId);
            callback();
        }, delay);
        pendingWorkspaceTasks.add(taskId);
        return taskId;
    }

    // 대기 워크스페이스 Tasks 정리
    function clearPendingWorkspaceTasks() {
        pendingWorkspaceTasks.forEach((taskId) => window.clearTimeout(taskId));
        pendingWorkspaceTasks.clear();
    }

    // 아이콘 경로 보정
    function hydrateIcons(root = document) {
        root.querySelectorAll?.("img[data-icon]").forEach((icon) => {
            if (icon.src) return;
            icon.src = new URL(`../assets/icons/${icon.dataset.icon}.svg`, document.baseURI).href;
        });
    }

    // Prototype Element 복제
    function clonePrototypeElement(prototypeId) {
        const prototype = document.getElementById(prototypeId);
        if (!prototype) return null;
        const clone = prototype.cloneNode(true);
        clone.id = prototype.dataset.instanceId || "";
        clone.removeAttribute("hidden");
        clone.removeAttribute("data-dom-prototype");
        clone.removeAttribute("data-instance-id");
        return clone;
    }

    // configure 상단바 동작 처리
    function configureTopbar() {
        const newChatButton = document.querySelector("#newClassifyBtn");
        const chatListButton = document.querySelector("#runDrawerBtn");

        if (newChatButton) {
            newChatButton.dataset.workspaceAction = "new-chat";
        }

        if (chatListButton) {
            chatListButton.dataset.sidepopOpen = "answerChatListSidepop";
            chatListButton.dataset.sidepopVariant = "chat-list";
            chatListButton.setAttribute("aria-controls", "answerChatListSidepop");
            chatListButton.setAttribute("aria-haspopup", "dialog");
            chatListButton.setAttribute("aria-expanded", "false");
        }
    }

    // 사이드바 초기화
    function initSidebar() {
        const sidebar = document.querySelector(`${ANSWER_PAGE_SELECTOR} > .sidebar`);
        if (!sidebar) return;

        window.AIOneSidebar?.configure(sidebar, {
            activePage: "answer",
            initialCollapsed: true,
        });
    }

    // 패널 크기 조절 레이아웃 일시 중지
    function suspendPanelResizeLayout(layout, panel) {
        if (!layout || !panel) return;
        if (layout.style.gridTemplateColumns) {
            layout.dataset.answerGridTemplate = layout.style.gridTemplateColumns;
        }
        layout.style.removeProperty("grid-template-columns");
        window.AIOneSplitHandler?.setPanelToMinimum(panel);
        window.AIOneSplitHandler?.init(layout);
    }

    // 패널 크기 조절 레이아웃 복원
    function restorePanelResizeLayout(layout, panel) {
        const columns = layout?.dataset.answerGridTemplate;
        if (!layout) return;
        delete layout.dataset.answerGridTemplate;

        if (window.matchMedia("(max-width: 1024px)").matches) {
            if (columns) layout.style.gridTemplateColumns = columns;
            window.AIOneSplitHandler?.init(layout);
            return;
        }

        layout.style.removeProperty("grid-template-columns");
        const openedAtMinimum = window.AIOneSplitHandler?.setPanelToMinimum(panel);
        if (!openedAtMinimum && columns) layout.style.gridTemplateColumns = columns;
        window.AIOneSplitHandler?.init(layout);
    }

    // 패널 크기 조절 레이아웃 초기화
    function resetPanelResizeLayout(layout) {
        if (!layout) return;
        delete layout.dataset.answerGridTemplate;
        window.AIOneSplitHandler?.reset(layout);
        document.querySelectorAll('[data-component="split-handler"]').forEach((split) => {
            window.AIOneSplitHandler?.reset(split);
        });
    }

    /* ============================ 끝: 화면 초기화와 공통 도우미 ============================== */

    /* ============================ 시작: 탭과 관련자료 ============================ */

    // Active 탭 설정
    function setActiveTab(tabName, shouldFocus = false) {
        const tabs = Array.from(document.querySelectorAll("[data-answer-tab]:not([hidden])"));
        const panels = Array.from(document.querySelectorAll("[data-answer-panel]"));

        if (!tabs.some((tab) => tab.dataset.answerTab === tabName)) return;

        tabs.forEach((tab) => {
            const isActive = tab.dataset.answerTab === tabName;
            tab.classList.toggle("active", isActive);
            tab.classList.toggle("is-active", isActive);
            tab.setAttribute("aria-selected", String(isActive));
            tab.tabIndex = isActive ? 0 : -1;
            if (isActive && shouldFocus) tab.focus();
        });
        panels.forEach((panel) => {
            panel.hidden = panel.dataset.answerPanel !== tabName;
        });
        const activePanel = panels.find((panel) => panel.dataset.answerPanel === tabName);
        window.requestAnimationFrame(() => window.AIOneSplitHandler?.init(activePanel));
    }

    // 탭 초기화
    function initTabs() {
        const tabs = Array.from(document.querySelectorAll("[data-answer-tab]:not([hidden])"));
        tabs.forEach((tab, index) => {
            tab.addEventListener("click", () => setActiveTab(tab.dataset.answerTab));
            tab.addEventListener("keydown", (event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();

                let nextIndex = index;
                if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
                if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
                if (event.key === "Home") nextIndex = 0;
                if (event.key === "End") nextIndex = tabs.length - 1;
                setActiveTab(tabs[nextIndex].dataset.answerTab, true);
            });
        });
        setActiveTab("recommend");
    }

    // 탭 개수 설정
    function setTabCount(tabName, count) {
        const countElement = document.querySelector(`[data-answer-tab="${tabName}"] .tab-count`);
        if (countElement) countElement.textContent = String(count);
    }

    // 참고자료 필터 개수 설정
    function setReferenceFilterCounts(cards, isEmpty = false) {
        document.querySelectorAll("[data-reference-filter]").forEach((button) => {
            const filter = button.dataset.referenceFilter;
            const count = isEmpty ? 0 : filter === "all" ? cards.length : cards.filter((card) => card.dataset.category === filter).length;
            const countElement = button.querySelector("span");
            if (countElement) countElement.textContent = String(count);
        });
    }

    // 추천자료 빈 상태 설정
    function setRecommendationEmptyState(isEmpty) {
        const results = document.querySelector("[data-answer-recommend-results]");
        const empty = document.querySelector("[data-answer-recommend-empty]");
        const status = document.querySelector("[data-answer-recommend-status]");
        const cards = Array.from(document.querySelectorAll("[data-reference-card]"));

        if (results) results.hidden = isEmpty;
        if (empty) empty.hidden = !isEmpty;
        if (status) status.hidden = isEmpty;
        setReferenceFilterCounts(cards, isEmpty);
        setTabCount("recommend", isEmpty ? 0 : cards.length);
    }

    // 답변서 초안 결과와 초기화 빈 화면 표시 상태 설정
    function setDraftEmptyState(isEmpty) {
        const empty = document.querySelector("[data-answer-draft-empty]");
        const draftContents = document.querySelectorAll("[data-answer-draft-content]");

        if (empty) empty.hidden = !isEmpty;
        draftContents.forEach((content) => {
            content.hidden = isEmpty;
        });
    }

    // 추천자료 Results 복원
    function restoreRecommendationResults() {
        const cards = Array.from(document.querySelectorAll("[data-reference-card]"));
        document.body.classList.remove("is-new-chat");
        cards.forEach((card) => {
            card.hidden = false;
        });
        setRecommendationEmptyState(false);
        setTabCount("draft", 1);
        setDraftEmptyState(false);
        if (cards[0]) selectReferenceCard(cards[0]);
    }

    // 소스 파일 상태 동기화
    function syncSourceFileState() {
        const list = document.querySelector(".answer-source-files");
        const count = document.querySelector("[data-source-file-count]");
        const emptyGuide = document.querySelector("[data-source-empty-guide]");
        const search = document.querySelector(".answer-source-search");
        const fileCount = list?.children.length || 0;

        if (count) count.textContent = String(fileCount);
        if (emptyGuide) emptyGuide.hidden = fileCount > 0;
        if (search) search.hidden = fileCount === 0;
    }

    // 참고자료 제목 조회
    function getReferenceTitle(card) {
        const authoredTitle = card.querySelector(".rec-title")?.textContent.replace(/\s+/g, " ").trim();
        return authoredTitle || card.dataset.title || "선택한 관련자료";
    }

    // 선택 참고자료 동기화
    function syncSelectedReferences(cards) {
        const selectedCards = cards.filter((card) => card.querySelector('input[type="checkbox"]')?.checked);
        document.querySelectorAll("[data-selected-reference-count]").forEach((count) => {
            count.textContent = String(selectedCards.length);
        });

        const list = document.querySelector(".selected-refs-list");
        if (list) {
            const authoredItems = Array.from(list.children);
            const items = selectedCards
                .map((card, selectedIndex) => {
                    const item = authoredItems[selectedIndex] || clonePrototypeElement("answerSelectedReferenceItemPrototype");
                    if (!item) return null;
                    const score = item.querySelector(".ref-score");
                    const name = item.querySelector(".ref-name");
                    const removeButton = item.querySelector("[data-selected-reference-remove]");
                    const cardIndex = cards.indexOf(card);
                    const referenceName = getReferenceTitle(card);

                    score.textContent = `${card.dataset.score || 0}%`;
                    name.textContent = referenceName;
                    removeButton.dataset.referenceIndex = String(cardIndex);
                    removeButton.setAttribute("aria-label", `${referenceName} 선택 해제`);
                    return item;
                })
                .filter(Boolean);
            list.replaceChildren(...items);
        }

        const emptyGuide = document.querySelector("[data-selected-references-empty]");
        const footer = document.querySelector(".selected-refs-footer");
        if (emptyGuide) emptyGuide.hidden = selectedCards.length > 0;
        if (footer) footer.hidden = selectedCards.length === 0;

        const selectAll = document.querySelector("[data-select-all-references]");
        if (selectAll) {
            selectAll.checked = cards.length > 0 && selectedCards.length === cards.length;
            selectAll.indeterminate = selectedCards.length > 0 && selectedCards.length < cards.length;
        }
    }

    // 참고자료 카드 선택
    function selectReferenceCard(card) {
        document.querySelectorAll("[data-reference-card]").forEach((item) => {
            item.classList.toggle("active", item === card);
        });
        const previewTitle = document.querySelector("[data-preview-title]");
        const previewScore = document.querySelector("[data-preview-score]");
        if (previewTitle) previewTitle.textContent = card.dataset.title || "";
        if (previewScore) previewScore.textContent = `유사도 ${card.dataset.score || 0}%`;
    }

    // 참고자료 초기화
    function initReferences() {
        const cards = Array.from(document.querySelectorAll("[data-reference-card]"));
        cards.forEach((card) => {
            card.addEventListener("click", (event) => {
                if (event.target.closest("input, label")) return;
                selectReferenceCard(card);
            });
            card.querySelector('input[type="checkbox"]')?.addEventListener("change", () => {
                syncSelectedReferences(cards);
                if (card.querySelector('input[type="checkbox"]').checked) selectReferenceCard(card);
            });
        });

        document.querySelector("[data-select-all-references]")?.addEventListener("change", (event) => {
            cards.forEach((card) => {
                const checkbox = card.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.checked = event.target.checked;
            });
            syncSelectedReferences(cards);
        });

        document.querySelectorAll("[data-reference-filter]").forEach((button) => {
            button.addEventListener("click", () => {
                const filter = button.dataset.referenceFilter;
                document.querySelectorAll("[data-reference-filter]").forEach((item) => {
                    const isActive = item === button;
                    item.classList.toggle("active", isActive);
                    item.setAttribute("aria-pressed", String(isActive));
                });
                cards.forEach((card) => {
                    card.hidden = filter !== "all" && card.dataset.category !== filter;
                });
            });
        });

        document.querySelector("[data-apply-references]")?.addEventListener("click", (event) => {
            const button = event.currentTarget;
            const selectedCards = cards.filter((card) => card.querySelector('input[type="checkbox"]')?.checked);
            if (!selectedCards.length || button.dataset.applying === "true") {
                if (!selectedCards.length) showToast("초안에 반영할 관련자료를 선택해 주세요.");
                return;
            }

            const selectedCount = selectedCards.length;
            const selectedReferences = selectedCards.map((card) => ({
                title: getReferenceTitle(card),
                score: card.dataset.score || 0,
            }));
            const prompt = `다음 자료를 참고하여 답변서 초안을 생성해 주세요:\n${selectedReferences.map((reference, index) => `${index + 1}. ${reference.title} (유사도 ${reference.score}%)`).join("\n")}`;
            const completionMessage =
                `선택하신 ${selectedCount}건의 자료를 분석하여 답변서 초안에 반영했습니다.\n\n` + `📋 반영 자료:\n${selectedReferences.map((reference) => `• ${reference.title}`).join("\n")}\n\n` + '"답변서 초안" 탭에서 결과를 확인하세요.';
            const messages = document.querySelector("#answerChatMessages");
            const pendingMessage = window.ChatMessage?.createPending({
                variant: "answer",
                title: `선택 자료 ${selectedCount}건 분석 중`,
                description: "답변서 초안에 반영하고 있습니다...",
            });

            button.dataset.applying = "true";
            button.disabled = true;
            setTabCount("draft", 1);
            setDraftEmptyState(false);
            setActiveTab("draft");
            appendChatMessage("user", prompt);
            if (messages && pendingMessage) messages.append(pendingMessage);
            scrollChatToBottom();

            scheduleWorkspaceTask(() => {
                const aiMessage = createChatMessage("ai", completionMessage);
                if (aiMessage && pendingMessage?.isConnected) {
                    pendingMessage.replaceWith(aiMessage);
                } else if (aiMessage) {
                    messages?.append(aiMessage);
                } else {
                    pendingMessage?.remove();
                }
                if (aiMessage) window.ChatMessage?.typewrite(aiMessage, { scrollContainer: messages });
                delete button.dataset.applying;
                button.disabled = false;
                scrollChatToBottom();
                showToast(`선택한 ${selectedCount}건의 자료가 답변서 초안에 반영되었습니다.`);
            }, 800);
        });

        document.querySelector(".selected-refs-list")?.addEventListener("click", (event) => {
            const removeButton = event.target.closest("[data-selected-reference-remove]");
            if (!removeButton) return;
            const card = cards[Number(removeButton.dataset.referenceIndex)];
            const checkbox = card?.querySelector('input[type="checkbox"]');
            if (!checkbox) return;
            checkbox.checked = false;
            syncSelectedReferences(cards);
            showToast("선택한 관련자료를 해제했습니다.");
        });

        setReferenceFilterCounts(cards);
        syncSelectedReferences(cards);
    }

    /* ============================ 끝: 탭과 관련자료 ============================== */

    /* ============================ 시작: 참조소스 업로드 ============================ */

    // 참조 소스 업로드 초기화
    function initSourceUpload() {
        const zone = document.querySelector(".answer-upload-component [data-file-upload-zone]");
        const list = document.querySelector(".answer-source-files");
        const count = document.querySelector("[data-source-file-count]");
        if (!zone || !list || !count) return;

        // 파일 유형 조회
        const getFileType = (file) => {
            const extension = String(file?.name || "")
                .split(".")
                .pop()
                ?.toLowerCase();
            if (extension === "pdf") return { type: "pdf", label: "PDF" };
            if (["hwp", "hwpx"].includes(extension)) return { type: "hwp", label: "HWP" };
            if (extension === "docx") return { type: "docx", label: "DOCX" };
            if (extension === "txt") return { type: "txt", label: "TXT" };
            return { type: "txt", label: "FILE" };
        };

        // 파일 항목 생성
        const createFileItem = (file) => {
            const { type, label } = getFileType(file);
            const item = clonePrototypeElement("answerSourceFileItemPrototype");
            if (!item) return null;
            const dot = item.querySelector(".file-type-dot");
            const collapsedIcon = item.querySelector(".file-icon-collapsed");
            const name = item.querySelector(".file-name-simple");
            const remove = item.querySelector(".file-remove-simple");

            dot.classList.add(type);
            collapsedIcon.classList.add(type);
            collapsedIcon.textContent = label;
            name.textContent = file.name;
            name.title = file.name;
            remove.setAttribute("aria-label", `${file.name} 삭제`);
            return item;
        };

        zone.addEventListener("app:file-upload", (event) => {
            Array.from(event.detail?.files || []).forEach((file) => {
                const item = createFileItem(file);
                if (item) list.append(item);
            });
            syncSourceFileState();
            showToast("참조소스를 추가했습니다.");
        });

        list.addEventListener("fileitem:delete", () => {
            syncSourceFileState();
            showToast("참조소스를 삭제했습니다.");
        });

        document.querySelector("[data-source-reset]")?.addEventListener("click", () => {
            list.replaceChildren();
            syncSourceFileState();
            showToast("참조소스를 초기화했습니다.");
        });

        document.querySelector("[data-source-collapse]")?.addEventListener("click", () => {
            const panel = document.querySelector('.three-panel [data-panel="folder"]');
            const button = document.querySelector("[data-source-collapse]");
            const collapsed = !panel.classList.contains("panel-collapsed");
            panel.classList.toggle("panel-collapsed", collapsed);
            panel.querySelector(".answer-source-file-section")?.classList.toggle("is-collapsed", collapsed);
            panel.closest(".three-panel")?.classList.toggle("is-source-collapsed", collapsed);
            if (collapsed) suspendPanelResizeLayout(panel.closest(".three-panel"), panel);
            else restorePanelResizeLayout(panel.closest(".three-panel"), panel);
            button?.setAttribute("aria-expanded", String(!collapsed));
            button?.setAttribute("aria-label", collapsed ? "참조소스 패널 펼치기" : "참조소스 패널 접기");
            if (button) button.title = collapsed ? "참조소스 패널 펼치기" : "참조소스 패널 접기";
            showToast(collapsed ? "참조소스 패널을 접었습니다." : "참조소스 패널을 펼쳤습니다.");
        });

        document.querySelector("[data-source-file-add]")?.addEventListener("click", () => {
            document.querySelector("#answerSourceFileInput")?.click();
        });

        syncSourceFileState();
    }

    /* ============================ 끝: 참조소스 업로드 ============================== */

    /* ============================ 시작: 문서와 패널 동작 ============================ */

    // 문서 동작 초기화
    function initDocumentActions() {
        document.querySelector("[data-download-draft]")?.addEventListener("click", () => {
            const documentText = document.querySelector(".answer-draft-document")?.innerText.trim();
            if (!documentText) {
                showToast("다운로드할 답변서 초안이 없습니다.");
                return;
            }

            const blob = new Blob([documentText], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = Object.assign(document.createElement("a"), {
                href: url,
                download: "국회_답변서_초안_v1.0.txt",
            });
            document.body.append(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 0);
            showToast("답변서 초안을 다운로드했습니다.");
        });
    }

    let activeDraftEvidenceTrigger = null;

    // 초안 문장 근거 상태 조회
    function getDraftEvidenceStatus(sentence) {
        if (sentence.classList.contains("is-grounded")) {
            return { label: "근거 확인", tone: "green" };
        }
        if (sentence.classList.contains("is-caution")) {
            return { label: "주의", tone: "yellow" };
        }
        return { label: "출처 누락", tone: "red" };
    }

    // 초안 문장 근거자료 조회
    function getDraftEvidenceReferences(sentence, sentenceIndex) {
        const references = Array.from(document.querySelectorAll("#answerEvidenceDetailPrototype [data-vd-reference]"))
            .map((card) => ({
                index: Number.parseInt(card.dataset.vdReference || "", 10),
                file: card.querySelector("[data-vd-reference-file]")?.textContent.trim() || "",
                meta: card.querySelector("[data-vd-reference-meta]")?.textContent.trim() || "",
                quote: card.querySelector("[data-vd-reference-quote]")?.textContent.trim() || "",
            }))
            .filter((reference) => Number.isInteger(reference.index) && reference.file);
        if (!references.length) return [];

        const explicitReferences = (sentence.dataset.answerEvidenceRefs || "")
            .split(",")
            .map((value) => Number.parseInt(value.trim(), 10) - 1)
            .filter((index) => Number.isInteger(index) && references.some((reference) => reference.index === index));
        if (explicitReferences.length) {
            const primaryIndex = explicitReferences[0];
            const secondaryIndex = explicitReferences[1] ?? (primaryIndex + 1) % references.length;
            return [references.find((reference) => reference.index === primaryIndex), references.find((reference) => reference.index === secondaryIndex)].filter(Boolean);
        }

        const sourceMatch = sentence.querySelector("sup")?.textContent.match(/\d+/);
        const sourceNumber = Number.parseInt(sourceMatch?.[0] || "", 10);
        const primaryIndex = Number.isFinite(sourceNumber) ? (sourceNumber - 1) % references.length : (sentenceIndex - 1) % references.length;

        return [references[primaryIndex], references[(primaryIndex + 1) % references.length]];
    }

    // 초안 문장 본문 추출
    function getDraftEvidenceSentenceText(sentence) {
        const sentenceClone = sentence.cloneNode(true);
        sentenceClone.querySelectorAll("sup").forEach((source) => source.remove());
        return sentenceClone.textContent.replace(/\s+/g, " ").trim();
    }

    // 초안 근거 상세 패널 닫기
    function closeDraftEvidenceDetail(splitArea, restoreFocus = false) {
        const triggerToRestore = activeDraftEvidenceTrigger;
        window.AIOneSplitHandler?.reset(splitArea);
        splitArea.querySelector(".verify-detail-panel")?.remove();
        splitArea.querySelector(":scope > .split-handler-handle")?.remove();
        splitArea.classList.remove("is-evidence-open");

        const draftPane = splitArea.querySelector(".answer-draft-main");
        draftPane?.style.removeProperty("flex");
        draftPane?.style.removeProperty("width");
        activeDraftEvidenceTrigger?.setAttribute("aria-expanded", "false");
        activeDraftEvidenceTrigger = null;

        if (restoreFocus) triggerToRestore?.focus();
    }

    // 초안 근거 분할 핸들 생성
    function createDraftEvidenceSplitHandle() {
        return clonePrototypeElement("answerEvidenceSplitHandlePrototype");
    }

    // 초안 근거 상세 패널 생성 및 이벤트 연결
    function createDraftEvidenceDetail(splitArea) {
        const detailPanel = clonePrototypeElement("answerEvidenceDetailPrototype");
        if (!detailPanel) return null;

        detailPanel.querySelector(".vd-close")?.addEventListener("click", () => {
            closeDraftEvidenceDetail(splitArea, true);
        });
        detailPanel.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            closeDraftEvidenceDetail(splitArea, true);
        });
        detailPanel.querySelectorAll("[data-vd-reference-action]").forEach((button) => {
            button.addEventListener("click", () => {
                const fileName = button.closest("[data-vd-reference]")?.querySelector("[data-vd-reference-file]")?.textContent;
                if (fileName) showToast(`'${fileName}' 원문을 확인합니다.`);
            });
        });

        return detailPanel;
    }

    // 초안 근거 확인 패널 열기
    function openDraftEvidenceDetail(sentence, splitArea) {
        const sentenceIndex = Number.parseInt(sentence.dataset.answerEvidenceIndex || "1", 10);
        const status = getDraftEvidenceStatus(sentence);
        const references = getDraftEvidenceReferences(sentence, sentenceIndex);
        let detailPanel = splitArea.querySelector(".verify-detail-panel");

        if (!detailPanel) {
            detailPanel = createDraftEvidenceDetail(splitArea);
            const resizeHandle = createDraftEvidenceSplitHandle();
            if (!detailPanel || !resizeHandle) return;
            splitArea.append(resizeHandle, detailPanel);
            window.AIOneSplitHandler?.init(splitArea);
        }

        activeDraftEvidenceTrigger?.setAttribute("aria-expanded", "false");
        activeDraftEvidenceTrigger = sentence;
        sentence.setAttribute("aria-expanded", "true");
        splitArea.classList.add("is-evidence-open");

        const statusBadge = detailPanel.querySelector("[data-vd-status]");
        statusBadge?.classList.remove("green", "yellow", "red");
        statusBadge?.classList.add(status.tone);
        if (statusBadge) statusBadge.textContent = status.label;
        const sentenceNumber = detailPanel.querySelector("[data-vd-sentence-number]");
        if (sentenceNumber) sentenceNumber.textContent = `문장 ${String(sentenceIndex).padStart(2, "0")}`;
        const sentenceText = detailPanel.querySelector("[data-vd-sentence]");
        if (sentenceText) sentenceText.textContent = getDraftEvidenceSentenceText(sentence);

        const visibleReferenceIndexes = new Set(references.map((reference) => reference.index));
        detailPanel.querySelectorAll("[data-vd-reference]").forEach((card) => {
            card.hidden = !visibleReferenceIndexes.has(Number.parseInt(card.dataset.vdReference || "", 10));
        });
        detailPanel.querySelector(".vd-body")?.scrollTo({ top: 0 });
    }

    // 초안 근거 검증 초기화
    function initDraftVerification() {
        const draftDocument = document.querySelector(".answer-draft-document");
        const splitArea = document.querySelector(".answer-draft-split-area");
        const highlightToggle = document.querySelector("[data-answer-highlight-toggle]");
        const sourceToggle = document.querySelector("[data-answer-source-toggle]");
        if (!draftDocument || !splitArea || !highlightToggle || !sourceToggle) return;

        const highlightedSentences = draftDocument.querySelectorAll("p.is-grounded, p.is-caution, p.is-missing");
        highlightedSentences.forEach((sentence, index) => {
            sentence.dataset.answerEvidenceIndex = String(index + 1);
            sentence.addEventListener("click", () => {
                openDraftEvidenceDetail(sentence, splitArea);
            });
            sentence.addEventListener("keydown", (event) => {
                if (!["Enter", " "].includes(event.key)) return;
                event.preventDefault();
                openDraftEvidenceDetail(sentence, splitArea);
            });
        });

        // 검증 Mode 동기화
        const syncVerificationMode = () => {
            const isHighlightEnabled = highlightToggle.checked;
            draftDocument.classList.toggle("is-highlight-hidden", !isHighlightEnabled);
            draftDocument.classList.toggle("is-source-hidden", !sourceToggle.checked);
            highlightedSentences.forEach((sentence) => {
                sentence.classList.add("is-evidence-interactive");
                sentence.tabIndex = 0;
                sentence.setAttribute("role", "button");
                sentence.setAttribute("aria-controls", "answerVerifyDetail");
                sentence.setAttribute("aria-expanded", String(sentence === activeDraftEvidenceTrigger));
            });
        };

        highlightToggle.addEventListener("change", syncVerificationMode);
        sourceToggle.addEventListener("change", syncVerificationMode);
        syncVerificationMode();
    }

    // 소스 패널 펼치기
    function expandSourcePanel() {
        const layout = document.querySelector(".three-panel-area > .three-panel");
        const panel = document.querySelector('.three-panel [data-panel="folder"]');
        const button = document.querySelector("[data-source-collapse]");
        const wasCollapsed = panel?.classList.contains("panel-collapsed") || Boolean(layout?.dataset.answerGridTemplate);
        panel?.classList.remove("panel-collapsed");
        panel?.querySelector(".answer-source-file-section")?.classList.remove("is-collapsed");
        layout?.classList.remove("is-source-collapsed");
        if (wasCollapsed) restorePanelResizeLayout(layout, panel);
        button?.setAttribute("aria-expanded", "true");
        button?.setAttribute("aria-label", "참조소스 패널 접기");
        if (button) button.title = "참조소스 패널 접기";
    }

    const answerPanelInitialOrders = new WeakMap();

    // 패널 조회
    function getAnswerPanels(layout) {
        return layout ? Array.from(layout.children).filter((element) => element.matches(".panel[data-slot]")) : [];
    }

    // 패널 크기 조절 핸들 조회
    function getAnswerPanelResizeHandles(layout) {
        return layout ? Array.from(layout.querySelectorAll(":scope > .panel-resize-handle")) : [];
    }

    // 패널 순서 재구성
    function rebuildAnswerPanelOrder(layout, panels) {
        const handles = getAnswerPanelResizeHandles(layout);
        layout.replaceChildren();
        panels.forEach((panel, index) => {
            layout.append(panel);
            if (index < panels.length - 1 && handles[index]) layout.append(handles[index]);
        });
    }

    // 패널 위치 교환
    function swapAnswerPanelPositions(layout, sourcePanel, targetPanel) {
        const panels = getAnswerPanels(layout);
        const sourceIndex = panels.indexOf(sourcePanel);
        const targetIndex = panels.indexOf(targetPanel);
        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return false;

        const widths = new Map(panels.map((panel) => [panel, Math.round(panel.getBoundingClientRect().width)]));
        [panels[sourceIndex], panels[targetIndex]] = [panels[targetIndex], panels[sourceIndex]];
        layout.classList.remove("is-panel-swapped");
        rebuildAnswerPanelOrder(layout, panels);

        if (window.matchMedia("(max-width: 1024px)").matches) {
            layout.style.removeProperty("grid-template-columns");
        } else {
            const tracks = panels.map((panel) => (panel.dataset.slot === "center" ? "minmax(0, 1fr)" : `${widths.get(panel)}px`));
            layout.style.gridTemplateColumns = tracks.flatMap((track, index) => (index < tracks.length - 1 ? [track, "2px"] : [track])).join(" ");
        }

        window.AIOneSplitHandler?.init(layout);
        return true;
    }

    // 패널 순서 초기화
    function resetAnswerPanelOrder(layout) {
        const initialOrder = answerPanelInitialOrders.get(layout);
        if (!layout || !initialOrder) return;
        layout.classList.remove("is-panel-swapped");
        rebuildAnswerPanelOrder(layout, initialOrder);
    }

    // 패널 헤더 드래그 앤 드롭 초기화
    function initAnswerPanelDragDrop(layout) {
        const interactiveSelector = "button, input, select, textarea, a, label, [contenteditable], [role='button'], [role='tab']";

        getAnswerPanels(layout).forEach((panel) => {
            const dragHandle = panel.querySelector(":scope > .panel-head, :scope > .center-header");
            if (!dragHandle) return;

            dragHandle.style.cursor = "grab";
            dragHandle.style.touchAction = "none";

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
                    getAnswerPanels(layout).forEach((item) => item.classList.remove("drag-over"));
                };

                const onPointerMove = (moveEvent) => {
                    if (moveEvent.pointerId !== pointerId) return;
                    if (!isDragging && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 6) return;

                    isDragging = true;
                    moveEvent.preventDefault();
                    panel.style.opacity = "0.5";
                    dragHandle.style.cursor = "grabbing";
                    document.body.style.userSelect = "none";

                    const hoveredPanel = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest(".panel[data-slot]");
                    targetPanel = hoveredPanel?.parentElement === layout && hoveredPanel !== panel ? hoveredPanel : null;
                    getAnswerPanels(layout).forEach((item) => item.classList.toggle("drag-over", item === targetPanel));
                };

                const onPointerEnd = (endEvent) => {
                    if (endEvent.pointerId !== pointerId) return;
                    document.removeEventListener("pointermove", onPointerMove);
                    document.removeEventListener("pointerup", onPointerEnd);
                    document.removeEventListener("pointercancel", onPointerEnd);

                    const dropTarget = endEvent.type === "pointerup" ? targetPanel : null;
                    clearDragState();
                    if (isDragging && dropTarget && swapAnswerPanelPositions(layout, panel, dropTarget)) {
                        showToast("패널 위치가 변경되었습니다.");
                    }
                };

                document.addEventListener("pointermove", onPointerMove, { passive: false });
                document.addEventListener("pointerup", onPointerEnd);
                document.addEventListener("pointercancel", onPointerEnd);
            });
        });
    }

    // 패널 도구 초기화
    function initPanelTools() {
        const layout = document.querySelector(".three-panel-area > .three-panel");
        const swapButton = document.querySelector("#panelSwapBtn");
        const resetButton = document.querySelector("#layoutResetBtn");
        if (!layout) return;

        answerPanelInitialOrders.set(layout, getAnswerPanels(layout));
        initAnswerPanelDragDrop(layout);

        swapButton?.addEventListener("click", () => {
            expandSourcePanel();
            const sourcePanel = document.querySelector('.three-panel [data-panel="folder"]');
            const chatPanel = document.querySelector('.three-panel [data-panel="chat"]');
            if (swapAnswerPanelPositions(layout, sourcePanel, chatPanel)) {
                showToast("참조소스와 AI 채팅 위치를 변경했습니다.");
            }
        });

        resetButton?.addEventListener("click", () => {
            resetAnswerPanelOrder(layout);
            expandSourcePanel();
            resetPanelResizeLayout(layout);
            showToast("패널 레이아웃을 초기화했습니다.");
        });
    }

    /* ============================ 끝: 문서와 패널 동작 ============================== */

    /* ============================ 시작: 채팅 ============================ */

    // 현재 시각 조회
    function getCurrentTime() {
        return new Intl.DateTimeFormat("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        }).format(new Date());
    }

    // 버전 선택값과 화면 레이블을 동기화
    function setActiveDraftVersion(versionName, { openLabel = true } = {}) {
        const versionSelect = document.querySelector(".answer-version-select");
        const option = Array.from(versionSelect?.options || []).find((item) => item.value === versionName);
        if (!versionSelect || !option) return;

        versionSelect.value = versionName;
        if (openLabel) openDraftVersionLabel(versionName, option.textContent.trim());

        const labels = document.querySelectorAll("[data-answer-version-label]");
        labels.forEach((label) => {
            const isActive = label.dataset.answerVersionLabel === versionName;
            label.classList.toggle("active", isActive);
            if (isActive) label.setAttribute("aria-current", "true");
            else label.removeAttribute("aria-current");
        });

        const heading = document.querySelector(".answer-draft-heading");
        if (heading) heading.textContent = `답변서 초안 · ${option.textContent.trim()}`;
    }

    // 버전별 레이블 생성
    function openDraftVersionLabel(versionName, versionLabel) {
        const container = document.querySelector("[data-answer-version-labels]");
        if (!container || container.querySelector(`[data-answer-version-label="${versionName}"]`)) return;

        const label = document.createElement("span");
        label.className = "answer-version-chip";
        label.dataset.answerVersionLabel = versionName;

        const openButton = document.createElement("button");
        openButton.type = "button";
        openButton.className = "answer-version-open";
        openButton.dataset.answerVersionOpen = "";
        openButton.textContent = versionLabel;

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "answer-version-close";
        closeButton.dataset.answerVersionClose = "";
        closeButton.setAttribute("aria-label", `${versionLabel} 레이블 닫기`);
        closeButton.textContent = "×";

        label.append(openButton, closeButton);
        container.append(label);
        label.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    // 버전 레이블 선택과 닫기 처리
    function initDraftVersions() {
        const container = document.querySelector("[data-answer-version-labels]");
        const versionSelect = document.querySelector(".answer-version-select");
        if (!container || !versionSelect) return;

        const activateLabel = (target) => {
            const openButton = target.closest("[data-answer-version-open]");
            const label = openButton?.closest("[data-answer-version-label]");
            if (!label || !container.contains(label)) return;
            setActiveDraftVersion(label.dataset.answerVersionLabel);
        };

        container.addEventListener("click", (event) => {
            const closeButton = event.target.closest("[data-answer-version-close]");
            if (!closeButton) {
                activateLabel(event.target);
                return;
            }

            event.stopPropagation();
            const label = closeButton.closest("[data-answer-version-label]");
            if (!label) return;
            const labels = Array.from(container.querySelectorAll("[data-answer-version-label]"));
            if (labels.length <= 1) {
                showToast("최소 한 개의 버전 레이블은 열어 두어야 합니다.");
                return;
            }

            const wasActive = label.classList.contains("active");
            const closedLabel = label.querySelector("[data-answer-version-open]")?.textContent?.trim() || "선택한 버전";
            label.remove();
            if (wasActive) {
                const nextLabel = container.querySelector("[data-answer-version-label]:last-child");
                setActiveDraftVersion(nextLabel.dataset.answerVersionLabel, { openLabel: false });
            }
            showToast(`${closedLabel} 레이블을 닫았습니다.`);
        });

        versionSelect.addEventListener("change", () => setActiveDraftVersion(versionSelect.value));
        setActiveDraftVersion(versionSelect.value);
    }

    // 현재 초안 다음 버전을 생성하고 버전 UI를 동기화
    function createNextDraftVersion() {
        const versionSelect = document.querySelector(".answer-version-select");
        const versions = Array.from(versionSelect?.options || [])
            .map((option) => option.value.match(/^v(\d+)\.(\d+)$/))
            .filter(Boolean)
            .map((match) => ({ major: Number(match[1]), minor: Number(match[2]) }));
        const latestVersion = versions.reduce((latest, version) => {
            if (!latest || version.major > latest.major || (version.major === latest.major && version.minor > latest.minor)) return version;
            return latest;
        }, null);
        const major = latestVersion?.major || 1;
        const minor = (latestVersion?.minor || 0) + 1;
        const versionName = `v${major}.${minor}`;
        const versionLabel = `${versionName}(${getCurrentTime()})`;

        if (versionSelect) {
            const option = document.createElement("option");
            option.value = versionName;
            option.textContent = versionLabel;
            versionSelect.append(option);
            setActiveDraftVersion(versionName);
        }

        return versionName;
    }

    // 새 채팅에서는 HTML에 선언된 최초 버전만 유지
    function resetDraftVersions() {
        const versionSelect = document.querySelector(".answer-version-select");
        const container = document.querySelector("[data-answer-version-labels]");
        if (!versionSelect?.options.length || !container) return;
        while (versionSelect.options.length > 1) versionSelect.remove(versionSelect.options.length - 1);

        const firstOption = versionSelect.options[0];
        container.replaceChildren();
        openDraftVersionLabel(firstOption.value, firstOption.textContent.trim());
        setActiveDraftVersion(firstOption.value, { openLabel: false });
    }

    // 기존 ChatMessage 마크업으로 채팅 메시지 생성
    function createChatMessage(role, text) {
        const messages = document.querySelector("#answerChatMessages");
        const template = messages?.querySelector(`[data-component="chat-message"][data-role="${role}"][data-status="complete"]`);
        if (!template) return null;

        const message = template.cloneNode(true);
        const textElement = message.querySelector(".msg-text");
        const timeElement = message.querySelector(".msg-time");
        if (!textElement || !timeElement) return null;

        message.className = `chat-msg ${role}`;
        message.dataset.component = "chat-message";
        message.dataset.variant = "answer";
        message.dataset.role = role;
        message.dataset.status = "complete";
        message.removeAttribute("id");
        message.removeAttribute("aria-busy");
        message.removeAttribute("data-message-actions");
        message.querySelector(":scope > .msg-actions")?.remove();
        textElement.textContent = text;
        timeElement.textContent = getCurrentTime();
        return message;
    }

    // 채팅 메시지 추가
    function appendChatMessage(role, text) {
        const messages = document.querySelector("#answerChatMessages");
        const message = createChatMessage(role, text);
        if (!messages || !message) return null;
        messages.append(message);
        return message;
    }

    // 채팅 목록 하단으로 스크롤
    function scrollChatToBottom() {
        const messages = document.querySelector("#answerChatMessages");
        if (messages) messages.scrollTop = messages.scrollHeight;
    }

    // 채팅 기능 초기화
    // 답변 생성 결과 영역에 스켈레톤을 표시합니다.
    function showAnswerSkeleton(message = "AI 응답 데이터를 불러오고 있습니다...") {
        hideAnswerSkeleton();

        const panel = document.querySelector('.three-panel [data-panel="center"]');
        if (!panel) return;

        const overlay = document.createElement("div");
        overlay.className = "api-skeleton-overlay answer-api-skeleton";
        overlay.setAttribute("role", "status");
        overlay.setAttribute("aria-live", "polite");
        overlay.innerHTML = `
            <div class="skeleton-loading-label"></div>
            <div class="answer-skeleton-columns">
                <div class="answer-skeleton-list">
                    ${Array.from(
                        { length: 4 },
                        () => `
                            <div class="skeleton-card">
                                <div class="skeleton-card-row">
                                    <div class="ai-skeleton skeleton-circle"></div>
                                    <div class="ai-skeleton skeleton-line lg"></div>
                                </div>
                                <div class="ai-skeleton skeleton-line full"></div>
                                <div class="ai-skeleton skeleton-line md"></div>
                            </div>`,
                    ).join("")}
                </div>
                <div class="answer-skeleton-preview">
                    <div class="ai-skeleton skeleton-line sm"></div>
                    ${Array.from(
                        { length: 3 },
                        () => `
                            <div class="skeleton-card">
                                <div class="ai-skeleton skeleton-line lg"></div>
                                <div class="ai-skeleton skeleton-line full"></div>
                                <div class="ai-skeleton skeleton-line full"></div>
                                <div class="ai-skeleton skeleton-line md"></div>
                            </div>`,
                    ).join("")}
                </div>
            </div>`;
        overlay.querySelector(".skeleton-loading-label").textContent = message;
        panel.setAttribute("aria-busy", "true");
        panel.append(overlay);
    }

    // 답변 생성 결과 영역의 스켈레톤을 제거합니다.
    function hideAnswerSkeleton() {
        document.querySelectorAll(".answer-api-skeleton").forEach((overlay) => {
            const panel = overlay.closest('[data-panel="center"]');
            overlay.remove();
            panel?.removeAttribute("aria-busy");
        });
    }

    function initChat() {
        const messages = document.querySelector("#answerChatMessages");
        const form = document.querySelector("[data-answer-chat-form]");
        const input = document.querySelector("#answerChatInput");
        const submit = form?.querySelector('[type="submit"]');
        if (!messages || !form || !input || !submit) return;

        window.ChatMessage?.bind(messages, {
            onFeedback: () => showToast("피드백이 반영되었습니다."),
            onCopy: ({ copied }) => showToast(copied ? "복사되었습니다." : "복사하지 못했습니다."),
            onMore: () => showToast("추가옵션"),
        });

        input.addEventListener("input", () => {
            submit.disabled = input.value.trim().length === 0;
        });
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const question = input.value.trim();
            if (!question) return;

            appendChatMessage("user", question);
            input.value = "";
            submit.disabled = true;

            const pendingMessage = window.ChatMessage?.createPending({
                variant: "answer",
                title: "생성 중",
                description: "답변서 초안을 생성하고 있습니다...",
            });
            if (pendingMessage) messages.append(pendingMessage);
            scrollChatToBottom();

            const isSearchRequest = /검색|찾아|추천/.test(question);
            showAnswerSkeleton(isSearchRequest ? "관련자료를 검색하고 있습니다..." : "답변서 초안 데이터를 생성하고 있습니다...");

            scheduleWorkspaceTask(() => {
                hideAnswerSkeleton();
                restoreRecommendationResults();
                const aiMessage = createChatMessage("ai", "요청하신 내용을 기준으로 관련자료와 답변서 초안을 갱신했습니다. 답변서 초안 탭에서 근거 문장과 확인 필요 항목을 검토해 주세요.");
                if (aiMessage && pendingMessage?.isConnected) {
                    pendingMessage.replaceWith(aiMessage);
                } else if (aiMessage) {
                    messages.append(aiMessage);
                } else {
                    pendingMessage?.remove();
                }
                if (aiMessage) window.ChatMessage?.typewrite(aiMessage, { scrollContainer: messages });
                scrollChatToBottom();
                const versionName = createNextDraftVersion();
                showToast(`${versionName} 버전으로 생성되었습니다.`);
            }, 1500);
        });

        document.querySelectorAll(".chat-tag").forEach((tag) => {
            tag.addEventListener("click", () => {
                input.value = tag.textContent.trim();
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.focus();
            });
        });

        scrollChatToBottom();
    }

    // 답변 워크스페이스 초기화
    function resetAnswerWorkspace() {
        clearPendingWorkspaceTasks();
        hideAnswerSkeleton();
        resetDraftVersions();
        document.body.classList.add("is-new-chat");

        const layout = document.querySelector(".three-panel-area > .three-panel");
        const sourceFiles = document.querySelector(".answer-source-files");
        const sourceInput = document.querySelector("#answerSourceFileInput");
        const cards = Array.from(document.querySelectorAll("[data-reference-card]"));
        const messages = document.querySelector("#answerChatMessages");
        const chatInput = document.querySelector("#answerChatInput");
        const chatSubmit = document.querySelector('[data-answer-chat-form] [type="submit"]');
        const applyButton = document.querySelector("[data-apply-references]");

        sourceFiles?.replaceChildren();
        if (sourceInput) sourceInput.value = "";
        syncSourceFileState();

        cards.forEach((card) => {
            card.classList.remove("active");
            card.hidden = false;
            const checkbox = card.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = false;
        });
        document.querySelectorAll("[data-reference-filter]").forEach((button) => {
            const isAll = button.dataset.referenceFilter === "all";
            button.classList.toggle("active", isAll);
            button.setAttribute("aria-pressed", String(isAll));
        });
        syncSelectedReferences(cards);
        setRecommendationEmptyState(true);
        setTabCount("draft", 0);
        setDraftEmptyState(true);

        if (applyButton) {
            delete applyButton.dataset.applying;
            applyButton.disabled = false;
        }

        document.querySelectorAll("[data-answer-highlight-toggle], [data-answer-source-toggle]").forEach((toggle) => {
            toggle.checked = true;
            toggle.dispatchEvent(new Event("change", { bubbles: true }));
        });

        const introMessage = messages?.querySelector(":scope > [data-chat-intro]");
        if (messages && introMessage) {
            messages.replaceChildren(introMessage);
            const introText = introMessage.querySelector(".msg-text");
            const introTime = introMessage.querySelector(".msg-time");
            if (introText) introText.textContent = AI_CHAT_INTRO;
            if (introTime) introTime.textContent = getCurrentTime();
        }
        if (chatInput) chatInput.value = "";
        if (chatSubmit) chatSubmit.disabled = true;

        resetAnswerPanelOrder(layout);
        expandSourcePanel();
        resetPanelResizeLayout(layout);
        setActiveTab("recommend");
        scrollChatToBottom();
        chatInput?.focus();
    }

    /* ============================ 끝: 채팅 ============================== */

    /* ============================ 시작: 상단바와 화면 시작 ============================ */

    // 상단바 동작 초기화
    function initTopbarActions() {
        document.querySelector("#newClassifyBtn")?.addEventListener("click", () => {
            resetAnswerWorkspace();
            showToast("새 채팅을 시작했습니다.");
        });

        const chatListSidepop = document.querySelector("#answerChatListSidepop");
        chatListSidepop?.querySelectorAll(".drawer-chat-select").forEach((select) => {
            select.addEventListener("click", () => {
                const topic = select.closest(".drawer-chat-item");
                if (!topic) return;
                document.querySelectorAll("#answerChatListSidepop .drawer-chat-item").forEach((item) => item.classList.toggle("is-active", item === topic));
                window.AIOneSidePop?.close("#answerChatListSidepop");
                showToast("선택한 채팅으로 전환했습니다.");
            });
        });
        chatListSidepop?.addEventListener("sidepop:chat-action", (event) => {
            const { action, completed, pinned, title } = event.detail || {};
            if (!completed) return;
            if (action === "share") {
                showToast("대화 공유 링크가 복사되었습니다.");
            }
            if (action === "delete") {
                showToast("대화가 삭제되었습니다.");
            }
            if (action === "pin") {
                showToast(pinned ? `'${title}' 대화를 목록 상단에 고정했습니다.` : `'${title}' 대화 고정을 해제했습니다.`);
            }
        });
    }

    // 화면 초기화
    function init() {
        hydrateIcons();
        if (initialized || !allComponentsReady()) return;
        initialized = true;

        configureTopbar();
        initSidebar();
        initTabs();
        initReferences();
        initSourceUpload();
        initDocumentActions();
        initDraftVerification();
        initDraftVersions();
        initPanelTools();
        initChat();
        initTopbarActions();
    }

    document.addEventListener("DOMContentLoaded", init);

    /* ============================ 끝: 상단바와 화면 시작 ============================== */
})();
