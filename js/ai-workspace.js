(() => {
    "use strict";

    /* 파일 구성: 규칙/알림 설정 -> 실행/파일/질의 상태 -> 패널 배치 -> 페이지 시작. */

    // 워크스페이스 Prototype 복제
    function cloneWorkspacePrototype(prototypeId) {
        const prototype = document.getElementById(prototypeId);
        if (!prototype) return null;
        const clone = (prototype.firstElementChild || prototype).cloneNode(true);
        clone.removeAttribute("id");
        clone.removeAttribute("hidden");
        clone.removeAttribute("data-dom-prototype");
        return clone;
    }

    /* ============================ 시작: HTML 작성 데이터 ============================ */
    // 화면에 작성된 분류 룰을 초기 상태로 변환합니다.
    function readAuthoredWorkspaceRules(root = document) {
        const list = root.querySelector?.("[data-workspace-rule-settings] [data-rule-list]");
        if (!list) return [];

        return Array.from(list.querySelectorAll(".rule-item[data-rule-id]"), (item) => {
            const normalizeText = (element) =>
                String(element?.textContent || "")
                    .replace(/\s+/g, " ")
                    .trim();
            const keywords = normalizeText(item.querySelector(".rule-item-keywords"));
            const summary = normalizeText(item.querySelector(".rule-item-body"));
            const [condition = "", department = ""] = summary.split(/\s*→\s*/, 2);
            const priorityText = normalizeText(item.querySelector(".rule-priority-badge"));

            return {
                id: Number(item.dataset.ruleId),
                keywords,
                includeKeywords: keywords,
                excludeKeywords: "",
                conditionMode: item.dataset.ruleInitialConditionMode || "일부 포함",
                condition,
                scope: item.dataset.ruleInitialScope || "현재 실행 건",
                dept: department,
                priority: Number.parseInt(priorityText.match(/\d+/)?.[0], 10) || 1,
                conflict: item.dataset.ruleInitialConflict || "rule",
                active: !item.classList.contains("disabled"),
                memo: "",
            };
        }).filter((rule) => Number.isFinite(rule.id));
    }

    const files = [];
    const fileData = {};
    const defaultMeta = {
        date: "",
        committee: "",
        memberName: "",
        partyName: "",
        formTitle: "",
    };
    const iconBaseUrl = new URL("../assets/icons/", document.baseURI);
    const questionSelector = ".orig-query-box[data-question-index]";
    const workspaceSampleData = { files, fileData, defaultMeta };
    const workspaceRunListItems = [];
    let workspaceSkeletonTimer = null;
    const after9Workspace = {
        data: {
            classifyRules: readAuthoredWorkspaceRules(),
            notificationAssigneeStorageKey: "ai-one-notification-assignees-v1",
        },
        state: {
            confirmedQuestions: [],
            confirmationState: "draft",
            currentRuleId: null,
            isCreatingRule: false,
            pendingQueryExclusion: null,
            notificationAssignee: {
                directory: [],
                savedAssignments: new Map(),
                workingAssignments: new Map(),
                selectedOrganization: "all",
                searchTerm: "",
                expandedOrganizations: new Set(),
            },
        },
        features: {
            queryExclusion: Object.freeze({
                prepare: prepareWorkspaceQueryExclusion,
                confirm: confirmWorkspaceQueryExclusion,
            }),
        },
    };

    /* ============================ 끝: HTML 작성 데이터 ============================== */
    let workspaceQuestionCards = [];
    let activeWorkspaceFileName = "";
    let currentQuestionFilter = "all";
    let activeWorkspaceRunId = workspaceRunListItems[0]?.id ?? null;
    const panelMinWidth = 220;
    const panelMinWidths = Object.freeze({ left: 280, center: 340, right: 300 });
    const panelHandleWidth = 2;
    const panelStates = new WeakMap();
    let pendingDeleteFileItem = null;
    let pendingRenameFileItem = null;
    let workspaceInitialFileItems = null;

    /* ============================ 끝: 프로토타입 데이터 ============================== */

    /* ============================ 시작: 화면 규칙 설정 ============================ */

    // 아이콘 경로 보정
    function hydrateIcons(root = document) {
        root.querySelectorAll?.("img[data-icon]").forEach((icon) => {
            if (icon.src) return;
            icon.src = new URL(`${icon.dataset.icon}.svg`, iconBaseUrl).href;
        });
    }

    // 토스트 메시지 표시
    function showToast(message) {
        window.AIOneToast?.show(message, {
            target: "#workspaceToast",
            duration: 1800,
        });
    }

    // 선택한 OCR 원문 또는 AI 질의 요약 복사
    async function copyResult(type) {
        const selector = type === "summary" ? "[data-result-summary]" : "[data-result-original]";
        const source = document.querySelector(selector);
        const text = source?.textContent?.replace(/\s+/g, " ").trim();
        if (!text) return;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                const textarea = document.createElement("textarea");
                textarea.value = text;
                textarea.setAttribute("readonly", "");
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.select();
                const copied = document.execCommand("copy");
                textarea.remove();
                if (!copied) throw new Error("Clipboard copy failed");
            }
            showToast("복사되었습니다.");
        } catch (error) {
            showToast("복사하지 못했습니다.");
        }
    }

    // AFTER-9 부분 구현: 폼/목록 UI는 구현되어 있지만 트리거가 주석 처리되어 있으며
    // HTML에서 저장/적용은 현재 메모리의 예시 상태와 토스트만 변경합니다.
    // 워크스페이스 규칙 Keywords 분리
    function splitWorkspaceRuleKeywords(value) {
        return String(value || "")
            .split(",")
            .map((keyword) => keyword.trim())
            .filter(Boolean);
    }

    // 워크스페이스 규칙 요소 조회
    function getWorkspaceRuleElements(settings) {
        return {
            list: settings.querySelector("[data-rule-list]"),
            name: settings.querySelector("[data-rule-name]"),
            department: settings.querySelector("[data-rule-department]"),
            priority: settings.querySelector("[data-rule-priority]"),
            active: settings.querySelector("[data-rule-active]"),
            include: settings.querySelector("[data-rule-include]"),
            exclude: settings.querySelector("[data-rule-exclude]"),
            condition: settings.querySelector("[data-rule-condition]"),
            scope: settings.querySelector("[data-rule-scope]"),
            memo: settings.querySelector("[data-rule-memo]"),
            mode: settings.querySelector("[data-rule-form-mode]"),
        };
    }

    // 워크스페이스 규칙 태그 렌더링
    function renderWorkspaceRuleTags(settings, selector, value) {
        const container = settings.querySelector(selector);
        if (!container) return;
        const tags = splitWorkspaceRuleKeywords(value)
            .map((keyword) => {
                const tag = cloneWorkspacePrototype("workspaceRuleTagPrototype");
                if (tag) tag.textContent = keyword;
                return tag;
            })
            .filter(Boolean);
        container.replaceChildren(...tags);
    }

    // 워크스페이스 규칙 Choice 설정
    function setWorkspaceRuleChoice(settings, name, value, hiddenSelector = "") {
        const options = Array.from(settings.querySelectorAll(`input[name="${name}"]`));
        const target = options.find((option) => option.value === value) || options[0];
        if (target) target.checked = true;
        const hidden = hiddenSelector ? settings.querySelector(hiddenSelector) : null;
        if (hidden) hidden.value = target?.value || value;
    }

    // 워크스페이스 규칙 폼 Mode 설정
    function setWorkspaceRuleFormMode(settings, isNew) {
        after9Workspace.state.isCreatingRule = Boolean(isNew);
        const { mode } = getWorkspaceRuleElements(settings);
        const layer = settings.closest("[data-sidepop]");
        const saveButton = layer?.querySelector('[data-rule-action="save"]');
        const addButton = layer?.querySelector('[data-rule-action="add"]');

        if (mode) {
            mode.textContent = isNew ? "신규 등록" : "편집";
            mode.classList.toggle("new", isNew);
        }
        if (saveButton) {
            saveButton.textContent = isNew ? "룰 등록" : "저장";
            saveButton.classList.toggle("new-mode", isNew);
        }
        addButton?.classList.toggle("is-new", isNew);
    }

    // 워크스페이스 규칙 Condition Summary 구성
    function buildWorkspaceRuleConditionSummary(mode, includeKeywords) {
        const words = splitWorkspaceRuleKeywords(includeKeywords);
        if (!words.length) return mode;
        const quoted = words
            .slice(0, 3)
            .map((word) => `“${word}”`)
            .join(", ");
        if (mode === "모두 포함") return `${quoted} 모두 포함 시`;
        if (mode === "정확히 일치") return `${quoted} 정확히 일치 시`;
        return `${quoted} 중 일부 포함 시`;
    }

    // 워크스페이스 규칙 목록 렌더링
    function renderWorkspaceRuleList(settings, selectedId) {
        const { list } = getWorkspaceRuleElements(settings);
        if (!list) return;
        const activeId = selectedId === undefined ? (after9Workspace.state.currentRuleId ?? after9Workspace.data.classifyRules[0]?.id) : selectedId;
        const orderedRules = [...after9Workspace.data.classifyRules].sort((a, b) => (Number(a.priority) || 999) - (Number(b.priority) || 999) || a.id - b.id);
        const authoredItems = new Map(Array.from(list.querySelectorAll(".rule-item[data-rule-id]"), (item) => [Number(item.dataset.ruleId), item]));
        const ruleItems = orderedRules
            .map((rule) => {
                const item = authoredItems.get(rule.id) || cloneWorkspacePrototype("workspaceRuleItemPrototype");
                if (!item) return null;
                const isActive = rule.id === activeId;
                item.classList.toggle("active", isActive);
                item.classList.toggle("disabled", !rule.active);
                item.dataset.ruleId = String(rule.id);
                item.setAttribute("aria-pressed", String(isActive));
                item.querySelector(".rule-item-keywords").textContent = rule.keywords;
                item.querySelector(".rule-priority-badge").textContent = `룰 ${Number(rule.priority) || 1}순위`;
                const status = item.querySelector(".rule-item-status");
                status.classList.add(rule.active ? "on" : "off");
                status.textContent = rule.active ? "사용" : "미사용";
                item.querySelector(".rule-item-body").textContent = `${rule.condition} → ${rule.dept}`;
                return item;
            })
            .filter(Boolean);
        list.replaceChildren(...ruleItems);
    }

    // 워크스페이스 규칙을 폼에 불러오기
    function loadWorkspaceRuleToForm(settings, rule) {
        if (!rule) return;
        const elements = getWorkspaceRuleElements(settings);
        after9Workspace.state.currentRuleId = rule.id;
        setWorkspaceRuleFormMode(settings, false);
        elements.name.value = rule.keywords || "";
        elements.department.value = rule.dept || "";
        if (!elements.department.value && rule.dept) {
            const option = new Option(rule.dept, rule.dept);
            elements.department.add(option);
            elements.department.value = rule.dept;
        }
        elements.priority.value = String(rule.priority || 1);
        elements.active.checked = rule.active !== false;
        elements.include.value = rule.includeKeywords || rule.keywords || "";
        elements.exclude.value = rule.excludeKeywords || "";
        elements.memo.value = rule.memo || "";
        setWorkspaceRuleChoice(settings, "workspaceRuleConditionChoice", rule.conditionMode || "일부 포함", "[data-rule-condition]");
        setWorkspaceRuleChoice(settings, "workspaceRuleScopeChoice", rule.scope || "전체 적용", "[data-rule-scope]");
        setWorkspaceRuleChoice(settings, "workspaceRuleConflict", rule.conflict || "rule");
        renderWorkspaceRuleTags(settings, "[data-rule-include-tags]", elements.include.value);
        renderWorkspaceRuleTags(settings, "[data-rule-exclude-tags]", elements.exclude.value);
    }

    // 워크스페이스 규칙 폼 초기화
    function resetWorkspaceRuleForm(settings) {
        const elements = getWorkspaceRuleElements(settings);
        after9Workspace.state.currentRuleId = null;
        setWorkspaceRuleFormMode(settings, true);
        elements.name.value = "";
        elements.department.selectedIndex = 0;
        elements.priority.value = "1";
        elements.active.checked = true;
        elements.include.value = "";
        elements.exclude.value = "";
        elements.memo.value = "";
        setWorkspaceRuleChoice(settings, "workspaceRuleConditionChoice", "일부 포함", "[data-rule-condition]");
        setWorkspaceRuleChoice(settings, "workspaceRuleScopeChoice", "현재 실행 건", "[data-rule-scope]");
        setWorkspaceRuleChoice(settings, "workspaceRuleConflict", "rule");
        renderWorkspaceRuleTags(settings, "[data-rule-include-tags]", "");
        renderWorkspaceRuleTags(settings, "[data-rule-exclude-tags]", "");

        const { list } = elements;
        list?.querySelectorAll(".rule-item").forEach((item) => {
            item.classList.remove("active");
            item.setAttribute("aria-pressed", "false");
        });
        if (list) {
            const draft = cloneWorkspacePrototype("workspaceRuleDraftPrototype");
            if (draft) list.prepend(draft);
        }
        requestAnimationFrame(() => elements.name?.focus());
    }

    // 워크스페이스 규칙 저장
    function saveWorkspaceRule(settings) {
        const elements = getWorkspaceRuleElements(settings);
        const ruleName = elements.name.value.trim();
        const includeKeywords = elements.include.value.trim();
        const department = elements.department.value.trim();
        if (!ruleName) {
            showToast("룰명을 입력해주세요.");
            elements.name.focus();
            return;
        }
        if (!includeKeywords) {
            showToast("포함 키워드를 입력해주세요.");
            elements.include.focus();
            return;
        }
        if (!department) {
            showToast("추천 실국을 선택해주세요.");
            return;
        }

        const payload = {
            keywords: ruleName,
            includeKeywords,
            excludeKeywords: elements.exclude.value.trim(),
            conditionMode: elements.condition.value,
            condition: buildWorkspaceRuleConditionSummary(elements.condition.value, includeKeywords),
            scope: elements.scope.value,
            dept: department,
            priority: Math.min(10, Math.max(1, Number.parseInt(elements.priority.value, 10) || 1)),
            conflict: settings.querySelector('input[name="workspaceRuleConflict"]:checked')?.value || "rule",
            active: elements.active.checked,
            memo: elements.memo.value.trim(),
        };

        if (after9Workspace.state.isCreatingRule || after9Workspace.state.currentRuleId === null) {
            const newRule = { id: Date.now(), ...payload };
            after9Workspace.data.classifyRules.unshift(newRule);
            after9Workspace.state.currentRuleId = newRule.id;
            after9Workspace.state.isCreatingRule = false;
            renderWorkspaceRuleList(settings, newRule.id);
            loadWorkspaceRuleToForm(settings, newRule);
            showToast("새 분류 룰이 등록되었습니다.");
            return;
        }

        const ruleIndex = after9Workspace.data.classifyRules.findIndex((rule) => rule.id === after9Workspace.state.currentRuleId);
        if (ruleIndex >= 0) after9Workspace.data.classifyRules[ruleIndex] = { ...after9Workspace.data.classifyRules[ruleIndex], ...payload };
        renderWorkspaceRuleList(settings, after9Workspace.state.currentRuleId);
        showToast("분류 룰이 저장되었습니다.");
    }

    // 워크스페이스 규칙 설정 초기화
    function initWorkspaceRuleSettings(root = document) {
        const settings = root.matches?.("[data-workspace-rule-settings]") ? root : root.querySelector?.("[data-workspace-rule-settings]");
        if (!settings || settings.dataset.ruleSettingsReady === "true") return;
        const layer = settings.closest("[data-sidepop]");
        if (!layer) return;

        settings.querySelectorAll('input[name="workspaceRuleConditionChoice"]').forEach((input) => {
            input.addEventListener("change", () => {
                if (input.checked) settings.querySelector("[data-rule-condition]").value = input.value;
            });
        });
        settings.querySelectorAll('input[name="workspaceRuleScopeChoice"]').forEach((input) => {
            input.addEventListener("change", () => {
                if (input.checked) settings.querySelector("[data-rule-scope]").value = input.value;
            });
        });
        settings.querySelector("[data-rule-include]")?.addEventListener("input", (event) => {
            renderWorkspaceRuleTags(settings, "[data-rule-include-tags]", event.currentTarget.value);
        });
        settings.querySelector("[data-rule-exclude]")?.addEventListener("input", (event) => {
            renderWorkspaceRuleTags(settings, "[data-rule-exclude-tags]", event.currentTarget.value);
        });
        settings.querySelector("[data-rule-list]")?.addEventListener("click", (event) => {
            const item = event.target.closest("[data-rule-id]");
            if (!item) return;
            const rule = after9Workspace.data.classifyRules.find((candidate) => candidate.id === Number(item.dataset.ruleId));
            if (!rule) return;
            renderWorkspaceRuleList(settings, rule.id);
            loadWorkspaceRuleToForm(settings, rule);
        });
        layer.addEventListener("click", (event) => {
            const button = event.target.closest("[data-rule-action]");
            if (!button) return;
            if (button.dataset.ruleAction === "add") {
                renderWorkspaceRuleList(settings, null);
                resetWorkspaceRuleForm(settings);
                showToast("새 룰을 등록할 수 있습니다. 내용을 입력해주세요.");
                return;
            }
            if (button.dataset.ruleAction === "save") {
                saveWorkspaceRule(settings);
                return;
            }
            if (button.dataset.ruleAction === "apply") {
                showToast("저장된 룰 기준으로 AI 분류를 다시 실행합니다.");
            }
        });
        layer.addEventListener("sidepop:open", () => {
            const activeRule = after9Workspace.data.classifyRules.find((rule) => rule.id === after9Workspace.state.currentRuleId) || after9Workspace.data.classifyRules[0];
            renderWorkspaceRuleList(settings, activeRule?.id);
            if (activeRule) loadWorkspaceRuleToForm(settings, activeRule);
        });

        settings.dataset.ruleSettingsReady = "true";
        const firstRule = after9Workspace.data.classifyRules[0];
        renderWorkspaceRuleList(settings, firstRule?.id);
        if (firstRule) loadWorkspaceRuleToForm(settings, firstRule);
    }

    /* ============================ 끝: 화면 규칙 설정 ============================== */

    /* ============================ 시작: 9월 이후 알림 담당자와 라우팅 ============================ */

    // AFTER-9 부분 구현: 이 블록은 숨겨진 알림 라우팅을 준비하며
    // 부서 알림 흐름을 위한 것입니다. 백엔드 알림 클라이언트는 아닙니다.
    // 실국별 알림 담당자 설정은 ai-workspace.html에 작성된 조직/담당자 목록을 원본으로 사용합니다.
    function normalizeWorkspaceNotificationText(element) {
        return String(element?.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
    }

    // HTML에 작성된 실국/담당자 목록 조회
    function readAuthoredWorkspaceNotificationDirectory(panel) {
        return Array.from(panel.querySelectorAll("[data-notification-department]"), (card) => {
            const department = card.dataset.notificationDepartment || normalizeWorkspaceNotificationText(card.querySelector(".notification-dept-name"));
            const organization = normalizeWorkspaceNotificationText(card.querySelector(".notification-dept-org"));
            const staff = Array.from(card.querySelectorAll("[data-notification-person-id]"), (button) => ({
                id: button.dataset.notificationPersonId,
                name: normalizeWorkspaceNotificationText(button.querySelector(".notification-assignee-name")),
                selected: button.getAttribute("aria-pressed") === "true",
                button,
            })).filter((person) => person.id);

            return {
                organization,
                department,
                searchText: normalizeWorkspaceNotificationText(card).toLocaleLowerCase("ko-KR"),
                card,
                staff,
            };
        }).filter((group) => group.department);
    }

    function cloneWorkspaceNotificationAssignments(source) {
        return new Map(Array.from(source, ([department, ids]) => [department, new Set(ids)]));
    }

    function createAuthoredWorkspaceNotificationAssignments(directory) {
        return new Map(directory.map((group) => [group.department, new Set(group.staff.filter((person) => person.selected).map((person) => person.id))]));
    }

    function loadWorkspaceNotificationAssignments(directory) {
        const assignments = createAuthoredWorkspaceNotificationAssignments(directory);
        try {
            const stored = JSON.parse(localStorage.getItem(after9Workspace.data.notificationAssigneeStorageKey) || "{}");
            if (!stored || typeof stored !== "object" || Array.isArray(stored)) return assignments;

            directory.forEach((group) => {
                if (!Array.isArray(stored[group.department])) return;
                const validIds = new Set(group.staff.map((person) => person.id));
                assignments.set(group.department, new Set(stored[group.department].filter((id) => validIds.has(id))));
            });
        } catch (error) {
            /* localStorage를 사용할 수 없는 환경에서는 HTML의 초기 선택 상태를 사용합니다. */
        }
        return assignments;
    }

    function persistWorkspaceNotificationAssignments() {
        const state = after9Workspace.state.notificationAssignee;
        try {
            const payload = Object.fromEntries(state.directory.map((group) => [group.department, [...(state.savedAssignments.get(group.department) || [])]]));
            localStorage.setItem(after9Workspace.data.notificationAssigneeStorageKey, JSON.stringify(payload));
        } catch (error) {
            /* localStorage를 사용할 수 없는 환경에서는 현재 화면 상태만 유지합니다. */
        }
    }

    function getSavedWorkspaceNotificationRecipients(department) {
        const state = after9Workspace.state.notificationAssignee;
        const group = state.directory.find((item) => item.department === department);
        if (!group) return null;
        const selectedIds = state.savedAssignments.get(department) || new Set();
        return group.staff.filter((person) => selectedIds.has(person.id)).map((person) => person.name);
    }

    function getWorkspaceNotificationAssignmentsSnapshot() {
        const state = after9Workspace.state.notificationAssignee;
        return Object.fromEntries(state.directory.map((group) => [group.department, getSavedWorkspaceNotificationRecipients(group.department) || []]));
    }

    function setWorkspaceNotificationFeedback(panel, message = "", type = "") {
        const feedback = panel.querySelector("[data-notification-feedback]");
        if (!feedback) return;
        feedback.textContent = message;
        feedback.className = `notification-dept-feedback${type ? ` ${type}` : ""}`;
    }

    function syncWorkspaceNotificationAssigneeCards() {
        const state = after9Workspace.state.notificationAssignee;
        state.directory.forEach((group) => {
            const selectedIds = state.workingAssignments.get(group.department) || new Set();
            group.card.querySelector(".notification-dept-count")?.replaceChildren(`${selectedIds.size}명`);
            group.staff.forEach((person) => {
                const selected = selectedIds.has(person.id);
                person.button.classList.toggle("selected", selected);
                person.button.setAttribute("aria-pressed", String(selected));
                person.button.querySelector(".notification-assignee-meta")?.replaceChildren(`${group.department}${selected ? " · 실국담당자" : ""}`);
                person.button.querySelector(".notification-check")?.replaceChildren(selected ? "✓" : "");
            });
        });
    }

    function syncWorkspaceNotificationNavigation(panel) {
        const state = after9Workspace.state.notificationAssignee;
        const allSelected = state.selectedOrganization === "all";
        const allButton = panel.querySelector('[data-notification-organization="all"]');
        allButton?.classList.toggle("selected", allSelected);
        allButton?.setAttribute("aria-pressed", String(allSelected));

        panel.querySelectorAll("[data-notification-tree-org]").forEach((button) => {
            const organization = button.dataset.notificationTreeOrg;
            const selected = state.selectedOrganization === `org:${organization}`;
            const expanded = state.expandedOrganizations.has(organization);
            button.classList.toggle("selected", selected);
            button.setAttribute("aria-pressed", String(selected));
            button.setAttribute("aria-expanded", String(expanded));
            const group = button.closest(".notification-tree-group");
            group?.classList.toggle("expanded", expanded);
            group?.querySelector(".notification-tree-children")?.classList.toggle("hidden", !expanded);
        });

        panel.querySelectorAll("[data-notification-tree-dept]").forEach((button) => {
            const selected = state.selectedOrganization === `dept:${button.dataset.notificationTreeDept}`;
            button.classList.toggle("selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        });
    }

    function applyWorkspaceNotificationFilters(panel) {
        const state = after9Workspace.state.notificationAssignee;
        const searchTerm = state.searchTerm.trim().toLocaleLowerCase("ko-KR");
        let visibleCount = 0;

        state.directory.forEach((group) => {
            const organizationMatched =
                state.selectedOrganization === "all" ||
                state.selectedOrganization === `org:${group.organization}` ||
                state.selectedOrganization === `dept:${group.department}`;
            const visible = organizationMatched && (!searchTerm || group.searchText.includes(searchTerm));
            group.card.hidden = !visible;
            if (visible) visibleCount += 1;
        });

        const organizationLabel = state.selectedOrganization === "all" ? "전체 조직" : state.selectedOrganization.slice(state.selectedOrganization.indexOf(":") + 1);
        panel.querySelector("[data-notification-dept-result]")?.replaceChildren(`${organizationLabel} · ${visibleCount}개 조직`);
        const searchClear = panel.querySelector("[data-notification-search-clear]");
        if (searchClear) searchClear.hidden = !state.searchTerm;
        const empty = panel.querySelector("[data-notification-dept-empty]");
        if (empty) empty.hidden = visibleCount > 0;
        syncWorkspaceNotificationNavigation(panel);
    }

    function updateWorkspaceNotificationTriggerState(layer) {
        const state = after9Workspace.state.notificationAssignee;
        const configuredCount = state.directory.filter((group) => (state.savedAssignments.get(group.department) || new Set()).size > 0).length;
        document.querySelectorAll("[data-modal-open]").forEach((button) => {
            if (button.dataset.modalOpen !== layer.id) return;
            button.classList.toggle("has-assignee", configuredCount > 0);
            button.title = "실국별 알림 담당자 설정";
        });
    }

    function resetWorkspaceNotificationAssignee(panel, layer) {
        const state = after9Workspace.state.notificationAssignee;
        state.workingAssignments = cloneWorkspaceNotificationAssignments(state.savedAssignments);
        state.selectedOrganization = "all";
        state.searchTerm = "";
        state.expandedOrganizations.clear();
        if (state.directory[0]?.organization) state.expandedOrganizations.add(state.directory[0].organization);
        const search = panel.querySelector("[data-notification-dept-search]");
        if (search) search.value = "";
        setWorkspaceNotificationFeedback(panel);
        syncWorkspaceNotificationAssigneeCards();
        applyWorkspaceNotificationFilters(panel);
        updateWorkspaceNotificationTriggerState(layer);
    }

    function initWorkspaceNotificationAssignee(root = document) {
        const panels = [];
        if (root.matches?.("[data-notification-assignee]")) panels.push(root);
        panels.push(...(root.querySelectorAll?.("[data-notification-assignee]") || []));

        panels.forEach((panel) => {
            if (panel.dataset.notificationAssigneeReady === "true") return;
            const layer = panel.closest("[data-modal]");
            const orgList = panel.querySelector("[data-notification-org-list]");
            const grid = panel.querySelector("[data-notification-dept-grid]");
            const search = panel.querySelector("[data-notification-dept-search]");
            const searchClear = panel.querySelector("[data-notification-search-clear]");
            if (!layer || !orgList || !grid || !search || !searchClear) return;

            const state = after9Workspace.state.notificationAssignee;
            state.directory = readAuthoredWorkspaceNotificationDirectory(panel);
            state.savedAssignments = loadWorkspaceNotificationAssignments(state.directory);
            state.workingAssignments = cloneWorkspaceNotificationAssignments(state.savedAssignments);

            orgList.addEventListener("click", (event) => {
                const allButton = event.target.closest('[data-notification-organization="all"]');
                if (allButton) {
                    state.selectedOrganization = "all";
                    setWorkspaceNotificationFeedback(panel);
                    applyWorkspaceNotificationFilters(panel);
                    return;
                }

                const organizationButton = event.target.closest("[data-notification-tree-org]");
                if (organizationButton) {
                    const organization = organizationButton.dataset.notificationTreeOrg;
                    if (state.expandedOrganizations.has(organization)) state.expandedOrganizations.delete(organization);
                    else state.expandedOrganizations.add(organization);
                    state.selectedOrganization = `org:${organization}`;
                    setWorkspaceNotificationFeedback(panel);
                    applyWorkspaceNotificationFilters(panel);
                    return;
                }

                const departmentButton = event.target.closest("[data-notification-tree-dept]");
                if (!departmentButton) return;
                state.selectedOrganization = `dept:${departmentButton.dataset.notificationTreeDept}`;
                setWorkspaceNotificationFeedback(panel);
                applyWorkspaceNotificationFilters(panel);
            });

            grid.addEventListener("click", (event) => {
                const personButton = event.target.closest("[data-notification-person-id]");
                const card = personButton?.closest("[data-notification-department]");
                if (!personButton || !card) return;
                const department = card.dataset.notificationDepartment;
                const selectedIds = state.workingAssignments.get(department) || new Set();
                const personId = personButton.dataset.notificationPersonId;
                if (selectedIds.has(personId)) selectedIds.delete(personId);
                else selectedIds.add(personId);
                state.workingAssignments.set(department, selectedIds);
                setWorkspaceNotificationFeedback(panel, `${department} 담당자 ${selectedIds.size}명이 지정되었습니다.`, "success");
                syncWorkspaceNotificationAssigneeCards();
            });

            search.addEventListener("input", () => {
                state.searchTerm = search.value;
                applyWorkspaceNotificationFilters(panel);
            });

            searchClear.addEventListener("click", () => {
                state.searchTerm = "";
                search.value = "";
                search.focus();
                applyWorkspaceNotificationFilters(panel);
            });

            panel.querySelector("[data-notification-save]")?.addEventListener("click", () => {
                state.savedAssignments = cloneWorkspaceNotificationAssignments(state.workingAssignments);
                persistWorkspaceNotificationAssignments();
                updateWorkspaceNotificationTriggerState(layer);
                const assigneeCount = state.directory.reduce((count, group) => count + (state.savedAssignments.get(group.department) || new Set()).size, 0);
                panel.dispatchEvent(
                    new CustomEvent("notification-assignee:save", {
                        bubbles: true,
                        detail: {
                            departmentCount: state.directory.length,
                            assigneeCount,
                            assignments: getWorkspaceNotificationAssignmentsSnapshot(),
                        },
                    }),
                );
            });

            layer.addEventListener("modal:open", () => resetWorkspaceNotificationAssignee(panel, layer));
            panel.dataset.notificationAssigneeReady = "true";
            resetWorkspaceNotificationAssignee(panel, layer);
        });
    }

    // 워크스페이스 알림 부서 분리
    function splitWorkspaceNotificationDepartments(value) {
        return String(value || "")
            .split(/[,·/]/)
            .map((department) => department.trim())
            .filter((department) => department && department !== "해당없음");
    }

    // 워크스페이스 알림 담당 부서 조회
    function getWorkspaceNotificationAssignments(query) {
        if (!query || query.type === "none") return [];

        const assignments = [];
        // 화면 동작 추가
        const append = (department, role) => {
            if (assignments.some((item) => item.department === department)) return;
            assignments.push({
                department,
                role,
                recipients: getWorkspaceNotificationRecipients(department),
            });
        };

        splitWorkspaceNotificationDepartments(query.mainDept).forEach((department) => append(department, "담당"));
        splitWorkspaceNotificationDepartments(query.coopDept).forEach((department) => append(department, "협조"));
        return assignments;
    }

    // 워크스페이스 알림 수신자 조회
    function getWorkspaceNotificationRecipients(department) {
        const configuredRecipients = getSavedWorkspaceNotificationRecipients(department);
        if (configuredRecipients) return configuredRecipients;

        const authoredDepartment = Array.from(document.querySelectorAll("[data-notification-department]")).find((item) => item.dataset.notificationDepartment === department);
        const authoredRecipients = Array.from(authoredDepartment?.querySelectorAll('.notification-dept-staff[aria-pressed="true"] .notification-assignee-name') || [], (item) => item.textContent.trim()).filter(Boolean);
        return authoredRecipients.length ? authoredRecipients : [`${department} 담당자 1`, `${department} 담당자 2`];
    }

    // Confirmed 워크스페이스 Snapshot 생성
    function createConfirmedWorkspaceSnapshot() {
        return workspaceQuestionCards
            .filter((query) => !query.excluded)
            .map((query, index) => ({
                id: query.id,
                number: index + 1,
                text: query.text,
                summary: query.summary || query.text,
                type: query.type,
                mainDept: query.mainDept,
                coopDept: query.coopDept,
            }));
    }

    // 워크스페이스 알림 라우팅 조회
    function getWorkspaceNotificationRouting() {
        const departments = new Map();
        const queries = after9Workspace.state.confirmedQuestions.map((query, index) => {
            const assignments = getWorkspaceNotificationAssignments(query);
            assignments.forEach((assignment) => {
                if (!departments.has(assignment.department)) {
                    departments.set(assignment.department, assignment.recipients);
                }
            });
            return { ...query, number: query.number || index + 1, assignments };
        });
        const assignedRecipients = Array.from(departments, ([department, names]) => names.map((name) => ({ department, name }))).flat();
        return {
            queries,
            queryCount: queries.length,
            departmentCount: departments.size,
            recipientCount: assignedRecipients.length,
        };
    }

    // 9월 버전 - 실국알림 클릭 이후 팝업 내용 호출
    // AFTER-9 부분 구현: 숨겨진 확정 질의 알림 대상 모달을 렌더링합니다.
    // 현재 릴리스에서는 HTML 트리거와 모달이 비활성화되어 있습니다.
    // 워크스페이스 알림 라우팅 렌더링
    function renderWorkspaceNotificationRouting() {
        const routing = getWorkspaceNotificationRouting();
        const modal = document.getElementById("workspaceDepartmentNotificationModal");
        if (!modal) return routing;

        modal.querySelector("[data-notification-route-query-count]")?.replaceChildren(`확정 질의 ${routing.queryCount}건`);
        modal.querySelector("[data-notification-route-recipient-summary]")?.replaceChildren(`배정 실국 ${routing.departmentCount}개 · 알림 대상 ${routing.recipientCount}명`);

        const list = modal.querySelector("[data-notification-route-list]");
        if (!list) return routing;
        const cards = routing.queries
            .map((query) => {
                const card = cloneWorkspacePrototype("workspaceNotificationQueryPrototype");
                if (!card) return null;
                card.querySelector(".notification-route-query-no").textContent = `질의 ${query.number}`;
                card.querySelector(".notification-query-match-title").textContent = query.summary || query.text || `질의 ${query.number}`;
                const departmentList = card.querySelector(".notification-query-dept-list");
                if (!query.assignments.length) {
                    const empty = cloneWorkspacePrototype("workspaceNotificationEmptyPrototype");
                    if (empty) departmentList.append(empty);
                } else {
                    query.assignments.forEach((assignment) => {
                        const row = cloneWorkspacePrototype("workspaceNotificationDepartmentPrototype");
                        if (!row) return;
                        row.querySelector(".notification-route-query-role").textContent = assignment.role;
                        row.querySelector(".notification-query-dept-name").textContent = assignment.department;
                        row.querySelector(".notification-query-recipient-count").textContent = `${assignment.recipients.length}명`;
                        row.querySelector(".notification-query-recipient-names").textContent = assignment.recipients.join(", ");
                        departmentList.append(row);
                    });
                }
                return card;
            })
            .filter(Boolean);
        list.replaceChildren(...cards);
        return routing;
    }

    // 질의확정 상태에 따라 버튼ui 변경
    // AFTER-9 부분 구현: 이 상태 머신은 현재 확인 UI에서 이미 사용되지만,
    // 확정 -> 부서 알림 분기는 HTML에서 숨겨져 있습니다.
    // 질문 Confirmation 상태 설정
    function setQuestionConfirmationState(state, shouldFocus = false) {
        const actions = document.querySelector("[data-question-confirm-actions]");
        if (!actions) return;

        const normalizedState = state === true ? "confirmed" : state === false ? "draft" : state;
        const nextState = ["draft", "confirmed", "notified"].includes(normalizedState) ? normalizedState : "draft";
        after9Workspace.state.confirmationState = nextState;
        actions.dataset.confirmed = String(nextState !== "draft");
        actions.dataset.confirmationState = nextState;
        actions.querySelectorAll("[data-question-confirm-state]").forEach((stateElement) => {
            stateElement.hidden = stateElement.dataset.questionConfirmState !== nextState;
        });

        if (!shouldFocus) return;
        const focusTarget = actions.querySelector(
            nextState === "confirmed" ? '[data-question-confirm-state="confirmed"] [data-workspace-action="department-notification"]' : '[data-question-confirm-state="draft"] [data-modal-open="workspaceQuestionConfirmModal"]',
        );
        focusTarget?.focus();
    }

    // 사이드바 보강
    function enhanceSidebar(host) {
        const sidebar = host.querySelector(".sidebar");
        if (!sidebar || sidebar.dataset.workspaceReady === "true") return;

        sidebar.dataset.workspaceReady = "true";
        window.AIOneSidebar?.configure(sidebar, {
            initialCollapsed: true,
            responsiveRailQuery: "(max-width: 1280px)",
        });

        sidebar.querySelectorAll(".nav-link").forEach((link) => {
            if (link.getAttribute("aria-disabled") === "true") {
                link.addEventListener("click", (event) => event.preventDefault());
            }
        });
    }

    // 상단바 보강
    function enhanceTopbar(host) {
        const actions = host.querySelector(".app-topbar-actions");
        const topbar = host.querySelector(".app-topbar");
        if (!actions || !topbar || topbar.dataset.workspaceReady === "true") return;

        topbar.dataset.workspaceReady = "true";

        const runListButton = actions.querySelector("#runDrawerBtn");
        if (runListButton) {
            runListButton.dataset.sidepopOpen = "workspaceRunListSidepop";
            runListButton.dataset.sidepopVariant = "run-list";
            runListButton.setAttribute("aria-label", "질의분류 목록");
            runListButton.title = "질의분류 목록";
        }
        const titleButton = topbar.querySelector("[data-workspace-title-button]");
        const titleText = topbar.querySelector("[data-workspace-title-text]");
        const titleInput = topbar.querySelector("[data-workspace-title-input]");
        const memberInput = topbar.querySelector("[data-workspace-member-count]");
        // 제목 편집기 닫기
        const closeTitleEditor = (shouldSave) => {
            if (!titleButton || !titleText || !titleInput) return;
            if (titleInput.hidden) return;
            const nextTitle = titleInput.value.trim();
            if (shouldSave && nextTitle) {
                titleText.textContent = nextTitle;
                titleInput.value = nextTitle;
                topbar.dispatchEvent(
                    new CustomEvent("workspace:title-change", {
                        bubbles: true,
                        detail: { title: nextTitle },
                    }),
                );
            } else {
                titleInput.value = titleText.textContent;
            }
            titleInput.hidden = true;
            titleButton.hidden = false;
            titleButton.focus();
        };

        titleButton?.addEventListener("click", () => {
            titleInput.value = titleText.textContent.trim();
            titleButton.hidden = true;
            titleInput.hidden = false;
            titleInput.focus();
            titleInput.select();
        });
        titleInput?.addEventListener("blur", () => closeTitleEditor(true));
        titleInput?.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                closeTitleEditor(true);
            }
            if (event.key === "Escape") {
                event.preventDefault();
                closeTitleEditor(false);
            }
        });
        memberInput?.addEventListener("input", () => {
            const memberCount = Math.min(999, Math.max(0, Number(memberInput.value) || 0));
            memberInput.value = String(memberCount);
            syncUploadSummary();
            topbar.dispatchEvent(
                new CustomEvent("workspace:member-count-change", {
                    bubbles: true,
                    detail: { memberCount },
                }),
            );
        });

        hydrateIcons(topbar);
    }

    // 워크스페이스 실행 목록 초기화
    function initWorkspaceRunList() {
        const sidepop = document.querySelector("#workspaceRunListSidepop");
        const list = sidepop?.querySelector("[data-workspace-run-list]");
        const searchInput = sidepop?.querySelector("[data-workspace-run-search]");
        const sortSelect = sidepop?.querySelector("[data-workspace-run-sort]");
        const total = sidepop?.querySelector("[data-workspace-run-total]");
        if (!sidepop || !list || sidepop.dataset.workspaceRunListReady === "true") return;

        sidepop.dataset.workspaceRunListReady = "true";

        // 실행 항목 조회
        const getRunItems = () => Array.from(list.children).filter((item) => item.matches(".drawer-run-item"));
        // 실행 항목 본문 조회
        const getRunMain = (item) => item?.querySelector(":scope > .drawer-run-main");
        // 실행 제목 조회
        const getRunTitle = (item) => item?.querySelector(".drawer-run-title")?.textContent.replace(/\s+/g, " ").trim() || "선택한 질의분류";
        const readRunNumber = (item, selector) => Number((item.querySelector(selector)?.textContent || "").match(/\d+/)?.[0]) || 0;
        const readRunData = (item) => {
            const [date = "", time = ""] = (item.querySelector(".drawer-run-meta span")?.textContent.trim() || "").split(/\s+/);
            return {
                id: Number(item.dataset.workspaceRunId),
                title: getRunTitle(item),
                status: item.querySelector(".drawer-run-state")?.classList.contains("pending") ? "pending" : "done",
                date,
                time,
                fileCount: readRunNumber(item, "[data-run-file-count], .drawer-run-badges .drawer-run-badge:nth-child(1)"),
                memberCount: readRunNumber(item, "[data-run-member-count], .drawer-run-badges .drawer-run-badge:nth-child(2)"),
                queryCount: readRunNumber(item, "[data-run-query-count], .drawer-run-badges .drawer-run-badge:nth-child(3)"),
                pinned: item.dataset.pinned === "true",
            };
        };
        workspaceRunListItems.splice(0, workspaceRunListItems.length, ...getRunItems().map(readRunData));
        activeWorkspaceRunId = Number(getRunItems().find((item) => item.classList.contains("is-active"))?.dataset.workspaceRunId) || workspaceRunListItems[0]?.id || null;
        const authoredRunItems = new Map(getRunItems().map((item) => [Number(item.dataset.workspaceRunId), item]));

        // 실행 선택
        const selectRun = (selectedItem, { focus = false, notify = false } = {}) => {
            const items = getRunItems();
            if (!items.includes(selectedItem)) return;

            activeWorkspaceRunId = Number(selectedItem.dataset.workspaceRunId);

            items.forEach((item) => {
                const isActive = item === selectedItem;
                const main = getRunMain(item);
                item.classList.toggle("is-active", isActive);
                if (isActive) item.setAttribute("aria-current", "true");
                else item.removeAttribute("aria-current");
                if (!main) return;

                main.setAttribute("role", "button");
                main.setAttribute("aria-label", `${getRunTitle(item)} 세션 불러오기`);
                main.setAttribute("aria-pressed", String(isActive));
                main.tabIndex = isActive ? 0 : -1;
            });

            if (focus) getRunMain(selectedItem)?.focus({ preventScroll: true });
            if (notify) showToast(`"${getRunTitle(selectedItem)}" 세션을 불러왔습니다.`);
        };

        // 실행 목록 렌더링
        const renderRunList = () => {
            const searchTerm = searchInput?.value.trim().toLocaleLowerCase("ko-KR") || "";
            const sortOrder = sortSelect?.value === "oldest" ? "oldest" : "latest";
            const visibleRuns = workspaceRunListItems
                .filter((run) => !searchTerm || `${run.title} ${run.date} ${run.time}`.toLocaleLowerCase("ko-KR").includes(searchTerm))
                .sort((left, right) => {
                    const pinnedDifference = Number(Boolean(right.pinned)) - Number(Boolean(left.pinned));
                    if (pinnedDifference) return pinnedDifference;
                    const leftDate = `${left.date} ${left.time}`;
                    const rightDate = `${right.date} ${right.time}`;
                    return sortOrder === "oldest" ? leftDate.localeCompare(rightDate) : rightDate.localeCompare(leftDate);
                });

            if (total) total.textContent = `${workspaceRunListItems.length}건`;
            if (!visibleRuns.length) {
                const empty = cloneWorkspacePrototype("workspaceRunEmptyPrototype");
                list.replaceChildren(...(empty ? [empty] : []));
                return;
            }

            list.replaceChildren(...visibleRuns.map((run) => authoredRunItems.get(run.id)).filter(Boolean));
            window.AIOneSidePop?.initListActionMenus(list);
            const activeItem = getRunItems().find((item) => Number(item.dataset.workspaceRunId) === activeWorkspaceRunId);
            if (activeItem) selectRun(activeItem);
        };

        renderRunList();

        searchInput?.addEventListener("input", renderRunList);
        sortSelect?.addEventListener("change", renderRunList);

        list.addEventListener("click", (event) => {
            if (event.target.closest(".btn-more, .drawer-list-action")) return;
            const item = event.target.closest(".drawer-run-item");
            if (item) selectRun(item, { notify: true });
        });

        list.addEventListener("keydown", (event) => {
            const main = event.target.closest(".drawer-run-main");
            const item = main?.closest(".drawer-run-item");
            if (!item || !["Enter", " "].includes(event.key)) return;

            event.preventDefault();
            selectRun(item, { focus: true, notify: true });
        });

        sidepop.addEventListener("sidepop:run-action", (event) => {
            const { action, completed, item, title, pinned } = event.detail || {};
            const runId = Number(item?.dataset.workspaceRunId);
            const run = workspaceRunListItems.find((candidate) => candidate.id === runId);
            if (!completed || !run) return;

            if (action === "rename") run.title = title;
            if (action === "pin") run.pinned = Boolean(pinned);
            if (action !== "delete") return;

            workspaceRunListItems.splice(workspaceRunListItems.indexOf(run), 1);
            if (activeWorkspaceRunId === runId) activeWorkspaceRunId = workspaceRunListItems[0]?.id ?? null;
            queueMicrotask(renderRunList);
            showToast("실행 건이 삭제되었습니다.");
        });
    }

    /* ============================ 끝: 9월 이후 알림 담당자와 라우팅 ============================== */

    /* ============================ 시작: 파일 업로드와 목록 ============================ */

    // 파일 업로드 기능 초기화
    // 질의 분석 결과 패널의 스켈레톤을 제거합니다.
    function hideWorkspaceSkeleton() {
        document.querySelectorAll(".workspace-api-skeleton").forEach((overlay) => overlay.remove());
        document.querySelectorAll('[data-workspace-skeleton-busy="true"]').forEach((panel) => {
            panel.removeAttribute("aria-busy");
            delete panel.dataset.workspaceSkeletonBusy;
        });
    }

    // 진행 중인 스켈레톤 작업을 취소하고 화면을 원래 상태로 복원합니다.
    function cancelWorkspaceSkeleton() {
        if (workspaceSkeletonTimer !== null) {
            window.clearTimeout(workspaceSkeletonTimer);
            workspaceSkeletonTimer = null;
        }
        hideWorkspaceSkeleton();
    }

    // 질의 원문·분류 결과 패널에 페이지 전용 스켈레톤을 표시합니다.
    function showWorkspaceSkeleton(message = "문서를 분석하고 있습니다...") {
        cancelWorkspaceSkeleton();

        const comparisonPanel = document.querySelector(".comparison-panel-area");
        const questionPanel = document.querySelector(".question-panel-area");

        if (comparisonPanel) {
            const overlay = document.createElement("div");
            overlay.className = "api-skeleton-overlay workspace-api-skeleton";
            overlay.setAttribute("role", "status");
            overlay.setAttribute("aria-live", "polite");
            overlay.innerHTML = `
                <div class="skeleton-loading-label"></div>
                <div class="workspace-skeleton-grid">
                    <div class="workspace-skeleton-column">
                        <div class="ai-skeleton skeleton-line md"></div>
                        <div class="ai-skeleton workspace-skeleton-document"></div>
                    </div>
                    <div class="workspace-skeleton-column">
                        <div class="ai-skeleton skeleton-line sm"></div>
                        ${Array.from(
                            { length: 4 },
                            () => `
                                <div class="skeleton-card">
                                    <div class="ai-skeleton skeleton-line lg"></div>
                                    <div class="ai-skeleton skeleton-line full"></div>
                                    <div class="ai-skeleton skeleton-line md"></div>
                                </div>`,
                        ).join("")}
                    </div>
                </div>`;
            overlay.querySelector(".skeleton-loading-label").textContent = message;
            comparisonPanel.dataset.workspaceSkeletonBusy = "true";
            comparisonPanel.setAttribute("aria-busy", "true");
            comparisonPanel.append(overlay);
        }

        if (questionPanel) {
            const overlay = document.createElement("div");
            overlay.className = "api-skeleton-overlay workspace-api-skeleton";
            overlay.setAttribute("role", "status");
            overlay.setAttribute("aria-live", "polite");
            overlay.innerHTML = `
                <div class="skeleton-loading-label">분류 결과를 불러오고 있습니다...</div>
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
                ).join("")}`;
            questionPanel.dataset.workspaceSkeletonBusy = "true";
            questionPanel.setAttribute("aria-busy", "true");
            questionPanel.append(overlay);
        }
    }

    // 프로토타입 분석 지연이 끝나면 스켈레톤을 닫고 완료 동작을 실행합니다.
    function finishWorkspaceSkeleton(delay, onComplete) {
        workspaceSkeletonTimer = window.setTimeout(() => {
            workspaceSkeletonTimer = null;
            hideWorkspaceSkeleton();
            onComplete?.();
        }, delay);
    }

    function initFileUpload(host) {
        const zone = host.querySelector("[data-file-upload-zone]");
        if (!zone || zone.dataset.workspaceReady === "true") return;

        zone.dataset.workspaceReady = "true";
        zone.setAttribute("aria-label", "여기에 파일을 드롭하거나 클릭하여 업로드");
        zone.title = "허용 확장자: PDF, HWP, HWPX, DOCX, TXT, PNG, JPG, JPEG";
        zone.addEventListener("app:file-upload", (event) => {
            const files = Array.from(event.detail?.files || []);
            files.forEach(addWorkspaceFileItem);
            const count = files.length;
            if (count) {
                document.body.classList.remove("is-new-workspace");
                document.querySelectorAll("[data-workspace-empty]").forEach((emptyState) => {
                    emptyState.hidden = true;
                });
                syncUploadSummary();
                showWorkspaceSkeleton("OCR·파싱 및 질의 분류 결과를 불러오고 있습니다...");
                finishWorkspaceSkeleton(1500, () => showToast("AI 분석 및 추천실국 분류가 완료되었습니다."));
            }
            if (count) showToast(`${count}개 파일이 업로드되었습니다. AI 분석을 시작합니다.`);
        });
    }

    // 워크스페이스 파일 항목 동작 처리
    function workspaceFileItems(list = document.querySelector(".workspace-file-list")) {
        return Array.from(list?.querySelectorAll(":scope > li[data-file-idx]") || []);
    }

    // 워크스페이스 파일 Indexes 동기화
    function syncWorkspaceFileIndexes(list = document.querySelector(".workspace-file-list")) {
        if (!list) return;
        const items = workspaceFileItems(list);
        items.forEach((item, index) => {
            if (!Number.isFinite(Number(item.dataset.fileInitialIndex))) {
                item.dataset.fileInitialIndex = String(index);
            }
        });
        items
            .slice()
            .sort((a, b) => Number(a.dataset.fileInitialIndex) - Number(b.dataset.fileInitialIndex))
            .forEach((item, index) => {
                const fileIndex = item.querySelector(".file-index");
                if (fileIndex) fileIndex.textContent = String(items.length - index);
            });
    }

    // 파일 Size Label 동작 처리
    function fileSizeLabel(size) {
        const bytes = Number(size) || 0;
        if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }

    // 파일 확장자 조회
    function fileExtension(fileName) {
        const extension = String(fileName || "")
            .split(".")
            .pop()
            ?.toLowerCase();
        return ["pdf", "hwp", "docx", "txt"].includes(extension) ? extension : "file";
    }

    // 워크스페이스 파일 질의 개수 조회
    function getWorkspaceFileQueryCount(file) {
        const savedQueries = workspaceSampleData.fileData[file?.name]?.queries;
        if (savedQueries?.length) return savedQueries.length;
        const fileItem = Array.from(document.querySelectorAll(".workspace-file-list > li[data-file-idx]")).find((item) => item.dataset.fileKey === file?.name);
        const authoredCount = Number((fileItem?.querySelector(".query-count")?.textContent || "").match(/\d+/)?.[0]) || Number(file?.queryCount);
        if (authoredCount) return authoredCount;
        return Math.max(1, Math.round((Number(file?.chunks) || 3) * 0.55));
    }

    // 워크스페이스 파일 질의 시작 위치 조회
    function getWorkspaceFileQueryStart(file) {
        const fileIndex = workspaceSampleData.files.findIndex((item) => item.name === file?.name);
        const previousFiles = fileIndex >= 0 ? workspaceSampleData.files.slice(0, fileIndex) : workspaceSampleData.files;
        return previousFiles.reduce((total, item) => total + getWorkspaceFileQueryCount(item), 0) + 1;
    }

    // 워크스페이스 파일 분류 사유 조회
    function getWorkspaceClassificationReason(query) {
        const reasons = {
            single: [
                `"${query.mainDept}" 소관 업무 키워드 매칭 (유사 질의 ${Math.floor(query.confidence * 0.8)}건 분석)`,
                `과거 답변 이력 기반 "${query.mainDept}" 단일소관 판정`,
                `질의 내용의 핵심 키워드가 "${query.mainDept}" 업무 범위에 집중`,
            ],
            multi: [`"${query.mainDept}" 주관 + "${query.coopDept}" 관련 키워드 동시 감지`, `복수 부서 업무영역에 걸친 복합 질의로 판단 (유사도 ${query.confidence}%)`, `주관 "${query.mainDept}" 확인, 협조 필요 근거: 관련 법령 교차 참조`],
            none: [`본 부처 소관 키워드 미감지. "${query.org}" 소관으로 추정`, `질의 내용이 타 부처 업무영역에 해당 (비소관 판정 신뢰도 ${query.confidence}%)`],
        };
        const pool = reasons[query.type] || reasons.single;
        return pool[query.id % pool.length];
    }

    // 워크스페이스 추천 부서 조회
    function getWorkspaceRecommendOffice(query) {
        if (query.type === "none") return query.org || "해당없음";
        const officeMap = {
            경제정책국: "경제정책국 · 거시경제심의관/종합정책과",
            민생경제국: "민생경제국 · 민생경제총괄과/물가정책과",
            경제구조개혁국: "경제구조개혁국 · 경제구조개혁총괄과/청년정책과",
            혁신성장실: "혁신성장실 · 정책조정관/전략경제정책관",
            세제실: "세제실 · 조세총괄정책관",
            초혁신경제추진단: "초혁신경제추진단 · 기획총괄과",
            조세개혁추진단: "조세개혁추진단 · 총괄기획팀",
            수출플러스지원단: "수출플러스지원단 · 총괄기획팀",
            정책금융기획관: "정책금융기획관",
            기획조정실: "기획조정실 · 정책기획관",
            국고실: "국고실 · 국고정책관/국채정책과",
            국제금융국: "국제금융국 · 국제금융심의관/외환제도과",
            국제경제관리관: "국제경제관리관",
            대외경제국: "대외경제국 · 대외경제심의관",
            개발금융국: "개발금융국 · 개발금융총괄과",
            공공정책국: "공공정책국 · 공공혁신심의관",
            해당없음: "비소관",
        };
        return officeMap[query.mainDept] || query.mainDept;
    }

    // 대체 워크스페이스 파일 데이터 생성
    function createFallbackWorkspaceFileData(file, firstQueryId) {
        const subject = String(file?.name || "업로드 질의")
            .replace(/\.[^.]+$/, "")
            .replaceAll("_", " ");
        const count = getWorkspaceFileQueryCount(file);
        const committee = String(file?.displayName || "").startsWith("예결위") ? "예산결산특별위원회" : "기획재정위원회";
        const memberName = String(file?.displayName || "").match(/_([^_]+의원)\.[^.]+$/)?.[1] || "국회 위원 (인)";
        const mainDept = /세|법인|부동산/.test(subject) ? "세제실" : /외국환|금융/.test(subject) ? "국제금융국" : /공공기관|국유재산|국고/.test(subject) ? "공공정책국" : "경제정책국";
        const queries = Array.from({ length: count }, (_, queryIndex) => {
            const type = queryIndex % 3 === 2 ? "multi" : "single";
            const text = `${subject} 관련 ${queryIndex + 1}차 현황과 주요 쟁점에 대한 자료 및 검토 의견 요청`;
            return {
                id: firstQueryId + queryIndex,
                text,
                summary: `${subject} 관련 현황과 주요 쟁점, 향후 대응 방향을 확인하는 질의`,
                type,
                typeLabel: type === "multi" ? "복수소관" : "단일소관",
                mainDept,
                coopDept: type === "multi" ? "경제정책국" : "",
                org: "재정경제부",
                confidence: Math.max(78, 93 - queryIndex * 2),
                keywords: subject.split(" ").slice(0, 2),
            };
        });

        return {
            meta: {
                ...workspaceSampleData.defaultMeta,
                committee,
                memberName,
                partyName: "국회",
            },
            queries,
        };
    }

    // 워크스페이스 파일 데이터 조회
    function getWorkspaceFileData(file) {
        const firstQueryId = getWorkspaceFileQueryStart(file);
        const savedData = workspaceSampleData.fileData[file?.name];
        if (!savedData) return createFallbackWorkspaceFileData(file, firstQueryId);

        return {
            ...savedData,
            queries: savedData.queries.map((query, index) => ({
                ...query,
                id: savedData.preserveQueryIds ? query.id : firstQueryId + index,
            })),
        };
    }

    // 워크스페이스 Excel 다운로드
    function downloadWorkspaceExcel() {
        const now = new Date();
        // Date 변환
        const formatDate = (separator) => [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join(separator);
        // Member Name 정규화
        const normalizeMemberName = (value) =>
            String(value || "")
                .replace(/\s*\(인\)\s*/g, "")
                .replace(/\s+/g, " ")
                .trim();
        // Deadline 추출
        const extractDeadline = (value) => {
            const match = String(value || "").match(/(\d{4})[년.\-/]\s*(\d{1,2})[월.\-/]\s*(\d{1,2})일?/);
            return match ? [match[1], match[2].padStart(2, "0"), match[3].padStart(2, "0")].join(".") : "";
        };
        // CSV 셀 변환
        const csvCell = (value) => {
            const text = value === null || value === undefined || String(value).trim() === "" ? "NULL" : String(value).trim();
            return `"${text.replace(/\r?\n/g, " ").replace(/"/g, '""')}"`;
        };

        const activeFile = workspaceSampleData.files.find((file) => file.name === activeWorkspaceFileName) || { name: activeWorkspaceFileName || "질의목록" };
        const activeFileData = getWorkspaceFileData(activeFile);
        const meta = { ...workspaceSampleData.defaultMeta, ...(activeFileData.meta || {}) };
        const headers = ["실행일", "실행파일명", "실행자", "요구일", "질의의원명", "교섭단체명", "질의ID", "질의번호", "질의명", "담당실국", "협조실국", "제출기한"];
        const rows = workspaceQuestionCards.map((query, index) => [
            formatDate("."),
            activeFile.name,
            "박재정 주무관",
            meta.date || "",
            normalizeMemberName(meta.memberName),
            meta.partyName || "",
            `Q-${now.getFullYear()}-${String(query.id).padStart(4, "0")}`,
            index + 1,
            query.text,
            query.mainDept || "",
            query.coopDept || "",
            extractDeadline(meta.closing),
        ]);
        const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
        const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
        const downloadLink = document.createElement("a");
        downloadLink.href = blobUrl;
        downloadLink.download = `질의목록_추천실국_${formatDate("-")}.csv`;
        downloadLink.hidden = true;
        document.body.append(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
        showToast("질의목록 엑셀 파일이 다운로드되었습니다.");
    }

    // 워크스페이스 파일 항목 생성
    function createWorkspaceFileItem({ file, extension, index, dataIndex, initialIndex, statusText, final = false }) {
        const item = cloneWorkspacePrototype("workspaceFileItemPrototype");
        if (!item) return null;
        const displayName = file.displayName || file.name || `업로드 파일 ${index}`;
        item.dataset.fileIdx = String(dataIndex);
        item.dataset.fileInitialIndex = String(initialIndex);
        item.dataset.fileKey = file.name || displayName;
        item.querySelector(".file-item-main").setAttribute("aria-label", final ? `업로드 순서 ${index}번, ${displayName} 파일 보기` : `${displayName} 파일 보기`);
        item.querySelector(".file-index").textContent = String(index);
        item.querySelector(".file-type-dot").classList.add(extension);
        const collapsedIcon = item.querySelector(".file-icon-collapsed");
        collapsedIcon.classList.add(extension);
        collapsedIcon.textContent = extension === "file" ? "FILE" : extension.toUpperCase();
        const name = item.querySelector(".file-name");
        name.textContent = displayName;
        name.title = displayName;
        item.querySelector(".file-meta").textContent = file.size || "";
        const status = item.querySelector("[data-file-status]");
        status.classList.remove("green", "purple");
        status.classList.add(final ? "purple" : "green");
        status.dataset.fileStatus = final ? "query-count" : "waiting";
        status.textContent = statusText;
        return item;
    }

    // 워크스페이스 파일 항목 선택
    function selectWorkspaceFileItem(selectedItem) {
        const list = selectedItem?.closest(".workspace-file-list");
        if (!list) return;

        workspaceFileItems(list).forEach((item) => {
            const selected = item === selectedItem;
            item.classList.toggle("active", selected);
            const button = item.querySelector(".file-item-main");
            if (selected) button?.setAttribute("aria-current", "true");
            else button?.removeAttribute("aria-current");
        });
    }

    // AFTER-9 부분 구현: 이 렌더러는 이미 폼 형태의 소스 레이아웃을 지원하지만,
    // 대체 번호형 문서는 HTML에서 여전히 주석 처리되어 있으며
    // 전용 화면 전환 계약이 없습니다.
    // 원문 질의 제외 라벨 보장
    function ensureWorkspaceExcludedLabel(questionText) {
        let label = questionText?.querySelector(".orig-excluded-label");
        if (!label && questionText) {
            label = document.createElement("span");
            label.className = "orig-excluded-label";
            label.textContent = "제외됨";
            questionText.append(label);
        }
        return label;
    }

    // 워크스페이스 원문 문서 렌더링
    function renderWorkspaceOriginalDocument(fileData) {
        const meta = { ...workspaceSampleData.defaultMeta, ...(fileData.meta || {}) };
        const page = document.querySelector(".comparison-panel-area .orig-page");
        const boxes = page?.querySelector(".orig-query-boxes");
        if (!page || !boxes) return;
        const isSubmissionVersion = page.classList.contains("orig-page-submission");
        page.querySelector(".orig-form-title")?.replaceChildren(meta.formTitle || "질 의 요 지 서");
        page.querySelector(".orig-form-date")?.replaceChildren(meta.date || "2026. 03. 15");
        page.querySelector(".orig-form-committee")?.replaceChildren(meta.committee || "기획재정위원회");
        const infoValues = page.querySelectorAll(".orig-form-info-value");
        infoValues[0]?.replaceChildren(meta.memberName || "국회 위원 (인)");
        infoValues[1]?.replaceChildren(meta.partyName || "국회");

        const groups = fileData.queries
            .map((query, index) => {
                const group = cloneWorkspacePrototype("workspaceOriginalQuestionPrototype");
                if (!group) return null;
                const box = group.querySelector(".orig-query-box");
                box.classList.toggle("active", index === 0);
                box.classList.toggle("excluded", Boolean(query.excluded));
                box.setAttribute("aria-label", `질의 ${index + 1} 원문 보기`);
                box.dataset.questionIndex = String(query.id);
                box.dataset.original = query.text;
                box.dataset.summary = query.summary || query.text;
                box.dataset.confidence = String(query.confidence);
                const number = box.querySelector(".orig-query-num");
                number.classList.toggle("hidden", isSubmissionVersion);
                number.textContent = String(index + 1);
                const text = box.querySelector(".orig-query-box-text");
                const excludedLabel = ensureWorkspaceExcludedLabel(text);
                if (excludedLabel) excludedLabel.hidden = query.excluded !== true;
                text.replaceChildren(query.text, excludedLabel || "");
                return group;
            })
            .filter(Boolean);
        boxes.replaceChildren(...groups);
    }

    // 워크스페이스 원문 Exclusion 동기화
    function syncWorkspaceOriginalExclusion(query) {
        if (!query) return;
        const originalQuestion = document.querySelector(`${questionSelector}[data-question-index="${query.id}"]`);
        if (!originalQuestion) return;

        originalQuestion.classList.toggle("excluded", query.excluded === true);
        const questionText = originalQuestion.querySelector(".orig-query-box-text");
        if (!questionText) return;
        const label = ensureWorkspaceExcludedLabel(questionText);
        if (label) label.hidden = query.excluded !== true;
    }

    // 워크스페이스 상세 Exclusion 동기화
    function syncWorkspaceDetailExclusion(query) {
        if (!query) return;
        const excluded = query.excluded === true;
        const stateChip = document.querySelector("[data-result-state-chip]");
        const stateText = document.querySelector("[data-result-state-text]");
        const excludeButton = document.querySelector("[data-detail-exclude]");

        stateChip?.classList.toggle("excluded", excluded);
        stateChip?.replaceChildren(excluded ? "제외됨" : "분류 대상");
        stateText?.replaceChildren(excluded ? "처리 대상에서 제외되었습니다." : "필요 없는 질의는 제외할 수 있습니다.");
        if (excludeButton) {
            excludeButton.dataset.queryId = String(query.id);
            excludeButton.classList.toggle("restore", excluded);
            excludeButton.textContent = excluded ? "복구" : "제외";
            excludeButton.setAttribute("aria-label", excluded ? "선택한 질의 복구" : "선택한 질의 제외");
        }
    }

    // 워크스페이스 질의 카드 동기화
    function syncWorkspaceQueryCard(query) {
        const card = document.querySelector(`[data-query-card-list] > .query-card[data-qid="${query?.id}"]`);
        if (!card || !query) return;

        const type = ["single", "multi", "none"].includes(query.type) ? query.type : "single";
        const confidence = Math.min(100, Math.max(0, Number(query.confidence) || 0));
        const excluded = query.excluded === true;
        const typeLabels = { single: "단일소관", multi: "복수소관", none: "비소관" };

        card.dataset.type = type;
        card.dataset.scope = type;
        card.dataset.excluded = String(excluded);
        card.classList.toggle("needs-review", confidence < 80);
        card.classList.toggle("excluded", excluded);
        card.setAttribute("aria-label", `질의 Q${query.id}: ${query.text || ""}`);

        const number = card.querySelector(".query-num");
        number?.classList.remove("single", "multi", "none");
        number?.classList.add(type);

        const typeBadge = card.querySelector("[data-query-type]");
        typeBadge?.classList.remove("single", "multi", "none");
        typeBadge?.classList.add(type);
        typeBadge?.replaceChildren(typeLabels[type]);
        card.querySelector(".query-text")?.replaceChildren(query.text || "");
        card.querySelector(".ai-reason-text")?.replaceChildren(query.reason || getWorkspaceClassificationReason(query));

        const reviewBadge = card.querySelector("[data-query-review]");
        if (reviewBadge) reviewBadge.hidden = confidence >= 80;
        const excludeButton = card.querySelector(".query-exclude-btn");
        if (excludeButton) {
            excludeButton.dataset.qid = String(query.id);
            excludeButton.classList.toggle("restore", excluded);
            excludeButton.textContent = excluded ? "복구" : "제외";
            excludeButton.setAttribute("aria-label", `질의 Q${query.id} ${excluded ? "복구" : "제외"}`);
        }
        const editButton = card.querySelector(".query-edit-btn");
        if (editButton) editButton.hidden = excluded;

        const progressbar = card.querySelector("[data-progressbar]");
        if (progressbar) {
            progressbar.dataset.value = String(confidence);
            progressbar.setAttribute("aria-label", `신뢰도 ${Math.round(confidence)}%`);
            progressbar.setAttribute("aria-valuenow", String(confidence));
            window.AIOneProgressBar?.setValue(progressbar, confidence);
        }
        card.querySelector(".confidence-value")?.replaceChildren(`${Math.round(confidence)}%`);
    }

    // 워크스페이스 질의 상태 저장
    function persistWorkspaceQueryState(query) {
        const savedData = workspaceSampleData.fileData[activeWorkspaceFileName];
        if (!savedData || !query) return;
        const cardIndex = workspaceQuestionCards.findIndex((item) => String(item.id) === String(query.id));
        const savedQuery = savedData.queries.find((item) => String(item.id) === String(query.id)) || savedData.queries[cardIndex];
        if (savedQuery) savedQuery.excluded = query.excluded === true;
    }

    // 워크스페이스 질의 Excluded 설정
    function setWorkspaceQueryExcluded(query, excluded) {
        if (!query) return;
        const wasSelected = query.selected === true;
        query.excluded = excluded === true;
        persistWorkspaceQueryState(query);
        syncWorkspaceOriginalExclusion(query);
        syncWorkspaceQueryCard(query);
        syncWorkspaceQuestionCounts();

        const excludedCount = workspaceQuestionCards.filter((item) => item.excluded).length;
        let nextSelectedQuery = null;
        if (query.excluded && currentQuestionFilter !== "excluded" && wasSelected) {
            const queryIndex = workspaceQuestionCards.indexOf(query);
            nextSelectedQuery = workspaceQuestionCards.slice(queryIndex + 1).find((item) => !item.excluded)
                || workspaceQuestionCards.slice(0, queryIndex).reverse().find((item) => !item.excluded)
                || null;
        }

        if (!query.excluded && currentQuestionFilter === "excluded" && excludedCount === 0) {
            filterQuestions("all");
            nextSelectedQuery = query;
        } else {
            filterQuestions(currentQuestionFilter);
        }

        if (nextSelectedQuery) {
            const nextQuestion = document.querySelector(`${questionSelector}[data-question-index="${nextSelectedQuery.id}"]`);
            if (nextQuestion) selectQuestion(nextQuestion);
        } else if (query.selected) {
            syncWorkspaceDetailExclusion(query);
        }
        showToast(query.excluded ? "질의를 제외했습니다. 제외 목록에서 다시 복구할 수 있습니다." : "질의를 복구했습니다.");
    }

    /* ============================ 시작: 9월 이후 질의 제외 확인 ============================ */

    // QueryCard 제외/복구 팝업 준비
    function prepareWorkspaceQueryExclusion(trigger) {
        const query = workspaceQuestionCards.find((item) => String(item.id) === String(trigger?.dataset.qid));
        const modal = document.getElementById("workspaceQueryDeleteModal");
        if (!query || !modal) {
            after9Workspace.state.pendingQueryExclusion = null;
            return;
        }

        const nextExcluded = !query.excluded;
        after9Workspace.state.pendingQueryExclusion = {
            queryId: String(query.id),
            nextExcluded,
        };

        modal.querySelector("[data-query-exclusion-title]")?.replaceChildren(nextExcluded ? "질의를 제외할까요?" : "질의를 복구할까요?");
        modal.querySelector("[data-query-exclusion-description]")?.replaceChildren(
            nextExcluded ? "제외한 질의는 제외 목록에서 다시 복구할 수 있습니다." : "선택한 질의를 다시 분류 대상에 포함합니다.",
        );

        const confirmButton = modal.querySelector('[data-workspace-confirm="query-exclusion"]');
        confirmButton?.classList.toggle("danger", nextExcluded);
        confirmButton?.replaceChildren(nextExcluded ? "제외" : "복구");
    }

    // QueryCard 제외/복구 팝업 확인
    function confirmWorkspaceQueryExclusion() {
        const pending = after9Workspace.state.pendingQueryExclusion;
        const query = workspaceQuestionCards.find((item) => String(item.id) === pending?.queryId);
        if (!pending || !query) return;

        after9Workspace.state.pendingQueryExclusion = null;
        setWorkspaceQueryExcluded(query, pending.nextExcluded);
        window.AIOneModal?.close("#workspaceQueryDeleteModal");
    }

    /* ============================ 끝: 9월 이후 질의 제외 확인 ============================== */

    // 워크스페이스 질문 개수 동기화
    function syncWorkspaceQuestionCounts() {
        const counts = workspaceQuestionCards.reduce(
            (result, query) => {
                if (query.excluded) {
                    result.excluded += 1;
                    return result;
                }
                result.all += 1;
                result[query.type] = (result[query.type] || 0) + 1;
                return result;
            },
            { all: 0, single: 0, multi: 0, none: 0, excluded: 0 },
        );
        document.querySelectorAll(".filter-btn[data-filter]").forEach((button) => {
            button.querySelector(".filter-count")?.replaceChildren(String(counts[button.dataset.filter] || 0));
        });
    }

    // 워크스페이스 파일 활성화
    function activateWorkspaceFile(fileName) {
        const file = workspaceSampleData.files.find((item) => item.name === fileName) || { name: fileName, displayName: fileName, chunks: 3 };
        const fileData = getWorkspaceFileData(file);
        activeWorkspaceFileName = file.name;
        after9Workspace.state.confirmedQuestions = [];
        workspaceQuestionCards = fileData.queries.map((query, index) => ({
            ...query,
            reason: query.reason || getWorkspaceClassificationReason(query),
            selected: index === 0,
        }));

        const selectedItem = Array.from(document.querySelectorAll(".workspace-file-list li[data-file-idx]")).find((item) => item.dataset.fileKey === file.name);
        selectWorkspaceFileItem(selectedItem);
        document.querySelector("[data-active-file-name]")?.replaceChildren(file.name);
        document.querySelector("[data-extract-count]")?.replaceChildren(String(workspaceQuestionCards.length));
        document.querySelector(".doc-detail-counter")?.replaceChildren(`문장 1 / ${workspaceQuestionCards.length} 선택됨`);
        document.querySelector("[data-character-count]")?.replaceChildren(String(workspaceQuestionCards.reduce((total, query) => total + query.text.length, 0)));
        document.querySelector("[data-page-count]")?.replaceChildren("1/1");

        renderWorkspaceOriginalDocument(fileData);
        renderQuestionCards();
        syncWorkspaceQuestionCounts();
        filterQuestions("all");
        setQuestionConfirmationState(false);
        const firstQuestion = document.querySelector(questionSelector);
        if (firstQuestion) selectQuestion(firstQuestion);
    }

    // 다음 워크스페이스 파일 번호 계산
    function nextWorkspaceFileNumber(list, selector, fallback) {
        const values = Array.from(list.querySelectorAll(selector))
            .map((element) => Number(element.dataset.fileIdx ?? element.textContent))
            .filter(Number.isFinite);
        return values.length ? Math.max(...values) + 1 : fallback;
    }

    // 워크스페이스 파일 항목 추가
    function addWorkspaceFileItem(file) {
        const list = document.querySelector(".workspace-file-list");
        if (!list || !file) return;

        const extension = fileExtension(file.name);
        const dataIndex = nextWorkspaceFileNumber(list, ":scope > li[data-file-idx]", 0);
        const displayIndex = workspaceFileItems(list).length + 1;
        const initialIndexes = workspaceFileItems(list)
            .map((item) => Number(item.dataset.fileInitialIndex))
            .filter(Number.isFinite);
        const item = createWorkspaceFileItem({
            file: { ...file, size: fileSizeLabel(file.size) },
            extension,
            index: displayIndex,
            dataIndex,
            initialIndex: initialIndexes.length ? Math.min(...initialIndexes) - 1 : 0,
            statusText: "분석 대기",
        });
        if (!item) return;
        list.append(item);
        initFileActionMenus(list);
        sortFileItems(list);
        hydrateIcons(item);
    }

    // 업로드 Summary 동기화
    function syncUploadSummary() {
        const list = document.querySelector(".workspace-file-list");
        if (!list) return;

        const items = workspaceFileItems(list);
        syncWorkspaceFileIndexes(list);
        const fileCount = items.length;
        const memberInput = document.querySelector("[data-workspace-member-count]");
        const memberCount = Math.min(999, Math.max(0, Number(memberInput?.value) || 0));

        document.querySelectorAll(".upload-summary-file-count").forEach((element) => {
            element.textContent = String(fileCount);
        });
        document.querySelectorAll(".upload-summary-member-count").forEach((element) => {
            element.textContent = String(memberCount);
        });

        const summary = document.querySelector("[data-upload-summary-message]");
        if (summary) {
            summary.textContent = fileCount > 0 ? `${fileCount}건 질의 확인` : "입수 대기";
        }

        const footer = document.querySelector(".upload-summary-footer");
        footer?.setAttribute("aria-label", `입수 현황: 파일 ${fileCount}, 의원 ${memberCount}`);
        const emptyList = document.querySelector(".workspace-file-empty-list");
        if (emptyList) emptyList.hidden = fileCount > 0;
        list.classList.toggle("hidden", fileCount === 0);
    }

    // observe 워크스페이스 파일 목록 동작 처리
    function observeWorkspaceFileList(root = document) {
        const list = root.querySelector?.(".workspace-file-list") || (root.matches?.(".workspace-file-list") ? root : null);
        if (!list || list.dataset.summaryReady === "true") return;

        if (!workspaceInitialFileItems) {
            workspaceInitialFileItems = workspaceFileItems(list).map((item) => item.cloneNode(true));
        }
        new MutationObserver(syncUploadSummary).observe(list, { childList: true });
        list.dataset.summaryReady = "true";
        syncUploadSummary();
    }

    /* ============================ 끝: 파일 업로드와 목록 ============================== */

    /* ============================ 시작: 패널 배치 ============================ */

    // 패널 조회
    function getPanels(container) {
        return Array.from(container?.children || []).filter((element) => element.matches(".panel[data-slot]"));
    }

    // 패널 핸들 조회
    function getPanelHandles(container) {
        return Array.from(container?.children || []).filter((element) => element.classList.contains("panel-resize-handle"));
    }

    // 패널 너비 읽기
    function readPanelWidths(container) {
        return new Map(getPanels(container).map((panel) => [panel, Math.round(panel.getBoundingClientRect().width)]));
    }

    // 펼쳐진 패널별 최소 너비 조회
    function getExpandedPanelMinimum(panel) {
        return panelMinWidths[panel?.dataset.slot] || panelMinWidth;
    }

    // 패널별 최소 너비 조회
    function getPanelMinimum(panel) {
        if (panel?.classList.contains("panel-collapsed")) return 44;
        return getExpandedPanelMinimum(panel);
    }

    // 패널 Columns 생성
    function createPanelColumns(panels, widths) {
        return panels
            .flatMap((panel, index) => {
                const track = panel.dataset.slot === "center" ? "minmax(0, 1fr)" : `${Math.round(widths.get(panel))}px`;
                return index < panels.length - 1 ? [track, `${panelHandleWidth}px`] : [track];
            })
            .join(" ");
    }

    // 패널 Handle Aria 동기화
    function syncPanelHandleAria(container) {
        const panels = getPanels(container);
        const handles = getPanelHandles(container);
        handles.forEach((handle, index) => {
            const leftPanel = panels[index];
            const rightPanel = panels[index + 1];
            if (!leftPanel || !rightPanel) return;

            const leftWidth = Math.round(leftPanel.getBoundingClientRect().width);
            const adjacentWidth = leftWidth + Math.round(rightPanel.getBoundingClientRect().width);
            const leftMinimum = Math.min(getPanelMinimum(leftPanel), Math.floor(adjacentWidth / 2));
            const rightMinimum = Math.min(getPanelMinimum(rightPanel), Math.floor(adjacentWidth / 2));
            handle.setAttribute("aria-valuemin", String(leftMinimum));
            handle.setAttribute("aria-valuemax", String(Math.max(leftMinimum, adjacentWidth - rightMinimum)));
            handle.setAttribute("aria-valuenow", String(leftWidth));
        });
    }

    // 패널 너비 적용
    function applyPanelWidths(container, widths) {
        const panels = getPanels(container);
        if (!panels.length || panels.some((panel) => !Number.isFinite(widths.get(panel)))) return;

        container.style.gridTemplateColumns = createPanelColumns(panels, widths);
        syncPanelHandleAria(container);
    }

    // 패널 접힘 상태 상태 동기화
    function syncPanelCollapsedState(panel, isCollapsed) {
        const collapseButton = panel.querySelector('[data-panel-action="collapse"]');
        const fileListSection = panel.querySelector(".file-list-section");
        panel.classList.toggle("panel-collapsed", isCollapsed);
        fileListSection?.classList.toggle("is-collapsed", isCollapsed);
        if (!collapseButton) return;

        const actionLabel = isCollapsed ? "업로드 패널 펼치기" : "업로드 패널 접기";
        collapseButton.setAttribute("aria-expanded", String(!isCollapsed));
        collapseButton.setAttribute("aria-label", actionLabel);
        collapseButton.title = actionLabel;
    }

    // 패널 접힘 상태 설정
    function setPanelCollapsed(panel, isCollapsed, container) {
        const panels = getPanels(container);
        if (!panels.includes(panel)) return;

        const widths = readPanelWidths(container);
        const currentWidth = widths.get(panel);
        if (!Number.isFinite(currentWidth)) return;

        if (isCollapsed) {
            panel.dataset.panelExpandedWidth = String(currentWidth);
        }

        const expandedWidth = Number(panel.dataset.panelExpandedWidth);
        const shouldOpenAtMinimum = !isCollapsed && window.matchMedia("(min-width: 1025px)").matches;
        const nextWidth = isCollapsed
            ? 44
            : shouldOpenAtMinimum
              ? getExpandedPanelMinimum(panel)
              : Number.isFinite(expandedWidth)
                ? expandedWidth
                : currentWidth;
        const flexiblePanel = panels.find((item) => item !== panel && item.dataset.slot === "center");
        const widthDifference = currentWidth - nextWidth;
        widths.set(panel, nextWidth);

        if (flexiblePanel) {
            const flexibleWidth = widths.get(flexiblePanel);
            const nextFlexibleWidth = flexibleWidth + widthDifference;
            if (nextFlexibleWidth >= panelMinWidth) widths.set(flexiblePanel, nextFlexibleWidth);
        }

        syncPanelCollapsedState(panel, isCollapsed);
        applyPanelWidths(container, widths);
        if (!isCollapsed) delete panel.dataset.panelExpandedWidth;
    }

    // 패널 접기 이벤트 연결
    function bindPanelCollapse(container) {
        getPanels(container).forEach((panel) => {
            const collapseButton = panel.querySelector('[data-panel-action="collapse"]');
            if (collapseButton && collapseButton.dataset.panelCollapseReady !== "true") {
                collapseButton.dataset.panelCollapseReady = "true";
                collapseButton.addEventListener("click", () => {
                    setPanelCollapsed(panel, !panel.classList.contains("panel-collapsed"), container);
                });
            }

            const addButton = panel.querySelector("[data-file-list-add]");
            if (addButton && addButton.dataset.fileListAddReady !== "true") {
                addButton.dataset.fileListAddReady = "true";
                addButton.addEventListener("click", () => {
                    panel.querySelector('input[type="file"]')?.click();
                });
            }
        });
    }

    // rebuild 패널 Order 동작 처리
    function rebuildPanelOrder(container, panels) {
        const handles = getPanelHandles(container);
        container.replaceChildren();
        panels.forEach((panel, index) => {
            container.append(panel);
            if (index < panels.length - 1 && handles[index]) container.append(handles[index]);
        });
    }

    // 패널 이동
    function movePanel(container, panel, targetPanel) {
        const panels = getPanels(container);
        const sourceIndex = panels.indexOf(panel);
        const targetIndex = panels.indexOf(targetPanel);
        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return false;

        clearPanelSwitchSelection(container);
        const widths = readPanelWidths(container);
        panels.splice(sourceIndex, 1);
        panels.splice(targetIndex, 0, panel);
        rebuildPanelOrder(container, panels);
        applyPanelWidths(container, widths);
        return true;
    }

    // 패널 Switch 선택 정리
    function clearPanelSwitchSelection(container) {
        getPanels(container).forEach((panel) => {
            panel.classList.remove("panel-switch-source");
            panel.querySelector('.panel-title[role="button"]')?.setAttribute("aria-pressed", "false");
        });
    }

    // 패널 Positions 교체
    function swapPanelPositions(container, firstPanel, secondPanel) {
        const panels = getPanels(container);
        const firstIndex = panels.indexOf(firstPanel);
        const secondIndex = panels.indexOf(secondPanel);
        if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) return false;

        const widths = readPanelWidths(container);
        [panels[firstIndex], panels[secondIndex]] = [panels[secondIndex], panels[firstIndex]];
        rebuildPanelOrder(container, panels);
        applyPanelWidths(container, widths);
        return true;
    }

    // 패널 레이아웃 순환
    function rotatePanelLayout() {
        const container = document.querySelector('.three-panel[data-workspace-panels-ready="true"]');
        if (!container) return false;

        const panels = getPanels(container);
        if (panels.length < 2) return false;

        clearPanelSwitchSelection(container);
        const widths = readPanelWidths(container);
        panels.push(panels.shift());
        rebuildPanelOrder(container, panels);
        applyPanelWidths(container, widths);
        return true;
    }

    // 패널 레이아웃 초기화
    function resetPanelLayout() {
        const container = document.querySelector('.three-panel[data-workspace-panels-ready="true"]');
        const state = container && panelStates.get(container);
        if (!container || !state) return false;

        clearPanelSwitchSelection(container);
        state.initialOrder.forEach((panel) => {
            panel.classList.remove("drag-over");
            panel.style.removeProperty("opacity");
            syncPanelCollapsedState(panel, false);
            delete panel.dataset.panelExpandedWidth;
        });
        rebuildPanelOrder(container, state.initialOrder);
        container.style.removeProperty("grid-template-columns");
        document.querySelectorAll('[data-component="split-handler"]').forEach((split) => {
            window.AIOneSplitHandler?.reset(split);
        });
        window.requestAnimationFrame(() => syncPanelHandleAria(container));
        return true;
    }

    // AFTER-9 부분 구현: 숨겨진 보조 컨트롤은 common.js가 소유하고, 워크스페이스는
    // 해당 컨트롤에서 전달된 패널 교체/배치 동작만 담당합니다.
    // Accessory 동작 처리
    function handleAccessoryAction(event) {
        if (event.detail?.action === "swap") {
            if (rotatePanelLayout()) showToast("패널 위치가 변경되었습니다.");
        } else if (event.detail?.action === "layout") {
            if (resetPanelLayout()) showToast("레이아웃이 기본값으로 초기화되었습니다.");
        }
    }

    // 패널 드래그 드롭 이벤트 연결
    function bindPanelDragDrop(container) {
        getPanels(container).forEach((panel) => {
            const head = panel.querySelector(".panel-head");
            if (!head) return;

            head.style.cursor = "grab";
            head.style.touchAction = "none";
            head.querySelectorAll("button, input, select, textarea, a, [contenteditable]").forEach((element) => element.setAttribute("draggable", "false"));

            head.addEventListener("pointerdown", (event) => {
                if (event.button !== 0 || event.target.closest("button, input, select, textarea, a, [contenteditable]")) return;

                const pointerId = event.pointerId;
                const startX = event.clientX;
                const startY = event.clientY;
                let isDragging = false;
                let targetPanel = null;

                // 드래그 상태 정리
                const clearDragState = () => {
                    panel.style.removeProperty("opacity");
                    head.style.cursor = "grab";
                    document.body.style.userSelect = "";
                    getPanels(container).forEach((item) => item.classList.remove("drag-over"));
                };

                // on Pointer Move 동작 처리
                const onPointerMove = (moveEvent) => {
                    if (moveEvent.pointerId !== pointerId) return;
                    if (!isDragging && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 6) return;

                    isDragging = true;
                    moveEvent.preventDefault();
                    panel.style.opacity = "0.5";
                    head.style.cursor = "grabbing";
                    document.body.style.userSelect = "none";

                    const hoveredPanel = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest(".panel[data-slot]");
                    targetPanel = hoveredPanel?.parentElement === container && hoveredPanel !== panel ? hoveredPanel : null;
                    getPanels(container).forEach((item) => item.classList.toggle("drag-over", item === targetPanel));
                };

                // on Pointer Up 동작 처리
                const onPointerUp = (upEvent) => {
                    if (upEvent.pointerId !== pointerId) return;
                    document.removeEventListener("pointermove", onPointerMove);
                    document.removeEventListener("pointerup", onPointerUp);
                    document.removeEventListener("pointercancel", onPointerUp);

                    if (isDragging) {
                        head.dataset.suppressPanelSwitchClick = "true";
                        window.setTimeout(() => delete head.dataset.suppressPanelSwitchClick, 0);
                    }
                    const dropTarget = targetPanel;
                    clearDragState();
                    if (isDragging && dropTarget && movePanel(container, panel, dropTarget)) {
                        showToast("패널 순서가 변경되었습니다.");
                    }
                };

                document.addEventListener("pointermove", onPointerMove, { passive: false });
                document.addEventListener("pointerup", onPointerUp);
                document.addEventListener("pointercancel", onPointerUp);
            });
        });
    }

    // 패널 헤더 전환 이벤트 연결
    function bindPanelHeaderSwitch(container) {
        getPanels(container).forEach((panel) => {
            const head = panel.querySelector(".panel-head");
            const title = head?.querySelector(".panel-title");
            if (!head || !title || head.dataset.panelSwitchReady === "true") return;

            head.dataset.panelSwitchReady = "true";
            title.setAttribute("role", "button");
            title.setAttribute("tabindex", "0");
            title.setAttribute("aria-pressed", "false");
            title.setAttribute("aria-label", `${title.textContent.trim()} 패널 위치 교환`);
            title.title = "클릭한 뒤 다른 패널 헤더를 클릭하면 위치가 교환됩니다.";

            // 화면 동작 활성화
            const activate = (event) => {
                if (event.target.closest("button, input, select, textarea, a, [contenteditable]")) return;
                if (head.dataset.suppressPanelSwitchClick === "true") {
                    delete head.dataset.suppressPanelSwitchClick;
                    return;
                }

                const selectedPanel = getPanels(container).find((item) => item.classList.contains("panel-switch-source"));
                if (!selectedPanel) {
                    panel.classList.add("panel-switch-source");
                    title.setAttribute("aria-pressed", "true");
                    showToast("위치를 바꿀 다른 패널 헤더를 선택해 주세요.");
                    return;
                }

                if (selectedPanel === panel) {
                    clearPanelSwitchSelection(container);
                    showToast("패널 위치 교환 선택을 취소했습니다.");
                    return;
                }

                if (swapPanelPositions(container, selectedPanel, panel)) {
                    clearPanelSwitchSelection(container);
                    showToast("선택한 두 패널의 위치를 교환했습니다.");
                }
            };

            head.addEventListener("click", activate);
            title.addEventListener("keydown", (event) => {
                if (!["Enter", " "].includes(event.key)) return;
                event.preventDefault();
                activate(event);
            });
        });
    }

    // 워크스페이스 패널 초기화
    function initWorkspacePanels(host) {
        const container = host.querySelector(".three-panel");
        if (!container || container.dataset.workspacePanelsReady === "true") return;

        const panels = getPanels(container);
        if (panels.length < 2) return;

        panels.forEach((panel, index) => {
            panel.dataset.panelInitialIndex = String(index);
            panel.dataset.panelMin = String(panelMinWidths[panel.dataset.slot] || panelMinWidth);
        });
        panelStates.set(container, { initialOrder: panels.slice() });
        container.dataset.workspacePanelsReady = "true";
        bindPanelCollapse(container);
        bindPanelDragDrop(container);
        bindPanelHeaderSwitch(container);
        window.AIOneSplitHandler?.init(container);
        syncPanelHandleAria(container);
    }

    /* ============================ 끝: 패널 배치 ============================== */

    /* ============================ 시작: 파일 작업 메뉴 ============================ */

    // 파일 항목 정렬
    function sortFileItems(list) {
        if (!list) return;
        const items = Array.from(list.querySelectorAll(":scope > li[data-file-idx]"));
        const direction = list.dataset.sortOrder === "oldest" ? -1 : 1;
        items.sort((a, b) => Number(b.classList.contains("pinned")) - Number(a.classList.contains("pinned")) || direction * (Number(a.dataset.fileInitialIndex) - Number(b.dataset.fileInitialIndex))).forEach((item) => list.append(item));
        syncWorkspaceFileIndexes(list);
    }

    // 고정 파일 항목 동기화
    function syncPinnedFileItem(item, isPinned) {
        item.classList.toggle("pinned", isPinned);
        const pinButton = item.querySelector('[data-menu-value="pin"]');
        if (pinButton) {
            const label = pinButton.querySelector("[data-file-action-label]");
            if (label) label.textContent = isPinned ? "고정 해제" : "고정";
            pinButton.setAttribute("aria-pressed", String(isPinned));
        }

        const meta = item.querySelector(".file-meta");
        if (meta) {
            meta.dataset.fileMetaBase ||= meta.textContent.replace(/\s*·\s*목록 고정$/, "").trim();
            meta.textContent = `${meta.dataset.fileMetaBase}${isPinned ? " · 목록 고정" : ""}`;
        }
    }

    // 파일 작업 메뉴 초기화
    function initFileActionMenus(root = document) {
        const list = root.querySelector?.(".workspace-file-list") || (root.matches?.(".workspace-file-list") ? root : null);
        if (!list) return;

        list.querySelectorAll(":scope > li[data-file-idx]").forEach((item, index) => {
            item.dataset.fileInitialIndex ||= String(index);
            if (item.dataset.fileActionsReady === "true") return;

            const trigger = item.querySelector(".file-item-side > .btn-more.small");
            if (!trigger) return;

            const menuId = `workspaceFileMenu-${item.dataset.fileIdx || index}`;
            const actionWrap = cloneWorkspacePrototype("workspaceFileActionMenuPrototype");
            if (!actionWrap) return;
            const menu = actionWrap.querySelector(".workspace-file-action-menu");

            trigger.dataset.dropdownTrigger = "";
            trigger.setAttribute("aria-haspopup", "menu");
            trigger.setAttribute("aria-expanded", "false");
            trigger.setAttribute("aria-controls", menuId);
            trigger.title = "더보기";

            menu.id = menuId;

            trigger.replaceWith(actionWrap);
            actionWrap.prepend(trigger);
            item.dataset.fileActionsReady = "true";
            syncPinnedFileItem(item, item.classList.contains("pinned"));
            hydrateIcons(menu);
        });

        window.AIOneDropdownMenu?.init(list);
    }

    // 파일 Delete 준비
    function prepareFileDelete(item) {
        pendingDeleteFileItem = item;
        const fileName = item.querySelector(".file-name")?.textContent.trim() || "선택한 파일";
        const modalFileName = document.querySelector("[data-delete-file-name]");
        if (modalFileName) modalFileName.textContent = fileName;
    }

    // 파일 Rename 준비
    function prepareFileRename(item) {
        pendingRenameFileItem = item;
        const input = document.querySelector("[data-file-rename-input]");
        const error = document.querySelector("[data-file-rename-error]");
        const fileName = item.querySelector(".file-name")?.textContent.trim() || "";
        if (input) input.value = fileName;
        if (error) error.hidden = true;
        window.setTimeout(() => {
            input?.focus();
            input?.select();
        }, 0);
    }

    // 대기 파일 이름 변경
    function renamePendingFile() {
        const item = pendingRenameFileItem;
        const input = document.querySelector("[data-file-rename-input]");
        const error = document.querySelector("[data-file-rename-error]");
        const nextName = input?.value.trim() || "";
        if (!item?.isConnected || !input) return;
        if (!nextName) {
            if (error) error.hidden = false;
            input.focus();
            return;
        }

        const name = item.querySelector(".file-name");
        if (name) {
            name.textContent = nextName;
            name.title = nextName;
        }
        const file = workspaceSampleData.files.find((entry) => entry.name === item.dataset.fileKey);
        if (file) file.displayName = nextName;
        item.dataset.fileDisplayName = nextName;
        const fileSequence = item.querySelector(".file-index")?.textContent.trim() || "";
        item.querySelector(".file-item-main")?.setAttribute("aria-label", `${fileSequence ? `업로드 순서 ${fileSequence}번, ` : ""}${nextName} 파일 보기`);
        if (item.classList.contains("active")) {
            document.querySelector("[data-active-file-name]")?.replaceChildren(nextName);
        }

        pendingRenameFileItem = null;
        window.AIOneModal?.close("#workspaceFileRenameModal");
        showToast("파일 이름을 변경했습니다.");
    }

    // 대기 파일 삭제
    function deletePendingFile() {
        const item = pendingDeleteFileItem;
        if (!item?.isConnected) return;

        const list = item.closest(".workspace-file-list");
        const wasActive = item.classList.contains("active");
        item.remove();
        if (wasActive) {
            const nextItem = list?.querySelector("li[data-file-idx]");
            if (nextItem) activateWorkspaceFile(nextItem.dataset.fileKey || nextItem.querySelector(".file-name")?.textContent.trim());
        }
        syncUploadSummary();
        pendingDeleteFileItem = null;
        window.AIOneModal?.close("#workspaceFileDeleteModal");
        showToast("파일이 삭제되었습니다.");
    }

    /* ============================ 끝: 파일 작업 메뉴 ============================== */

    /* ============================ 시작: 질의와 문서 동작 ============================ */

    // Progressbar 보강
    function enhanceProgressbar(host) {
        const progressbar = host.querySelector("[data-progressbar]");
        if (!progressbar) return;
        const value = progressbar.getAttribute("aria-valuenow") || progressbar.dataset.value || "0";
        progressbar.setAttribute("aria-label", `신뢰도 ${value}%`);
    }

    // 질문 카드 렌더링
    function renderQuestionCards(root = document) {
        const list = root.querySelector?.("[data-query-card-list]") || (root.matches?.("[data-query-card-list]") ? root : null);
        if (!list) return;
        const prototype = list.querySelector(".query-card");
        if (!prototype) return;
        const existingCards = new Map(Array.from(list.querySelectorAll(":scope > .query-card")).map((card) => [card.dataset.qid, card]));
        const cards = workspaceQuestionCards.map((query, index) => {
            const card = existingCards.get(String(query.id)) || (index === 0 ? prototype : prototype.cloneNode(true));
            card.dataset.qid = String(query.id);
            card.dataset.type = query.type;
            card.dataset.scope = query.type;
            card.dataset.excluded = String(Boolean(query.excluded));
            card.setAttribute("aria-label", `질의 Q${query.id}: ${query.text || ""}`);
            card.querySelector(".query-num")?.replaceChildren(`Q${query.id}`);
            card.querySelector(".query-exclude-btn")?.setAttribute("data-qid", String(query.id));
            card.querySelector(".query-edit-btn")?.setAttribute("data-qid", String(query.id));
            return card;
        });
        list.replaceChildren(...cards);
        workspaceQuestionCards.forEach((query) => {
            const card = list.querySelector(`.query-card[data-qid="${query.id}"]`);
            if (!card) return;
            card.dataset.type = query.type;
            card.dataset.scope = query.type;
            card.dataset.excluded = String(Boolean(query.excluded));
            card.classList.toggle("excluded", Boolean(query.excluded));
            card.classList.toggle("is-selected", Boolean(query.selected));
            card.querySelector("[data-query-type]")?.replaceChildren(query.typeLabel || { single: "단일소관", multi: "복수소관", none: "비소관" }[query.type] || "단일소관");
            card.querySelector(".query-text")?.replaceChildren(query.text || "");
            const tags = card.querySelectorAll(".query-dept .dept-tag");
            if (tags[0]) tags[0].textContent = query.mainDept ? `주관: ${query.mainDept}` : query.type === "none" ? `비소관: ${query.org || "해당없음"}` : "";
            if (tags[1]) {
                tags[1].textContent = query.coopDept ? `협조: ${query.coopDept}` : "";
                tags[1].hidden = !query.coopDept;
            }
            card.querySelector(".ai-reason-text")?.replaceChildren(query.reason || getWorkspaceClassificationReason(query));
            syncWorkspaceQueryCard(query);
        });
    }

    // 워크스페이스 정적 콘텐츠 연결
    function hydrateWorkspaceStaticContent() {
        const fileList = document.querySelector(".workspace-file-list");
        const fileItems = workspaceFileItems(fileList);
        files.splice(
            0,
            files.length,
            ...fileItems.map((item, index) => {
                const name = item.dataset.fileKey || item.querySelector(".file-name")?.textContent.trim() || `file-${index}`;
                const displayName = item.dataset.fileDisplayName || item.querySelector(".file-name")?.textContent.trim() || name;
                const queryCount = Number((item.querySelector(".query-count")?.textContent || "").match(/\d+/)?.[0]) || 0;
                item.dataset.fileInitialIndex ||= String(index);
                item.dataset.fileKey = name;
                return {
                    name,
                    displayName,
                    type: fileExtension(name),
                    size: item.dataset.fileSize || "",
                    chunks: Number(item.dataset.fileChunks) || Math.max(3, queryCount),
                    queryCount,
                };
            }),
        );
        if (fileList) fileList.dataset.sampleReady = "true";

        workspaceQuestionCards = Array.from(document.querySelectorAll("[data-query-card-list] > .query-card")).map((card, index) => {
            const type = card.dataset.type || card.dataset.scope || "single";
            const tags = Array.from(card.querySelectorAll(".query-dept .dept-tag")).map((tag) => tag.textContent.trim());
            // 부서 읽기
            const readDepartment = (prefix) =>
                tags
                    .find((tag) => tag.startsWith(prefix))
                    ?.slice(prefix.length)
                    .trim() || "";
            return {
                id: Number(card.dataset.qid) || index + 1,
                text: card.querySelector(".query-text")?.textContent.trim() || "",
                summary: card.querySelector(".query-text")?.textContent.trim() || "",
                type,
                typeLabel: card.querySelector("[data-query-type]")?.textContent.trim() || "단일소관",
                mainDept: readDepartment("주관:"),
                coopDept: readDepartment("협조:"),
                org: readDepartment("비소관:") || "재정경제부",
                confidence: Number.parseInt(card.querySelector(".confidence-value")?.textContent, 10) || 0,
                reason: card.querySelector(".ai-reason-text")?.textContent.trim() || "",
                excluded: card.classList.contains("excluded"),
                selected: card.classList.contains("is-selected"),
            };
        });
        const activeFileItem = fileItems.find((item) => item.classList.contains("active")) || fileItems[0];
        activeWorkspaceFileName = activeFileItem?.dataset.fileKey || files[0]?.name || "";
        const activePage = document.querySelector(".comparison-panel-area .orig-page");
        const activeQueries = workspaceQuestionCards.map((query) => ({ ...query, id: Number(query.id) }));
        fileData[activeWorkspaceFileName] = {
            meta: {
                date: activePage?.querySelector(".orig-form-date")?.textContent.trim() || "",
                committee: activePage?.querySelector(".orig-form-committee")?.textContent.trim() || "",
                memberName: activePage?.querySelectorAll(".orig-form-info-value")[0]?.textContent.trim() || "",
                partyName: activePage?.querySelectorAll(".orig-form-info-value")[1]?.textContent.trim() || "",
                formTitle: activePage?.querySelector(".orig-form-title")?.textContent.trim() || "",
            },
            preserveQueryIds: true,
            queries: activeQueries,
        };
        Object.assign(defaultMeta, fileData[activeWorkspaceFileName].meta);
        syncWorkspaceQuestionCounts();
    }

    // 질문 선택
    function selectQuestion(question) {
        const questions = Array.from(document.querySelectorAll(questionSelector));
        if (!question || !questions.includes(question)) return;
        const index = questions.indexOf(question);

        questions.forEach((item) => item.classList.toggle("active", item === question));
        document.querySelectorAll(".query-card").forEach((card) => {
            card.classList.toggle("is-selected", card.dataset.qid === question.dataset.questionIndex);
        });

        const query = workspaceQuestionCards.find((item) => String(item.id) === question.dataset.questionIndex);
        workspaceQuestionCards.forEach((item) => {
            item.selected = String(item.id) === question.dataset.questionIndex;
        });
        const type = query?.type || "single";
        const typeLabels = { single: "단일소관", multi: "복수소관", none: "비소관" };
        const original = query?.text || question.dataset.original || "";
        const summary = query?.summary || question.dataset.summary || original;
        const mainDepartment = query?.mainDept || "해당없음";
        const cooperationDepartment = query?.coopDept || "";
        const organization = query?.org || "";
        const recommendedDepartment = query ? getWorkspaceRecommendOffice(query) : type === "none" ? organization || "해당없음" : mainDepartment;

        document.querySelector("[data-result-original]")?.replaceChildren(original);
        document.querySelector("[data-result-summary]")?.replaceChildren(summary);
        document.querySelector("[data-result-department]")?.replaceChildren(recommendedDepartment);
        document.querySelector("[data-result-reason]")?.replaceChildren(query?.reason || "AI 분류 기준에 따라 추천 실국을 판정했습니다.");
        syncWorkspaceDetailExclusion(query);

        const typeBadge = document.querySelector("[data-result-type]");
        if (typeBadge) {
            typeBadge.classList.remove("single", "multi", "none");
            typeBadge.classList.add(type);
            typeBadge.textContent = typeLabels[type] || typeLabels.single;
        }

        const mainDepartmentBadge = document.querySelector("[data-result-main-department]");
        if (mainDepartmentBadge) {
            mainDepartmentBadge.textContent = type === "none" ? `소관기관: ${organization || "확인 필요"}` : `주관: ${mainDepartment}`;
        }

        const cooperationDepartmentBadge = document.querySelector("[data-result-coop-department]");
        if (cooperationDepartmentBadge) {
            cooperationDepartmentBadge.hidden = type !== "multi" || !cooperationDepartment;
            cooperationDepartmentBadge.textContent = cooperationDepartment ? `협조: ${cooperationDepartment}` : "";
        }

        const locationCard = document.querySelector(".source-link-card");
        locationCard?.querySelector(".source-link-location")?.replaceChildren(`1페이지 · 문단 ${index + 1}`);
        locationCard?.querySelector(".source-link-text")?.replaceChildren(`“${original}”`);

        const confidenceHost = document.querySelector(".inspector-confidence");
        const progressbar = confidenceHost?.querySelector("[data-progressbar]");
        if (progressbar) {
            window.AIOneProgressBar?.setValue(progressbar, question.dataset.confidence);
            progressbar.setAttribute("aria-label", `신뢰도 ${question.dataset.confidence}%`);
        }

        const previousButton = document.querySelector('[data-question-move="-1"]');
        const nextButton = document.querySelector('[data-question-move="1"]');
        if (previousButton) previousButton.disabled = index === 0;
        if (nextButton) nextButton.disabled = index === questions.length - 1;
        document.querySelector(".doc-detail-counter")?.replaceChildren(`문장 ${index + 1} / ${questions.length} 선택됨`);
    }

    // 질문 이동
    function moveQuestion(direction) {
        const questions = Array.from(document.querySelectorAll(questionSelector));
        const selectedIndex = questions.findIndex((question) => question.classList.contains("active"));
        const nextIndex = Math.min(questions.length - 1, Math.max(0, selectedIndex + direction));
        if (nextIndex !== selectedIndex) selectQuestion(questions[nextIndex]);
    }

    // 선택 소스 질문 포커스 이동
    function focusSelectedSourceQuestion() {
        const selectedQuestion = document.querySelector(`${questionSelector}.active`);
        if (!selectedQuestion) return;

        selectedQuestion.scrollIntoView({ behavior: "smooth", block: "center" });
        selectedQuestion.classList.remove("source-link-focus");
        void selectedQuestion.offsetWidth;
        selectedQuestion.classList.add("source-link-focus");
        window.setTimeout(() => selectedQuestion.classList.remove("source-link-focus"), 1400);
    }

    // 워크스페이스 문서 확대/축소 초기화
    function resetWorkspaceDocumentZoom() {
        const statusbar = document.querySelector(".comparison-panel-area [data-document-statusbar]");
        window.AIOneDocumentStatusBar?.setZoom(statusbar, 100);
    }

    // 질문 필터링
    function filterQuestions(filter) {
        currentQuestionFilter = filter;
        document.querySelectorAll(".filter-btn").forEach((button) => {
            const selected = button.dataset.filter === filter;
            button.classList.toggle("active", selected);
            button.setAttribute("aria-pressed", String(selected));
        });
        document.querySelectorAll(".query-card").forEach((card) => {
            const excluded = card.dataset.excluded === "true";
            card.hidden = filter === "excluded" ? !excluded : excluded || (filter !== "all" && card.dataset.scope !== filter);
        });
    }

    // 워크스페이스 빈 상태 설정
    function setWorkspaceEmptyState(isEmpty) {
        document.body.classList.toggle("is-new-workspace", isEmpty);
        const fileList = document.querySelector(".workspace-file-list");
        if (fileList && isEmpty) {
            fileList.replaceChildren();
        } else if (fileList && workspaceFileItems(fileList).length === 0 && workspaceInitialFileItems) {
            fileList.replaceChildren(...workspaceInitialFileItems.map((item) => item.cloneNode(true)));
            initFileActionMenus(fileList);
            hydrateIcons(fileList);
        }
        document.querySelectorAll("[data-workspace-empty]").forEach((emptyState) => {
            emptyState.hidden = !isEmpty;
        });

        const fileInput = document.getElementById("workspaceFileInput");
        if (fileInput) fileInput.value = "";

        syncUploadSummary();

        const filterCounts = workspaceQuestionCards.reduce(
            (counts, query) => {
                counts.all += 1;
                counts[query.type] = (counts[query.type] || 0) + 1;
                return counts;
            },
            { all: 0, single: 0, multi: 0, none: 0 },
        );
        document.querySelectorAll(".filter-btn[data-filter]").forEach((button) => {
            const count = button.querySelector(".filter-count");
            if (count) count.textContent = isEmpty ? "0" : String(filterCounts[button.dataset.filter] || 0);
        });

        const sourceFile = document.querySelector("[data-active-file-name]");
        if (sourceFile) sourceFile.textContent = isEmpty ? "파일을 선택하세요" : activeWorkspaceFileName;

        const extractCount = document.querySelector("[data-extract-count]");
        if (extractCount) extractCount.textContent = isEmpty ? "0" : String(workspaceQuestionCards.length);

        const selectionCount = document.querySelector(".doc-detail-counter");
        if (selectionCount) selectionCount.textContent = isEmpty ? "문장 0 / 0 선택됨" : `문장 1 / ${workspaceQuestionCards.length} 선택됨`;

        const characterCount = document.querySelector("[data-character-count]");
        if (characterCount) characterCount.textContent = isEmpty ? "0" : String(workspaceQuestionCards.reduce((total, query) => total + query.text.length, 0));

        const pageCount = document.querySelector("[data-page-count]");
        if (pageCount) pageCount.textContent = "1/1";

        resetWorkspaceDocumentZoom();

        setQuestionConfirmationState(false);
        filterQuestions("all");
    }

    // 새 질문 분류 시작
    function startNewQuestionClassification() {
        pendingDeleteFileItem = null;
        pendingRenameFileItem = null;
        cancelWorkspaceSkeleton();
        setWorkspaceEmptyState(true);
        showToast("새 질의분류를 시작합니다. 파일과 질의 분류 결과가 초기화되었습니다.");
    }

    /* ============================ 끝: 질의와 문서 동작 ============================== */

    const workspaceQueryEditModalState = new WeakMap();

    // 워크스페이스 질의 편집 선택값 설정
    function setWorkspaceQueryEditSelectValue(select, value) {
        if (!select) return;

        const nextValue = String(value || "");
        const hasOption = Array.from(select.options).some((option) => option.value === nextValue);
        if (nextValue && !hasOption) select.add(new Option(nextValue, nextValue));
        select.value = nextValue;
    }

    // 워크스페이스 입력값으로 수정 모달을 채웁니다.
    function fillWorkspaceQueryEditModal(modal, query = {}) {
        const type = ["single", "multi", "none"].includes(query.type) ? query.type : "single";
        const text = modal.querySelector("[data-query-edit-text]");
        const typeSelect = modal.querySelector("[data-query-edit-type]");
        const mainDepartment = modal.querySelector("[data-query-edit-main-dept]");
        const cooperationDepartment = modal.querySelector("[data-query-edit-coop-dept]");
        const organization = modal.querySelector("[data-query-edit-org]");

        if (text) text.value = query.text || "";
        setWorkspaceQueryEditSelectValue(typeSelect, type);
        setWorkspaceQueryEditSelectValue(mainDepartment, query.mainDept || "해당없음");
        if (cooperationDepartment) cooperationDepartment.value = query.coopDept || "";
        if (organization) organization.value = query.org || "재정경제부";
    }

    // 워크스페이스 수정 모달의 입력값을 읽습니다.
    function readWorkspaceQueryEditModal(modal) {
        const state = workspaceQueryEditModalState.get(modal) || {};
        return {
            id: state.id,
            text: modal.querySelector("[data-query-edit-text]")?.value.trim() || "",
            type: modal.querySelector("[data-query-edit-type]")?.value || "single",
            mainDept: modal.querySelector("[data-query-edit-main-dept]")?.value || "",
            coopDept: modal.querySelector("[data-query-edit-coop-dept]")?.value.trim() || "",
            org: modal.querySelector("[data-query-edit-org]")?.value.trim() || "",
        };
    }

    // 워크스페이스 수정 모달을 열고 초기화합니다.
    function openWorkspaceQueryEditModal(query, trigger = null) {
        const modal = document.querySelector("#workspaceQueryEditModal");
        if (!modal) return null;

        workspaceQueryEditModalState.set(modal, { id: query.id });
        fillWorkspaceQueryEditModal(modal, query);
        window.AIOneModal?.open(modal, trigger);
        return modal;
    }

    /* ============================ 시작: 화면 이벤트와 초기화 ============================ */

    document.addEventListener("query-edit-modal:apply", (event) => {
        const values = event.detail || {};
        const query = workspaceQuestionCards.find((item) => String(item.id) === String(values.id));
        if (!query) return;

        Object.assign(query, {
            type: values.type,
            text: values.text,
            mainDept: values.mainDept,
            coopDept: values.coopDept,
            org: values.org,
        });

        const originalQuestion = document.querySelector(`${questionSelector}[data-question-index="${query.id}"]`);
        if (originalQuestion) {
            originalQuestion.dataset.original = query.text;
            originalQuestion.dataset.department = [query.mainDept, query.coopDept].filter(Boolean).join(" · ") || query.org || "해당없음";
            const questionText = originalQuestion.querySelector(".orig-query-box-text");
            if (questionText) questionText.replaceChildren(query.text);
            syncWorkspaceOriginalExclusion(query);
        }

        syncWorkspaceQueryCard(query);
        syncWorkspaceQuestionCounts();
        filterQuestions(currentQuestionFilter);
        if (originalQuestion) selectQuestion(originalQuestion);
        showToast("수정되었습니다.");
    });

    // 질의 업로드 목록 순서 설정
    document.addEventListener("change", (event) => {
        const fileSortSelect = event.target.closest(".file-list-sort");
        if (!fileSortSelect) return;

        const list = fileSortSelect.closest(".file-list-section")?.querySelector(".workspace-file-list");
        if (!list) return;

        list.dataset.sortOrder = fileSortSelect.value === "oldest" ? "oldest" : "latest";
        sortFileItems(list);
    });

    document.addEventListener("click", (event) => {
        const applyButton = event.target.closest("[data-query-edit-apply]");
        if (!applyButton) return;

        const modal = applyButton.closest("#workspaceQueryEditModal");
        if (!modal) return;

        const values = readWorkspaceQueryEditModal(modal);
        modal.dispatchEvent(
            new CustomEvent("query-edit-modal:apply", {
                bubbles: true,
                detail: values,
            }),
        );
        window.AIOneModal?.close(modal);
    });

    document.addEventListener("dropdownmenu:select", (event) => {
        const item = event.target.closest(".workspace-file-list li[data-file-idx]");
        if (!item) return;

        if (event.detail?.value === "pin") {
            const isPinned = !item.classList.contains("pinned");
            syncPinnedFileItem(item, isPinned);
            sortFileItems(item.closest(".workspace-file-list"));
            showToast(isPinned ? "파일을 목록 상단에 고정했습니다." : "파일 고정을 해제했습니다.");
        }
        if (event.detail?.value === "rename") prepareFileRename(item);
        if (event.detail?.value === "delete") prepareFileDelete(item);
    });

    document.addEventListener("modal:close", (event) => {
        if (event.target.id === "workspaceFileDeleteModal") pendingDeleteFileItem = null;
        if (event.target.id === "workspaceQueryDeleteModal") after9Workspace.state.pendingQueryExclusion = null;
        if (event.target.id === "workspaceFileRenameModal") {
            pendingRenameFileItem = null;
            const error = event.target.querySelector("[data-file-rename-error]");
            if (error) error.hidden = true;
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.target.matches("[data-file-rename-input]") && event.key === "Enter") {
            event.preventDefault();
            renamePendingFile();
            return;
        }
        const queryCard = event.target.closest("[data-query-card-list] > .query-card");
        if (queryCard && event.target === queryCard && ["Enter", " "].includes(event.key)) {
            event.preventDefault();
            const question = document.querySelector(`${questionSelector}[data-question-index="${queryCard.dataset.qid}"]`);
            if (question) selectQuestion(question);
            return;
        }
        const question = event.target.closest(questionSelector);
        if (!question || !["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        selectQuestion(question);
    });

    document.addEventListener("click", (event) => {
        const queryExcludeButton = event.target.closest("[data-query-card-list] .query-exclude-btn");
        if (queryExcludeButton) {
            after9Workspace.features.queryExclusion.prepare(queryExcludeButton);
            return;
        }

        const queryEditButton = event.target.closest("[data-query-card-list] .query-edit-btn");
        if (queryEditButton) {
            const query = workspaceQuestionCards.find((item) => String(item.id) === String(queryEditButton.dataset.qid));
            if (query) openWorkspaceQueryEditModal(query, queryEditButton);
            return;
        }

        const queryCard = event.target.closest("[data-query-card-list] > .query-card");
        if (queryCard) {
            const question = document.querySelector(`${questionSelector}[data-question-index="${queryCard.dataset.qid}"]`);
            if (question) selectQuestion(question);
            return;
        }

        const fileRenameConfirmButton = event.target.closest("[data-file-rename-confirm]");
        if (fileRenameConfirmButton) {
            renamePendingFile();
            return;
        }

        const detailExcludeButton = event.target.closest("[data-detail-exclude]");
        if (detailExcludeButton) {
            const query = workspaceQuestionCards.find((item) => String(item.id) === detailExcludeButton.dataset.queryId);
            if (query) setWorkspaceQueryExcluded(query, !query.excluded);
            return;
        }

        const queryExclusionConfirmButton = event.target.closest('[data-workspace-confirm="query-exclusion"]');
        if (queryExclusionConfirmButton) {
            after9Workspace.features.queryExclusion.confirm();
            return;
        }

        //파일 삭제 확인 팝업 설정
        const deleteConfirmButton = event.target.closest('[data-workspace-confirm="delete-file"]');
        if (deleteConfirmButton) {
            deletePendingFile();
            return;
        }

        //AI 재분류 토스트
        const reclassifyConfirmButton = event.target.closest('[data-workspace-confirm="reclassify"]');
        if (reclassifyConfirmButton) {
            after9Workspace.state.confirmedQuestions = [];
            setQuestionConfirmationState(false);
            showWorkspaceSkeleton("AI가 질의와 실국 정보를 다시 분류하고 있습니다...");
            showToast("AI 재분류를 실행 중입니다.");
            finishWorkspaceSkeleton(1100, () => showToast("AI 재분류가 완료되었습니다."));
            return;
        }
        //질의확정  토스트
        const questionConfirmButton = event.target.closest('[data-workspace-confirm="question-classification"]');
        if (questionConfirmButton) {
            after9Workspace.state.confirmedQuestions = createConfirmedWorkspaceSnapshot();
            showToast("질의 5건이 확정되었습니다. 배정 실국 5개가 알림 대상으로 선정되었습니다.");
            setQuestionConfirmationState(true, true);
            return;
        }

        //확정취소 토스트
        const questionConfirmCancelButton = event.target.closest('[data-workspace-confirm="question-confirm-cancel"]');
        if (questionConfirmCancelButton) {
            after9Workspace.state.confirmedQuestions = [];
            setQuestionConfirmationState(false);
            showToast("확정이 취소되었습니다.");
            return;
        }

        // 알림전송 클릭 후 나오는 팝업
        const departmentNotificationConfirmButton = event.target.closest('[data-workspace-confirm="department-notification"]');
        if (departmentNotificationConfirmButton) {
            const routing = renderWorkspaceNotificationRouting();
            const sentMessage = document.querySelector("[data-notification-sent-message]");
            if (sentMessage) {
                sentMessage.textContent = `확정된 질의 ${routing.queryCount}건의 배정 실국 담당자 ${routing.recipientCount}명에게 알림을 전송합니다.`;
            }
            showToast(`알림전송이 완료되었습니다. 확정 질의 ${routing.queryCount}건이 실국담당자 ${routing.recipientCount}명에게 전달되었습니다.`);
            setQuestionConfirmationState("notified");
            window.setTimeout(() => {
                window.AIOneModal?.open("#workspaceDepartmentNotificationSentModal");
            }, 0);
            return;
        }

        const filterButton = event.target.closest(".filter-btn");
        if (filterButton) {
            filterQuestions(filterButton.dataset.filter);
            return;
        }

        const question = event.target.closest(questionSelector);
        if (question) {
            selectQuestion(question);
            return;
        }

        if (event.target.closest(".source-link-card")) {
            focusSelectedSourceQuestion();
            return;
        }

        const fileButton = event.target.closest(".workspace-file-list .file-item-main");
        if (fileButton) {
            const item = fileButton.closest("li[data-file-idx]");
            activateWorkspaceFile(item.dataset.fileKey || item.querySelector(".file-name")?.textContent.trim());
            return;
        }

        const copyButton = event.target.closest("[data-copy-target]");
        if (copyButton) {
            copyResult(copyButton.dataset.copyTarget);
            return;
        }

        const moveButton = event.target.closest("[data-question-move]");
        if (moveButton && !moveButton.disabled) {
            moveQuestion(Number(moveButton.dataset.questionMove));
            return;
        }

        const actionButton = event.target.closest("[data-workspace-action], #runDrawerBtn");
        if (!actionButton) return;

        if (actionButton.id === "runDrawerBtn") return;

        if (actionButton.dataset.workspaceAction === "new-question") {
            startNewQuestionClassification();
            return;
        }

        if (actionButton.dataset.workspaceAction === "download") {
            downloadWorkspaceExcel();
            return;
        }

        // AFTER-9 부분 구현: 현재 트리거는 ai-workspace.html에서 주석 처리되어 있으며,
        // 트리거를 복원하면 data-modal-open이 숨겨진 대상 모달을 엽니다.
        if (actionButton.dataset.workspaceAction === "department-notification") {
            if (after9Workspace.state.confirmationState !== "confirmed") return;
            renderWorkspaceNotificationRouting();
            return;
        }

        const messages = {
            edit: "선택한 질의 수정 화면을 준비했습니다.",
            reclassify: "AI 재분류를 실행했습니다.",
            "save-assignee": "실국별 알림 담당자 설정을 저장했습니다.",
        };
        showToast(messages[actionButton.dataset.workspaceAction || actionButton.id] || "기능을 선택했습니다.");
    });

    // AFTER-9 부분 구현: 실국별 알림 담당자 설정 토스트
    document.addEventListener("notification-assignee:save", (event) => {
        const modal = document.getElementById("workspaceNotificationAssigneeModal");
        if (!modal?.contains(event.target)) return;
        showToast("실국별 알림 담당자 설정을 저장했습니다.");
    });

    document.addEventListener("split-handler:resize", (event) => {
        if (!event.target.matches?.(".comparison-body")) return;
        const { leftWidth, rightWidth } = event.detail || {};
        if (!Number.isFinite(leftWidth) || !Number.isFinite(rightWidth)) return;
        document.querySelector(".comparison-meta")?.style.setProperty("grid-template-columns", `${leftWidth}px ${rightWidth}px`);
    });

    /* ============================ 시작: AFTER-9 Feature Module Initialization ============================ */

    // 완료 답변 화면 기능 초기화
    function initAfter9WorkspaceFeatures(root = document) {
        initWorkspaceRuleSettings(root);
        initWorkspaceNotificationAssignee(root);

        root.querySelector?.("[data-accessory-tools]")?.addEventListener("topbar:accessory-action", handleAccessoryAction);
    }

    /* ============================ 끝: AFTER-9 Feature Module Initialization ============================== */

    document.addEventListener("DOMContentLoaded", () => {
        hydrateIcons();
        hydrateWorkspaceStaticContent();
        enhanceSidebar(document);
        enhanceTopbar(document);
        initWorkspaceRunList();
        document.querySelectorAll(".file-upload-area").forEach(initFileUpload);
        document.querySelectorAll(".progressbar-area").forEach(enhanceProgressbar);
        initWorkspacePanels(document);
        initAfter9WorkspaceFeatures(document);
        initFileActionMenus();
        observeWorkspaceFileList();
    });

    /* ============================ 끝: 화면 이벤트와 초기화 ============================== */
})();
