"use strict";

(function () {
    const NOTIFICATION_KEY = "ai-one-long-task-notification";
    let notificationEnabled = readNotificationPreference();

    /* ============================ Start: 알림 설정 (Notification Settings) ============================ */
    function readNotificationPreference() {
        try {
            const saved = localStorage.getItem(NOTIFICATION_KEY);
            return saved === null ? true : saved === "true";
        } catch (e) {
            return true;
        }
    }

    function saveNotificationPreference(enabled) {
        notificationEnabled = Boolean(enabled);
        try {
            localStorage.setItem(NOTIFICATION_KEY, String(notificationEnabled));
        } catch (e) {
            /* 현재 화면에만 적용 */
        }
        if (!notificationEnabled) window.AIOneSidebar?.clearCompletion();
        else window.AIOneSidebar?.renderCompletionDots();
        updateAllNotificationUIs();
        document.dispatchEvent(new CustomEvent("ai-one-notification-change", { detail: { enabled: notificationEnabled } }));
    }

    function updateNotificationUI(panel, message = "") {
        const toggle = panel?.querySelector(".notification-toggle");
        const status = panel?.querySelector(".notification-setting-status");
        if (!toggle || !status) return;

        toggle.classList.toggle("active", notificationEnabled);
        toggle.setAttribute("aria-checked", String(notificationEnabled));
        status.textContent = message || (notificationEnabled ? "알림이 켜져 있습니다." : "알림이 꺼져 있습니다.");
    }

    function updateAllNotificationUIs(message = "") {
        document.querySelectorAll("[data-settings-panel]").forEach((panel) => updateNotificationUI(panel, message));
    }

    function initSettingsPanels(root = document) {
        const panels = [];
        if (root instanceof Element && root.matches("[data-settings-panel]")) panels.push(root);
        root.querySelectorAll?.("[data-settings-panel]").forEach((panel) => panels.push(panel));

        panels.forEach((panel) => {
            if (panel.dataset.settingsReady !== "true") {
                panel.querySelector(".notification-toggle")?.addEventListener("click", async () => {
                    if (notificationEnabled) {
                        saveNotificationPreference(false);
                        return;
                    }

                    if ("Notification" in window && Notification.permission === "default") {
                        try {
                            await Notification.requestPermission();
                        } catch (e) {
                            /* 브라우저 알림 미지원 */
                        }
                    }
                    if ("Notification" in window && Notification.permission === "denied") {
                        saveNotificationPreference(false);
                        updateAllNotificationUIs("브라우저 알림 권한이 차단되어 있습니다.");
                        return;
                    }

                    saveNotificationPreference(true);
                    showInAppNotification("알림 설정 완료", "시간이 걸리는 요청의 응답 완료 알림을 받습니다.");
                });
                panel.dataset.settingsReady = "true";
            }

            updateNotificationUI(panel);
        });
    }

    window.AIOnePreferences = Object.freeze({
        init: initSettingsPanels,
        isNotificationEnabled: () => notificationEnabled,
        setNotificationEnabled: (enabled) => saveNotificationPreference(enabled),
    });
    document.dispatchEvent(new CustomEvent("ai-one-preferences:ready"));

    function showInAppNotification(title, body) {
        let toast = document.querySelector(".ai-one-notification-toast");
        if (!toast) return;
        if (toast.dataset.notificationReady !== "true") {
            toast.querySelector("button")?.addEventListener("click", () => toast.classList.remove("show"));
            toast.dataset.notificationReady = "true";
        }
        toast.querySelector("strong").textContent = title;
        toast.querySelector("span").textContent = body;
        toast.classList.add("show");
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => toast.classList.remove("show"), 4500);
    }

    function inferMenuKeyFromNotification(title) {
        const text = String(title || "");
        if (text.includes("질의 분류") || text.includes("질의 재분류")) return "intake";
        if (text.includes("답변서") || text.includes("관련자료")) return "answer";
        if (text.includes("경제")) return "economy";
        if (text.includes("챗봇")) return "chatbot";
        return "";
    }

    function notifyLongTask(title, body, menuKey) {
        if (!notificationEnabled) return false;
        const resolvedMenuKey = menuKey || inferMenuKeyFromNotification(title);
        if (resolvedMenuKey) window.AIOneSidebar?.markCompletion(resolvedMenuKey);
        showInAppNotification(title, body);
        if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
            try {
                new Notification(title, { body: body, tag: "ai-one-long-task" });
            } catch (e) {
                /* 인앱 알림으로 대체 */
            }
        }
        return true;
    }

    window.AIOneNotifications = {
        isEnabled: () => notificationEnabled,
        notifyLongTask,
    };

    /* ============================ End: 알림 설정 (Notification Settings) ============================== */

    /* ============================ Start: 드로어 레이어 상태 (Drawer Layer State) ============================ */
    function observeDrawerLayering() {
        const selectors = ".run-drawer, .chat-drawer, .rule-drawer, .report-drawer";
        const update = () => {
            const open = Array.from(document.querySelectorAll(selectors)).some((drawer) => !drawer.classList.contains("hidden"));
            document.body.classList.toggle("drawer-layer-open", open);
        };
        const drawers = document.querySelectorAll(selectors);
        drawers.forEach((drawer) => {
            if (!(drawer instanceof Node)) return;
            try {
                new MutationObserver(update).observe(drawer, { attributes: true, attributeFilter: ["class"] });
            } catch (error) {
                return;
            }
        });
        update();
    }

    document.addEventListener("app:includes-ready", () => {
        initSettingsPanels();
    });
    document.addEventListener("component:ready", (event) => {
        initSettingsPanels(event.target);
    });
    document.addEventListener("DOMContentLoaded", () => {
        initSettingsPanels();
        observeDrawerLayering();
    });
})();

/* ============================ End: 드로어 레이어 상태 (Drawer Layer State) ============================== */

/* ============================ Start: 공통 컴포넌트 런타임 (Shared Component Runtime) ============================ */

/* ============================ Start: 레이어 팝업 (Layer Popup) ============================ */

(() => {
    const returnFocus = new WeakMap();
    const registeredTypes = new Map();

    function getOpenLayers() {
        return Array.from(registeredTypes.values()).flatMap((config) => Array.from(document.querySelectorAll(`${config.layerSelector}:not([hidden])`)));
    }

    function syncBodyState() {
        document.body.classList.toggle("is-component-layer-open", getOpenLayers().length > 0);
    }

    function getConfigForLayer(layer) {
        return Array.from(registeredTypes.values()).find((config) => layer.matches(config.layerSelector));
    }

    function setOpen(layer, isOpen, trigger = null) {
        const config = layer && getConfigForLayer(layer);
        if (!layer || !config) return;

        layer.hidden = !isOpen;
        document.querySelectorAll(`[${config.openAttribute}="${layer.id}"]`).forEach((button) => {
            button.setAttribute("aria-expanded", String(isOpen));
        });

        if (isOpen) {
            returnFocus.set(layer, trigger || document.activeElement);
            if (config.focusOnOpen !== false) {
                window.requestAnimationFrame(() => {
                    const focusScope = layer.querySelector('[role="dialog"]') || layer;
                    const focusableSelector = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
                    const focusTarget = [focusScope.querySelector("[autofocus]"), ...focusScope.querySelectorAll(focusableSelector)].find((element) => element instanceof HTMLElement && element.getClientRects().length > 0);
                    focusTarget?.focus();
                });
            }
        } else {
            const returnTarget = returnFocus.get(layer);
            if (returnTarget instanceof HTMLElement && returnTarget.isConnected) returnTarget.focus();
            returnFocus.delete(layer);
        }

        syncBodyState();
        layer.dispatchEvent(
            new CustomEvent(`${config.type}:${isOpen ? "open" : "close"}`, {
                bubbles: true,
            }),
        );
    }

    function initType(root, config) {
        root.querySelectorAll?.(`[${config.openAttribute}]`).forEach((trigger) => {
            if (!trigger.hasAttribute("aria-haspopup")) trigger.setAttribute("aria-haspopup", "dialog");
            if (!trigger.hasAttribute("aria-expanded")) trigger.setAttribute("aria-expanded", "false");
        });
        syncBodyState();
    }

    function bindGlobalEvents() {
        if (document.documentElement.dataset.componentLayerEventsReady === "true") return;

        document.addEventListener("click", (event) => {
            for (const config of registeredTypes.values()) {
                const close = event.target.closest(`[${config.closeAttribute}]`);
                if (close) {
                    setOpen(close.closest(config.layerSelector), false);
                    return;
                }

                const trigger = event.target.closest(`[${config.openAttribute}]`);
                if (trigger) {
                    setOpen(document.getElementById(trigger.getAttribute(config.openAttribute)), true, trigger);
                    return;
                }

                const layer = event.target.closest(config.layerSelector);
                if (layer && config.closeOnLayerClick && event.target === layer) {
                    setOpen(layer, false);
                    return;
                }
            }
        });

        document.addEventListener("keydown", (event) => {
            const layer = getOpenLayers().at(-1);
            if (!layer) return;
            if (event.defaultPrevented) return;

            if (event.key === "Escape") {
                if (event.target.closest?.("[data-dropdown-menu].is-open")) return;
                event.preventDefault();
                setOpen(layer, false);
                return;
            }
            if (event.key !== "Tab") return;

            const focusScope = layer.querySelector('[role="dialog"]') || layer;
            const focusable = Array.from(focusScope.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter(
                (element) => element.getClientRects().length > 0,
            );
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

        document.documentElement.dataset.componentLayerEventsReady = "true";
    }

    function create(config) {
        registeredTypes.set(config.type, Object.freeze({ ...config }));
        bindGlobalEvents();

        return Object.freeze({
            init(root = document) {
                initType(root, config);
            },
            open(target, trigger = null) {
                const layer = target instanceof Element ? target : document.querySelector(target);
                setOpen(layer, true, trigger);
            },
            close(target) {
                const layer = target instanceof Element ? target : document.querySelector(target);
                setOpen(layer, false);
            },
        });
    }

    window.AIOneLayerFactory = Object.freeze({ create });
})();

/* ============================ End: 레이어 팝업 (Layer Popup) ============================== */

/* ============================ Start: 버튼 (Button) ============================ */

(() => {
    function bindReactionButton(button) {
        if (!button || button.closest("[data-chat-message-list]")) return;
        if (button.dataset.reactionButtonReady === "true") return;

        if (!button.hasAttribute("aria-pressed")) button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", () => {
            const isPressed = button.getAttribute("aria-pressed") === "true";
            button.classList.toggle("active", !isPressed);
            button.setAttribute("aria-pressed", String(!isPressed));
        });
        button.dataset.reactionButtonReady = "true";
    }

    function init(root = document) {
        const selector = '.icon-button-message[data-action="like"], .icon-button-message[data-action="dislike"]';
        if (root.matches?.(selector)) bindReactionButton(root);
        root.querySelectorAll?.(selector).forEach(bindReactionButton);
    }

    window.AIOneButton = Object.freeze({ init });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init(), { once: true });
    } else {
        init();
    }
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* ============================ End: 버튼 (Button) ============================== */

/* ============================ Start: 칩 (Chip) ============================ */

(() => {
    function resolveConfig(button) {
        const group = button.closest("[data-chip-target]");
        const targetSelector = button.dataset.chipTarget || group?.dataset.chipTarget;
        if (!targetSelector) return null;

        return {
            targetSelector,
            value: button.dataset.chipValue ?? `${button.textContent.trim()}${button.dataset.chipSuffix ?? group?.dataset.chipSuffix ?? ""}`,
        };
    }

    document.addEventListener("click", (event) => {
        const button = event.target.closest(".chat-tag");
        if (!button) return;

        const config = resolveConfig(button);
        if (!config) return;

        const target = document.querySelector(config.targetSelector);
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;

        target.value = config.value;
        target.dispatchEvent(new Event("input", { bubbles: true }));
        target.focus();
        button.dispatchEvent(
            new CustomEvent("chip:action", {
                bubbles: true,
                detail: { target, value: config.value },
            }),
        );
    });
})();

/* ============================ End: 칩 (Chip) ============================== */

/* ============================ Start: 툴팁 (Tooltip) ============================ */

(() => {
    const TOOLTIP_ID = "aiOneTooltip";
    const VIEWPORT_PADDING = 8;
    const DEFAULT_GAP = 10;
    const boundRoots = new WeakMap();
    const describedByStates = new WeakMap();
    let activeTrigger = null;
    let hideTimer = 0;

    function ensureTooltip() {
        let tooltip = document.getElementById(TOOLTIP_ID);
        return tooltip;
    }

    function resolveContent(trigger, options) {
        if (typeof options.content === "function") return options.content(trigger);
        if (options.content !== undefined) return options.content;
        return trigger.dataset.tooltip || "";
    }

    function resolvePlacement(trigger, options) {
        const placement = trigger.dataset.tooltipPlacement || options.placement || "top";
        return ["top", "right", "bottom", "left"].includes(placement) ? placement : "top";
    }

    function setDescribedBy(trigger, tooltip) {
        if (!describedByStates.has(trigger)) {
            describedByStates.set(trigger, trigger.getAttribute("aria-describedby"));
        }
        const currentIds = (trigger.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
        if (!currentIds.includes(tooltip.id)) currentIds.push(tooltip.id);
        trigger.setAttribute("aria-describedby", currentIds.join(" "));
    }

    function restoreDescribedBy(trigger) {
        if (!trigger || !describedByStates.has(trigger)) return;
        const previousValue = describedByStates.get(trigger);
        if (previousValue) trigger.setAttribute("aria-describedby", previousValue);
        else trigger.removeAttribute("aria-describedby");
        describedByStates.delete(trigger);
    }

    function positionTooltip(tooltip, trigger, placement, gap) {
        const triggerRect = trigger.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        let left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        let top = triggerRect.top - tooltipRect.height - gap;

        if (placement === "right") {
            left = triggerRect.right + gap;
            top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        } else if (placement === "bottom") {
            top = triggerRect.bottom + gap;
        } else if (placement === "left") {
            left = triggerRect.left - tooltipRect.width - gap;
            top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        }

        left = Math.max(VIEWPORT_PADDING, Math.min(left, window.innerWidth - tooltipRect.width - VIEWPORT_PADDING));
        top = Math.max(VIEWPORT_PADDING, Math.min(top, window.innerHeight - tooltipRect.height - VIEWPORT_PADDING));
        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
    }

    function hide(trigger = activeTrigger) {
        if (trigger && activeTrigger && trigger !== activeTrigger) return;
        const tooltip = document.getElementById(TOOLTIP_ID);
        if (!tooltip) return;

        window.clearTimeout(hideTimer);
        tooltip.classList.remove("is-visible");
        restoreDescribedBy(activeTrigger);
        activeTrigger = null;
        hideTimer = window.setTimeout(() => {
            if (!tooltip.classList.contains("is-visible")) tooltip.hidden = true;
        }, 150);
    }

    function show(trigger, options = {}) {
        if (!(trigger instanceof Element)) return null;
        if (typeof options.enabled === "function" && !options.enabled(trigger)) {
            hide();
            return null;
        }

        const content = String(resolveContent(trigger, options) ?? "").trim();
        if (!content) return null;

        const tooltip = ensureTooltip();
        window.clearTimeout(hideTimer);
        if (activeTrigger && activeTrigger !== trigger) restoreDescribedBy(activeTrigger);
        activeTrigger = trigger;
        tooltip.textContent = content;
        tooltip.hidden = false;
        tooltip.style.visibility = "hidden";
        tooltip.classList.remove("is-visible");
        setDescribedBy(trigger, tooltip);
        positionTooltip(tooltip, trigger, resolvePlacement(trigger, options), Number.isFinite(Number(options.gap)) ? Math.max(0, Number(options.gap)) : DEFAULT_GAP);
        tooltip.style.visibility = "";
        window.requestAnimationFrame(() => {
            if (activeTrigger === trigger) tooltip.classList.add("is-visible");
        });
        return tooltip;
    }

    function bind(root = document, options = {}) {
        if (!(root instanceof Document || root instanceof Element)) return null;
        if (boundRoots.has(root)) return boundRoots.get(root);

        const selector = options.selector || "[data-tooltip-auto]";
        const getTrigger = (target) => {
            const trigger = target instanceof Element ? target.closest(selector) : null;
            if (!trigger) return null;
            return root instanceof Document || root.contains(trigger) ? trigger : null;
        };
        const handleShow = (event) => {
            const trigger = getTrigger(event.target);
            if (trigger) show(trigger, options);
        };
        const handleMouseOut = (event) => {
            const trigger = getTrigger(event.target);
            if (!trigger || trigger.contains(event.relatedTarget)) return;
            hide(trigger);
        };
        const handleFocusOut = (event) => {
            const trigger = getTrigger(event.target);
            if (!trigger || trigger.contains(event.relatedTarget)) return;
            hide(trigger);
        };

        root.addEventListener("mouseover", handleShow);
        root.addEventListener("mouseout", handleMouseOut);
        root.addEventListener("focusin", handleShow);
        root.addEventListener("focusout", handleFocusOut);

        const binding = Object.freeze({
            destroy() {
                root.removeEventListener("mouseover", handleShow);
                root.removeEventListener("mouseout", handleMouseOut);
                root.removeEventListener("focusin", handleShow);
                root.removeEventListener("focusout", handleFocusOut);
                boundRoots.delete(root);
                hide();
            },
        });
        boundRoots.set(root, binding);
        return binding;
    }

    function init(root = document) {
        return bind(root, { selector: "[data-tooltip-auto]" });
    }

    window.AIOneTooltip = Object.freeze({ bind, hide, init, show });
    window.addEventListener("resize", () => hide(), { passive: true });
    document.addEventListener("scroll", () => hide(), true);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") hide();
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init(), { once: true });
    } else {
        init();
    }
})();

/* ============================ End: 툴팁 (Tooltip) ============================== */

/* ============================ Start: 드롭다운 메뉴 (Dropdown Menu) ============================ */

(() => {
    function getEnabledItems(menu) {
        return Array.from(menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]')).filter((item) => !item.disabled && item.getAttribute("aria-disabled") !== "true");
    }

    function setOpen(component, isOpen, focusTarget = "first") {
        const trigger = component?.querySelector("[data-dropdown-trigger]");
        const menu = component?.querySelector('[role="menu"]');
        if (!trigger || !menu) return;

        if (isOpen) {
            document.querySelectorAll("[data-dropdown-menu]").forEach((other) => {
                if (other !== component) setOpen(other, false);
            });
        }

        menu.hidden = !isOpen;
        trigger.setAttribute("aria-expanded", String(isOpen));
        component.classList.toggle("is-open", isOpen);

        if (isOpen) {
            const items = getEnabledItems(menu);
            const focusItem = focusTarget === "last" ? items.at(-1) : items[0];
            focusItem?.focus();
        }

        component.dispatchEvent(
            new CustomEvent("dropdownmenu:toggle", {
                bubbles: true,
                detail: { open: isOpen },
            }),
        );
    }

    function init(root = document) {
        const components = [];
        if (root instanceof Element && root.matches("[data-dropdown-menu]")) components.push(root);
        root.querySelectorAll?.("[data-dropdown-menu]").forEach((component) => components.push(component));

        components.forEach((component) => {
            if (component.dataset.dropdownMenuReady === "true") return;
            const trigger = component.querySelector("[data-dropdown-trigger]");
            const menu = component.querySelector('[role="menu"]');
            if (!trigger || !menu) return;

            menu.hidden = trigger.getAttribute("aria-expanded") !== "true";
            component.dataset.dropdownMenuReady = "true";
        });

        if (document.documentElement.dataset.dropdownMenuEventsReady === "true") return;

        document.addEventListener("click", (event) => {
            const trigger = event.target.closest("[data-dropdown-trigger]");
            const triggerComponent = trigger?.closest("[data-dropdown-menu]");
            if (trigger && triggerComponent) {
                const isOpen = trigger.getAttribute("aria-expanded") === "true";
                setOpen(triggerComponent, !isOpen);
                return;
            }

            const item = event.target.closest('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]');
            const itemComponent = item?.closest("[data-dropdown-menu]");
            if (item && itemComponent) {
                if (item.disabled || item.getAttribute("aria-disabled") === "true") return;
                if (item.matches('[role="menuitemradio"]')) {
                    item.closest('[role="menu"]')
                        ?.querySelectorAll('[role="menuitemradio"]')
                        .forEach((option) => option.setAttribute("aria-checked", String(option === item)));
                    const label = itemComponent.querySelector("[data-dropdown-label]");
                    if (label) label.textContent = item.dataset.menuLabel || item.textContent.trim();
                }
                if (item.matches('[role="menuitemcheckbox"]')) {
                    item.setAttribute("aria-checked", String(item.getAttribute("aria-checked") !== "true"));
                }
                itemComponent.dispatchEvent(
                    new CustomEvent("dropdownmenu:select", {
                        bubbles: true,
                        detail: {
                            value: item.dataset.menuValue || item.textContent.trim(),
                            item,
                        },
                    }),
                );
                if (!item.hasAttribute("data-menu-keep-open")) {
                    setOpen(itemComponent, false);
                    itemComponent.querySelector("[data-dropdown-trigger]")?.focus();
                }
                return;
            }

            document.querySelectorAll("[data-dropdown-menu].is-open").forEach((component) => setOpen(component, false));
        });

        document.addEventListener("keydown", (event) => {
            const trigger = event.target.closest("[data-dropdown-trigger]");
            const component = event.target.closest("[data-dropdown-menu]");
            if (!component) return;
            const menu = component.querySelector('[role="menu"]');
            if (!menu) return;

            if (trigger && ["ArrowDown", "ArrowUp"].includes(event.key)) {
                event.preventDefault();
                setOpen(component, true, event.key === "ArrowUp" ? "last" : "first");
                return;
            }

            const items = getEnabledItems(menu);
            const currentIndex = items.indexOf(document.activeElement);
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && currentIndex >= 0) {
                event.preventDefault();
                let nextIndex = currentIndex;
                if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
                if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
                if (event.key === "Home") nextIndex = 0;
                if (event.key === "End") nextIndex = items.length - 1;
                items[nextIndex]?.focus();
            }
            if (event.key === "Escape") {
                event.preventDefault();
                setOpen(component, false);
                component.querySelector("[data-dropdown-trigger]")?.focus();
            }
        });

        document.documentElement.dataset.dropdownMenuEventsReady = "true";
    }

    window.AIOneDropdownMenu = Object.freeze({ init, setOpen });
    document.addEventListener("DOMContentLoaded", () => init());
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* ============================ End: 드롭다운 메뉴 (Dropdown Menu) ============================== */

/* ============================ Start: 모달 (Modal) ============================ */

(() => {
    const MENU_GAP = 10;
    const VIEWPORT_MARGIN = 16;
    const PREPARING_SERVICE_MODAL_ID = "preparingServiceModal";
    const menuAnchors = new WeakMap();
    const baseController = window.AIOneLayerFactory.create({
        type: "modal",
        layerSelector: "[data-modal]",
        openAttribute: "data-modal-open",
        closeAttribute: "data-modal-close",
        closeOnLayerClick: true,
        focusOnOpen: false,
    });

    function ensurePreparingServiceModal() {
        return document.getElementById(PREPARING_SERVICE_MODAL_ID);
    }

    function resolveLayer(target) {
        if (target instanceof Element) return target;
        if (typeof target === "string") return document.querySelector(target);
        return null;
    }

    function isActionMenu(layer) {
        return layer?.classList.contains("modal-menu-backdrop") && Boolean(layer.querySelector(".custom-modal.modal-small"));
    }

    function positionActionMenu(layer, trigger) {
        if (!isActionMenu(layer) || !(trigger instanceof Element)) return;

        const dialog = layer.querySelector(".custom-modal.modal-small");
        const triggerRect = trigger.getBoundingClientRect();
        const dialogRect = dialog.getBoundingClientRect();
        const maxLeft = window.innerWidth - dialogRect.width - VIEWPORT_MARGIN;
        const maxTop = window.innerHeight - dialogRect.height - VIEWPORT_MARGIN;
        const belowPosition = triggerRect.bottom + MENU_GAP;
        const abovePosition = triggerRect.top - dialogRect.height - MENU_GAP;
        const left = Math.min(Math.max(VIEWPORT_MARGIN, triggerRect.right - dialogRect.width), Math.max(VIEWPORT_MARGIN, maxLeft));
        const top = belowPosition <= maxTop ? belowPosition : Math.max(VIEWPORT_MARGIN, abovePosition);

        layer.style.setProperty("--modal-menu-left", `${Math.round(left)}px`);
        layer.style.setProperty("--modal-menu-top", `${Math.round(top)}px`);
        layer.classList.add("is-anchored");
        menuAnchors.set(layer, trigger);
    }

    function repositionOpenMenus() {
        document.querySelectorAll(".modal-menu-backdrop:not([hidden])").forEach((layer) => {
            const trigger = menuAnchors.get(layer);
            if (trigger?.isConnected) positionActionMenu(layer, trigger);
        });
    }

    const controller = Object.freeze({
        init(root = document) {
            ensurePreparingServiceModal();
            baseController.init(root);
        },
        open(target, trigger = null) {
            const layer = resolveLayer(target);
            baseController.open(layer, trigger);
            if (trigger) positionActionMenu(layer, trigger);
        },
        close: baseController.close,
        ensurePreparingServiceModal,
    });

    window.AIOneModal = controller;
    document.addEventListener("DOMContentLoaded", () => controller.init());
    document.addEventListener("app:includes-ready", (event) => controller.init(event.target));
    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-modal-open]");
        if (!trigger) return;

        const layer = document.getElementById(trigger.getAttribute("data-modal-open"));
        if (isActionMenu(layer)) positionActionMenu(layer, trigger);
    });
    document.addEventListener("modal:close", (event) => {
        if (!isActionMenu(event.target)) return;
        menuAnchors.delete(event.target);
        event.target.classList.remove("is-anchored");
    });
    window.addEventListener("resize", repositionOpenMenus);
    document.addEventListener("scroll", repositionOpenMenus, true);
})();

(() => {
    function resolveLayer(target) {
        if (target instanceof Element) return target;
        if (typeof target === "string") return document.querySelector(target);
        return null;
    }

    function getVariant(layer) {
        return layer?.querySelector(".custom-modal[data-modal-variant]")?.getAttribute("data-modal-variant") || "";
    }

    function resolveUserCard(source, layer) {
        if (source instanceof Element) {
            if (source.matches(".user-card")) return source;
            const sourceCard = source.closest(".user-card");
            if (sourceCard) return sourceCard;
            const nestedCard = source.querySelector?.(".user-card");
            if (nestedCard) return nestedCard;
        }
        return layer?.closest(".app-sidebar, .sidebar")?.querySelector(".user-card") || null;
    }

    function getProfileValue(card, selector, fallback) {
        return card?.querySelector(selector)?.textContent?.trim() || fallback;
    }

    function syncProfile(target, source = null) {
        const layer = resolveLayer(target);
        if (!layer || getVariant(layer) !== "account-profile") return;

        const card = resolveUserCard(source, layer);
        const profile = {
            name: getProfileValue(card, ".user-name, .user-name-sm", "박재정 주무관"),
            department: getProfileValue(card, ".user-dept", "재정분석과"),
            role: getProfileValue(card, ".user-role-badge", "국회담당자"),
        };

        layer.querySelectorAll("[data-account-profile-name]").forEach((element) => {
            element.textContent = profile.name;
        });
        layer.querySelectorAll("[data-account-profile-dept]").forEach((element) => {
            element.textContent = profile.department;
        });
        layer.querySelectorAll("[data-account-profile-role]").forEach((element) => {
            element.textContent = profile.role;
        });
    }

    function initSettings(layer) {
        if (getVariant(layer) !== "account-settings") return;
        window.AIOnePreferences?.init(layer);
    }

    function prepare(target, source = null) {
        const layer = resolveLayer(target);
        if (!layer) return;

        const variant = getVariant(layer);
        if (variant === "account-profile") syncProfile(layer, source);
        if (variant === "account-settings") initSettings(layer);
    }

    function bindLayer(layer) {
        const variant = getVariant(layer);
        if (!["account-profile", "account-settings"].includes(variant)) return;
        if (layer.dataset.accountModalReady === "true") {
            prepare(layer);
            return;
        }

        layer.dataset.accountModalReady = "true";
        layer.addEventListener("modal:open", () => prepare(layer));
        prepare(layer);
    }

    function init(root = document) {
        if (root instanceof Element && root.matches("[data-modal]")) bindLayer(root);
        root.querySelectorAll?.("[data-modal]").forEach(bindLayer);
    }

    window.AIOneAccountModal = Object.freeze({
        init,
        prepare,
        syncProfile,
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init(), { once: true });
    } else {
        init();
    }

    document.addEventListener("app:includes-ready", (event) => init(event.target));
    document.addEventListener("component:ready", (event) => {
        if (event.detail?.name === "modal") init(event.target);
    });
    document.addEventListener("ai-one-preferences:ready", () => init());
})();

(() => {
    const STORAGE_KEY = "ai-one-notification-assignees-v1";
    const staffNames = [
        "이수빈",
        "정우진",
        "문가영",
        "김민지",
        "박도윤",
        "이서현",
        "최지훈",
        "정하윤",
        "오세진",
        "한유진",
        "송민재",
        "윤서아",
        "장현우",
        "배지민",
        "임수호",
        "이준호",
        "정민지",
        "강현우",
        "김하린",
        "백승우",
        "조서윤",
        "최예원",
        "김성민",
        "장다은",
        "박준서",
        "이하연",
        "윤민호",
        "서지원",
        "한승민",
        "임유나",
        "강지호",
        "송혜진",
        "우민석",
        "김도현",
        "박하늘",
        "조유진",
        "정하연",
        "박성진",
        "이예원",
        "최민준",
    ];

    function createStaff(department, offset) {
        const safeKey = department.replace(/[^가-힣a-zA-Z0-9]/g, "-");
        return [0, 1, 2].map((index) => ({
            id: `${safeKey}-${offset + index}`,
            name: staffNames[(offset + index) % staffNames.length],
            position: index === 0 ? "사무관" : "주무관",
        }));
    }

    const departmentDirectory = [
        { organization: "부총리 직속", department: "대변인", subunits: ["홍보담당관"], staff: createStaff("대변인", 0) },
        { organization: "부총리 직속", department: "감사관", subunits: ["감사담당관"], staff: createStaff("감사관", 3) },
        { organization: "부총리 직속", department: "입법심의관", subunits: [], staff: createStaff("입법심의관", 6) },
        { organization: "부총리 직속", department: "전략기획관", subunits: [], staff: createStaff("전략기획관", 9) },
        { organization: "부총리 직속", department: "장관정책보좌관", subunits: [], staff: createStaff("장관정책보좌관", 12) },
        { organization: "제1차관 직속", department: "인사과", subunits: [], staff: createStaff("인사과", 15) },
        { organization: "제1차관 직속", department: "운영지원과", subunits: [], staff: createStaff("운영지원과", 18) },
        { organization: "제1차관 직속", department: "차관보", subunits: [], staff: createStaff("차관보", 21) },
        { organization: "제1차관 소관", department: "경제정책국", subunits: ["거시경제심의관", "종합정책과", "경제분석과"], staff: createStaff("경제정책국", 24) },
        { organization: "제1차관 소관", department: "민생경제국", subunits: ["물가정책과", "인력정책과", "복지경제과"], staff: createStaff("민생경제국", 27) },
        { organization: "제1차관 소관", department: "경제구조개혁국", subunits: ["노동시장경제과", "연금보건경제과", "청년정책과"], staff: createStaff("경제구조개혁국", 30) },
        { organization: "제1차관 소관", department: "혁신성장실", subunits: ["정책조정관", "산업경제과", "서비스경제과"], staff: createStaff("혁신성장실", 33) },
        { organization: "제1차관 소관", department: "세제실", subunits: ["조세정책과", "소득세제과", "법인세제과"], staff: createStaff("세제실", 36) },
        { organization: "제1차관 추진단", department: "초혁신경제추진단", subunits: ["기획총괄과", "전략지원과"], staff: createStaff("초혁신경제추진단", 39) },
        { organization: "제1차관 추진단", department: "조세개혁추진단", subunits: ["총괄기획팀", "보유세개편팀"], staff: createStaff("조세개혁추진단", 42) },
        { organization: "제1차관 추진단", department: "수출플러스지원단", subunits: ["총괄기획팀", "글로벌진출팀"], staff: createStaff("수출플러스지원단", 45) },
        { organization: "제2차관 직속", department: "정책금융기획관", subunits: [], staff: createStaff("정책금융기획관", 48) },
        { organization: "제2차관 직속", department: "금융입법담당관", subunits: [], staff: createStaff("금융입법담당관", 51) },
        { organization: "제2차관 직속", department: "공공금융담당관", subunits: [], staff: createStaff("공공금융담당관", 54) },
        { organization: "제2차관 소관", department: "기획조정실", subunits: ["정책기획관", "기획재정담당관"], staff: createStaff("기획조정실", 57) },
        { organization: "제2차관 소관", department: "국고실", subunits: ["국고정책관", "국채정책과", "회계결산과"], staff: createStaff("국고실", 60) },
        { organization: "제2차관 소관", department: "국제경제관리관", subunits: ["국제금융국", "대외경제국"], staff: createStaff("국제경제관리관", 63) },
        { organization: "제2차관 소관", department: "국제금융국", subunits: ["국제금융과", "외화자금과", "외환제도과"], staff: createStaff("국제금융국", 66) },
        { organization: "제2차관 소관", department: "대외경제국", subunits: ["대외경제총괄과", "통상정책과"], staff: createStaff("대외경제국", 69) },
        { organization: "제2차관 소관", department: "개발금융국", subunits: ["개발금융총괄과", "국제기구과"], staff: createStaff("개발금융국", 72) },
        { organization: "제2차관 소관", department: "공공정책국", subunits: ["공공정책총괄과", "평가분석과"], staff: createStaff("공공정책국", 75) },
    ];
    const organizationOrder = [...new Set(departmentDirectory.map((group) => group.organization))];

    function escapeHtml(value) {
        return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    }

    function createDefaultAssignments() {
        return new Map(departmentDirectory.map((group) => [group.department, new Set(group.staff.slice(0, 2).map((person) => person.id))]));
    }

    function cloneAssignments(source) {
        return new Map(Array.from(source, ([department, ids]) => [department, new Set(ids)]));
    }

    function loadAssignments() {
        const defaults = createDefaultAssignments();
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            if (!stored || typeof stored !== "object" || Array.isArray(stored)) return defaults;
            departmentDirectory.forEach((group) => {
                if (!Array.isArray(stored[group.department])) return;
                const validIds = new Set(group.staff.map((person) => person.id));
                defaults.set(group.department, new Set(stored[group.department].filter((id) => validIds.has(id))));
            });
        } catch (error) {
            return defaults;
        }
        return defaults;
    }

    let savedAssignments = loadAssignments();

    function persistAssignments() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(Array.from(savedAssignments, ([department, ids]) => [department, [...ids]]))));
        } catch (error) {
            /* localStorage를 사용할 수 없는 환경에서는 현재 화면 상태만 유지합니다. */
        }
    }

    function getRecipients(department) {
        const group = departmentDirectory.find((item) => item.department === department);
        const selectedIds = savedAssignments.get(department) || new Set();
        return group ? group.staff.filter((person) => selectedIds.has(person.id)).map((person) => `${person.name} ${person.position}`) : [];
    }

    function getAssignments() {
        return Object.fromEntries(departmentDirectory.map((group) => [group.department, getRecipients(group.department)]));
    }

    function updateTriggerState(layer) {
        if (!layer.id) return;
        const configuredCount = departmentDirectory.filter((group) => getRecipients(group.department).length > 0).length;
        document.querySelectorAll("[data-modal-open]").forEach((button) => {
            if (button.dataset.modalOpen !== layer.id) return;
            button.classList.toggle("has-assignee", configuredCount > 0);
            button.title = "실국별 알림 담당자 설정";
        });
    }

    function initializeModal(panel) {
        if (panel.dataset.notificationAssigneeReady === "true") return;

        const layer = panel.closest("[data-modal]") || panel;
        const orgList = panel.querySelector("[data-notification-org-list]");
        const deptSearch = panel.querySelector("[data-notification-dept-search]");
        const searchClear = panel.querySelector("[data-notification-search-clear]");
        const deptResult = panel.querySelector("[data-notification-dept-result]");
        const grid = panel.querySelector("[data-notification-dept-grid]");
        const feedback = panel.querySelector("[data-notification-feedback]");
        if (!orgList || !deptSearch || !searchClear || !deptResult || !grid) return;
        const hasAuthoredDirectory = orgList.children.length > 0 && grid.children.length > 0;

        let workingAssignments = cloneAssignments(savedAssignments);
        let selectedOrganization = "all";
        let searchTerm = "";
        const expandedOrganizations = new Set(organizationOrder.slice(0, 1));

        function setFeedback(message = "", type = "") {
            if (!feedback) return;
            feedback.textContent = message;
            feedback.className = `notification-dept-feedback${type ? ` ${type}` : ""}`;
        }

        function getVisibleDepartments() {
            const normalizedTerm = searchTerm.trim().toLocaleLowerCase("ko-KR");
            return departmentDirectory.filter((group) => {
                const organizationMatched =
                    selectedOrganization === "all" ||
                    (selectedOrganization.startsWith("org:") && group.organization === selectedOrganization.slice(4)) ||
                    (selectedOrganization.startsWith("dept:") && group.department === selectedOrganization.slice(5));
                if (!organizationMatched) return false;
                if (!normalizedTerm) return true;
                return [group.organization, group.department, ...group.subunits, ...group.staff.flatMap((person) => [person.name, person.position])].join(" ").toLocaleLowerCase("ko-KR").includes(normalizedTerm);
            });
        }

        function renderOrganizationList() {
            const allSelected = selectedOrganization === "all";
            const allItem = `<button type="button" class="notification-org-item${allSelected ? " selected" : ""}"
				data-notification-organization="all" aria-pressed="${allSelected}">
				<span>전체 조직</span><strong>${departmentDirectory.length}</strong>
			</button>`;
            const tree = organizationOrder
                .map((organization) => {
                    const groups = departmentDirectory.filter((group) => group.organization === organization);
                    const organizationKey = `org:${organization}`;
                    const expanded = expandedOrganizations.has(organization);
                    const selected = selectedOrganization === organizationKey;
                    return `<div class="notification-tree-group${expanded ? " expanded" : ""}">
					<button type="button" class="notification-tree-parent${selected ? " selected" : ""}"
						data-notification-tree-org="${escapeHtml(organization)}" aria-expanded="${expanded}" aria-pressed="${selected}">
						<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
						<span>${escapeHtml(organization)}</span><strong>${groups.length}</strong>
					</button>
					<div class="notification-tree-children${expanded ? "" : " hidden"}">
						${groups
                            .map((group) => {
                                const selectedDepartment = selectedOrganization === `dept:${group.department}`;
                                return `<button type="button" class="notification-tree-leaf${selectedDepartment ? " selected" : ""}"
								data-notification-tree-dept="${escapeHtml(group.department)}" aria-pressed="${selectedDepartment}">
								<span>${escapeHtml(group.department)}</span>
							</button>`;
                            })
                            .join("")}
					</div>
				</div>`;
                })
                .join("");
            orgList.innerHTML = allItem + tree;
        }

        function renderDepartmentSettings() {
            renderOrganizationList();
            const visibleDepartments = getVisibleDepartments();
            const organizationLabel = selectedOrganization === "all" ? "전체 조직" : selectedOrganization.slice(selectedOrganization.indexOf(":") + 1);
            deptResult.textContent = `${organizationLabel} · ${visibleDepartments.length}개 조직`;
            searchClear.hidden = !searchTerm;

            if (!visibleDepartments.length) {
                grid.innerHTML = `<div class="notification-dept-empty">
					<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>
					<strong>조건에 맞는 실국이 없습니다.</strong>
					<span>다른 조직을 선택하거나 검색어를 변경해 주세요.</span>
				</div>`;
                return;
            }

            grid.innerHTML = visibleDepartments
                .map((group) => {
                    const selectedIds = workingAssignments.get(group.department) || new Set();
                    return `<section class="notification-dept-card" data-notification-department="${escapeHtml(group.department)}">
					<div class="notification-dept-card-head">
						<div class="notification-dept-heading">
							<span class="notification-dept-org">${escapeHtml(group.organization)}</span>
							<div class="notification-dept-name">${escapeHtml(group.department)}</div>
						</div>
						<span class="notification-dept-count">${selectedIds.size}명</span>
					</div>
					${
                        group.subunits.length
                            ? `<div class="notification-dept-subunits">
						<div class="notification-subunit-head"><span>소속 과</span><strong>${group.subunits.length}</strong></div>
						<div class="notification-subunit-list">${group.subunits.map((unit) => `<span title="${escapeHtml(unit)}">${escapeHtml(unit)}</span>`).join("")}</div>
					</div>`
                            : ""
                    }
					<div class="notification-dept-staff-list">
						${group.staff
                            .map((person) => {
                                const selected = selectedIds.has(person.id);
                                return `<button type="button" class="notification-dept-staff${selected ? " selected" : ""}"
								data-notification-person-id="${escapeHtml(person.id)}" aria-pressed="${selected}">
								<span class="notification-assignee-avatar">${escapeHtml(person.name.slice(0, 1))}</span>
								<span class="notification-assignee-info">
									<span class="notification-assignee-name">${escapeHtml(person.name)} ${escapeHtml(person.position)}</span>
									<span class="notification-assignee-meta">${escapeHtml(group.department)}${selected ? " · 실국담당자" : ""}</span>
								</span>
								<span class="notification-check" aria-hidden="true">${selected ? "✓" : ""}</span>
							</button>`;
                            })
                            .join("")}
					</div>
				</section>`;
                })
                .join("");
        }

        orgList.addEventListener("click", (event) => {
            const allButton = event.target.closest('[data-notification-organization="all"]');
            if (allButton) {
                selectedOrganization = "all";
                setFeedback();
                renderDepartmentSettings();
                return;
            }

            const organizationButton = event.target.closest("[data-notification-tree-org]");
            if (organizationButton) {
                const organization = organizationButton.dataset.notificationTreeOrg;
                if (expandedOrganizations.has(organization)) expandedOrganizations.delete(organization);
                else expandedOrganizations.add(organization);
                selectedOrganization = `org:${organization}`;
                setFeedback();
                renderDepartmentSettings();
                return;
            }

            const departmentButton = event.target.closest("[data-notification-tree-dept]");
            if (!departmentButton) return;
            selectedOrganization = `dept:${departmentButton.dataset.notificationTreeDept}`;
            setFeedback();
            renderDepartmentSettings();
        });

        grid.addEventListener("click", (event) => {
            const personButton = event.target.closest("[data-notification-person-id]");
            const card = personButton?.closest("[data-notification-department]");
            if (!personButton || !card) return;
            const department = card.dataset.notificationDepartment;
            const selectedIds = workingAssignments.get(department) || new Set();
            const personId = personButton.dataset.notificationPersonId;
            if (selectedIds.has(personId)) selectedIds.delete(personId);
            else selectedIds.add(personId);
            workingAssignments.set(department, selectedIds);
            setFeedback(`${department} 담당자 ${selectedIds.size}명이 지정되었습니다.`, "success");
            renderDepartmentSettings();
        });

        deptSearch.addEventListener("input", () => {
            searchTerm = deptSearch.value;
            renderDepartmentSettings();
        });

        searchClear.addEventListener("click", () => {
            searchTerm = "";
            deptSearch.value = "";
            deptSearch.focus();
            renderDepartmentSettings();
        });

        panel.querySelector("[data-notification-save]")?.addEventListener("click", () => {
            savedAssignments = cloneAssignments(workingAssignments);
            persistAssignments();
            updateTriggerState(layer);
            const assigneeCount = departmentDirectory.reduce((count, group) => count + getRecipients(group.department).length, 0);
            panel.dispatchEvent(
                new CustomEvent("notification-assignee:save", {
                    bubbles: true,
                    detail: {
                        departmentCount: departmentDirectory.length,
                        assigneeCount,
                        assignments: getAssignments(),
                    },
                }),
            );
        });

        function resetWorkingState({ preserveAuthoredDirectory = false } = {}) {
            workingAssignments = cloneAssignments(savedAssignments);
            selectedOrganization = "all";
            searchTerm = "";
            expandedOrganizations.clear();
            if (organizationOrder[0]) expandedOrganizations.add(organizationOrder[0]);
            deptSearch.value = "";
            setFeedback();
            if (!preserveAuthoredDirectory) renderDepartmentSettings();
            updateTriggerState(layer);
        }

        layer.addEventListener("modal:open", resetWorkingState);
        panel.dataset.notificationAssigneeReady = "true";
        resetWorkingState({ preserveAuthoredDirectory: hasAuthoredDirectory });
    }

    function init(root = document) {
        if (root.matches?.("[data-notification-assignee]")) initializeModal(root);
        root.querySelectorAll?.("[data-notification-assignee]").forEach(initializeModal);
    }

    window.AIOneNotificationAssignee = Object.freeze({
        init,
        getRecipients,
        getAssignments,
    });
    document.addEventListener("DOMContentLoaded", () => init());
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* ============================ End: 모달 (Modal) ============================== */

/* ============================ Start: 사이드바 (Sidebar) ============================ */

(() => {
    const MENU_COMPLETION_KEY = "ai-one-menu-completion-state";
    const SIDEBAR_SELECTOR = ".app-sidebar, .sidebar";
    const RESPONSIVE_RAIL_QUERY = "(max-width: 1024px)";
    let pendingModalRequest = null;
    let collapsedHomeNavigationReady = false;
    let userProfileTooltipSequence = 0;
    let menuCompletionState = readMenuCompletionState();
    const accountMenuStates = new WeakMap();
    const sidebarControllerStates = new WeakMap();
    const userProfileTooltipStates = new WeakMap();

    // 사이드바 메뉴 작업 완료 상태
    function readMenuCompletionState() {
        try {
            const saved = JSON.parse(localStorage.getItem(MENU_COMPLETION_KEY) || "{}");
            return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
        } catch (error) {
            return {};
        }
    }

    function persistMenuCompletionState() {
        try {
            localStorage.setItem(MENU_COMPLETION_KEY, JSON.stringify(menuCompletionState));
        } catch (error) {
            /* 현재 화면에만 적용 */
        }
    }

    function resolveMenuKeyFromLink(link) {
        if (!link) return "";
        if (link.dataset.page) return link.dataset.page;

        const href = link.getAttribute("href") || "";
        if (href.includes("ai-intake")) return "intake";
        if (href.includes("ai-answer")) return "answer";
        if (href.includes("ai-chatbot")) return "chatbot";
        if (href.includes("ai-economy")) return "economy";
        if (href.includes("ai-home")) return "home";
        return "";
    }

    function getNavLinks(root = document) {
        if (root instanceof Element && root.matches(SIDEBAR_SELECTOR)) {
            return Array.from(root.querySelectorAll(".nav-link"));
        }

        return Array.from(root.querySelectorAll?.(".app-sidebar .nav-link, .sidebar .nav-link") || []);
    }

    function isNotificationEnabled() {
        return window.AIOneNotifications?.isEnabled?.() ?? true;
    }

    function renderCompletionDots(root = document) {
        getNavLinks(root).forEach((link) => {
            const menuKey = resolveMenuKeyFromLink(link);
            if (!menuKey) return;

            let dot = link.querySelector(".nav-complete-dot");
            if (!dot) return;

            const isVisible = isNotificationEnabled() && Boolean(menuCompletionState[menuKey]);
            dot.classList.toggle("hidden", !isVisible);
            link.classList.toggle("has-complete-status", isVisible);

            if (link.dataset.completionBound === "true") return;
            link.dataset.completionBound = "true";
            link.addEventListener("click", () => {
                const key = resolveMenuKeyFromLink(link);
                if (!key || !menuCompletionState[key]) return;

                delete menuCompletionState[key];
                persistMenuCompletionState();
                renderCompletionDots();
            });
        });
    }

    function markCompletion(menuKey) {
        if (!isNotificationEnabled() || !menuKey) return;

        menuCompletionState[menuKey] = { completedAt: Date.now() };
        persistMenuCompletionState();
        renderCompletionDots();
    }

    function clearCompletion() {
        menuCompletionState = {};
        persistMenuCompletionState();
        renderCompletionDots();
    }

    // 축소 사이드바에서 홈 메뉴로 이동할 때 접힘 상태 해제
    function initCollapsedHomeNavigation() {
        if (collapsedHomeNavigationReady) return;
        collapsedHomeNavigationReady = true;

        document.addEventListener(
            "click",
            (event) => {
                const homeLink = event.target.closest('.app-sidebar .nav-link[data-page="home"], .sidebar .nav-link[data-page="home"]');
                if (!homeLink) return;

                const sidebar = homeLink.closest(SIDEBAR_SELECTOR);
                if (!sidebar?.classList.contains("collapsed")) return;

                setSidebarCollapsed(sidebar, false);
                window.AIOneTooltip?.hide();
            },
            true,
        );
    }

    // 사이드바 사용자 아바타 기본정보 툴팁
    function hideUserProfileTooltip(card) {
        const tooltip = userProfileTooltipStates.get(card);
        if (!tooltip) return;

        tooltip.classList.remove("show");
        window.setTimeout(() => {
            if (!tooltip.classList.contains("show")) tooltip.classList.add("hidden");
        }, 120);
    }

    function bindUserProfileTooltip(card, accountMenu = card?.querySelector(".user-account-menu")) {
        if (!card || card.dataset.profileTooltipReady === "true") return;

        const avatar = card.querySelector(".user-avatar");
        if (!avatar) return;

        card.dataset.profileTooltipReady = "true";
        const userName = card.querySelector(".user-name, .user-name-sm")?.textContent?.trim() || "박재정 주무관";
        const userDepartment = card.querySelector(".user-dept")?.textContent?.trim() || "재정분석과";
        const userRole = card.querySelector(".user-role-badge")?.textContent?.trim() || "국회담당자";
        const tooltip = document.getElementById("userProfileHoverTooltip");
        if (!tooltip) return;
        const name = tooltip.querySelector("[data-profile-name]");
        const department = tooltip.querySelector("[data-profile-department]");
        const role = tooltip.querySelector("[data-profile-role]");
        tooltip.id = `userProfileTooltip${++userProfileTooltipSequence}`;
        name.textContent = userName;
        department.textContent = userDepartment;
        role.textContent = userRole;
        userProfileTooltipStates.set(card, tooltip);
        avatar.setAttribute("aria-describedby", tooltip.id);

        const showTooltip = () => {
            const isAccountMenuOpen = accountMenu && !accountMenu.hidden && !accountMenu.classList.contains("hidden");
            if (isAccountMenuOpen) return;

            const rect = avatar.getBoundingClientRect();
            tooltip.classList.remove("hidden");
            tooltip.style.visibility = "hidden";
            const width = tooltip.offsetWidth;
            const height = tooltip.offsetHeight;
            const left = Math.min(rect.right + 10, window.innerWidth - width - 10);
            const top = Math.max(10, Math.min(rect.top + rect.height / 2 - height / 2, window.innerHeight - height - 10));
            tooltip.style.left = `${Math.max(10, left)}px`;
            tooltip.style.top = `${top}px`;
            tooltip.style.visibility = "";
            window.requestAnimationFrame(() => tooltip.classList.add("show"));
        };

        avatar.addEventListener("mouseenter", showTooltip);
        avatar.addEventListener("mouseleave", () => hideUserProfileTooltip(card));
        avatar.addEventListener("focus", showTooltip);
        avatar.addEventListener("blur", () => hideUserProfileTooltip(card));
        window.addEventListener("resize", () => hideUserProfileTooltip(card));
        document.addEventListener("scroll", () => hideUserProfileTooltip(card), true);
    }

    function logout() {
        try {
            localStorage.removeItem("sidebar-collapsed");
        } catch (error) {
            /* 현재 화면 상태만 정리 */
        }
        window.location.href = new URL("login.html", document.baseURI).href;
    }

    // 사용자 계정 메뉴와 연결된 모달
    function positionDetachedAccountMenu(state) {
        if (!state?.isDetached || !state.userCard || state.menu.hidden) return;

        const viewportGap = 8;
        const menuGap = 8;
        const anchorRect = state.userCard.getBoundingClientRect();
        const menuRect = state.menu.getBoundingClientRect();
        const maxLeft = Math.max(viewportGap, window.innerWidth - menuRect.width - viewportGap);
        const left = Math.max(viewportGap, Math.min(anchorRect.left, maxLeft));
        const preferredTop = anchorRect.top - menuRect.height - menuGap;
        const fallbackTop = anchorRect.bottom + menuGap;
        const maxTop = Math.max(viewportGap, window.innerHeight - menuRect.height - viewportGap);
        const top = preferredTop >= viewportGap ? preferredTop : Math.min(fallbackTop, maxTop);

        state.menu.style.left = `${Math.round(left)}px`;
        state.menu.style.top = `${Math.round(Math.max(viewportGap, top))}px`;
    }

    function setAccountMenuOpen(sidebar, isOpen, trigger = null, options = {}) {
        const state = accountMenuStates.get(sidebar);
        if (!state) return;

        if (isOpen) hideUserProfileTooltip(state.userCard);
        state.menu.hidden = !isOpen;
        state.menu.classList.toggle("hidden", !isOpen);
        state.triggers.forEach((item) => item.setAttribute("aria-expanded", String(isOpen)));
        if (isOpen) {
            state.openMode = options.mode || "programmatic";
            if (trigger) state.lastTrigger = trigger;
            positionDetachedAccountMenu(state);
            if (options.focusFirst) {
                window.requestAnimationFrame(() => state.menu.querySelector('[role="menuitem"]')?.focus());
            }
        } else {
            state.openMode = null;
        }
    }

    function openModal(trigger) {
        const targetId = trigger?.getAttribute("data-modal-open");
        const modal = targetId ? document.getElementById(targetId) : null;
        const sidebar = trigger?.closest(".app-sidebar");
        if (sidebar) setAccountMenuOpen(sidebar, false);
        if (!modal || !window.AIOneModal) {
            pendingModalRequest = targetId ? { targetId, trigger } : null;
            return false;
        }

        pendingModalRequest = null;
        window.AIOneAccountModal?.prepare(modal, sidebar || trigger);
        window.AIOneModal.open(modal, trigger);
        return true;
    }

    function flushPendingModalRequest() {
        if (!pendingModalRequest) return;
        if (!pendingModalRequest.trigger?.isConnected) {
            pendingModalRequest = null;
            return;
        }
        openModal(pendingModalRequest.trigger);
    }

    function bindAccountMenu(sidebar) {
        const menu = sidebar.querySelector(".user-account-menu");
        const triggers = Array.from(sidebar.querySelectorAll("[data-sidebar-account-toggle]"));
        if (!menu || !triggers.length) return;

        const nestedUserCard = menu.closest(".user-card");
        const userCard = nestedUserCard || sidebar.querySelector(".user-card");
        const isDetached = menu.dataset.sidebarAccountMenu === "detached" || !nestedUserCard;
        const state = {
            menu,
            triggers,
            lastTrigger: null,
            userCard,
            isDetached,
            openMode: null,
        };

        menu.classList.toggle("user-account-menu-detached", isDetached);
        accountMenuStates.set(sidebar, state);

        if (userCard) {
            userCard.dataset.accountMenuReady = "true";
            const summaryName = menu.querySelector(".user-account-summary strong");
            const summaryDepartment = menu.querySelector(".user-account-summary span");
            if (summaryName) {
                summaryName.textContent = userCard.querySelector(".user-name, .user-name-sm")?.textContent?.trim() || summaryName.textContent;
            }
            if (summaryDepartment) {
                summaryDepartment.textContent = userCard.querySelector(".user-dept")?.textContent?.trim() || summaryDepartment.textContent;
            }
        }

        triggers.forEach((trigger) => {
            trigger.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                const shouldOpen = menu.hidden;
                setAccountMenuOpen(sidebar, shouldOpen, trigger, {
                    mode: "click",
                    focusFirst: shouldOpen,
                });
            });
        });

        menu.addEventListener("click", (event) => {
            const actionButton = event.target.closest("[data-sidebar-account-action]");
            if (!actionButton) return;

            event.preventDefault();
            event.stopPropagation();
            setAccountMenuOpen(sidebar, false);
            if (actionButton.hasAttribute("data-modal-open")) openModal(actionButton);
        });

        document.addEventListener("click", (event) => {
            if (event.target.closest(".user-account-menu, [data-sidebar-account-toggle]")) return;
            setAccountMenuOpen(sidebar, false);
        });

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape" || menu.hidden) return;
            setAccountMenuOpen(sidebar, false);
            state.lastTrigger?.focus();
        });

        const reposition = () => {
            if (!menu.hidden) positionDetachedAccountMenu(state);
        };
        window.addEventListener("resize", reposition);
        document.addEventListener("scroll", reposition, true);
    }

    // 축소 사이드바 내비게이션 툴팁
    function bindNavTooltips(sidebar) {
        if (!sidebar || sidebar.dataset.navTooltipsReady === "true" || !window.AIOneTooltip) return;

        window.AIOneTooltip.bind(sidebar, {
            selector: ".nav-link",
            placement: "right",
            enabled: () => sidebar.classList.contains("collapsed"),
            content: (link) => link.dataset.tooltip || link.querySelector(".nav-text")?.textContent?.trim() || link.getAttribute("aria-label"),
        });
        sidebar.dataset.navTooltipsReady = "true";
    }

    function setActiveSidebarRoute(sidebar, activePage) {
        if (!activePage) return;

        sidebar.querySelectorAll(".nav-link").forEach((link) => {
            const isActive = link.dataset.page === activePage;
            link.classList.toggle("active", isActive);
            if (isActive) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
    }

    function readSidebarCollapsedState(storageKey, fallback) {
        if (!storageKey) return fallback;
        try {
            return localStorage.getItem(storageKey) === "true" ? true : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function persistSidebarCollapsedState(storageKey, isCollapsed) {
        if (!storageKey) return;
        try {
            if (isCollapsed) localStorage.setItem(storageKey, "true");
            else localStorage.removeItem(storageKey);
        } catch (error) {
            /* 저장소를 사용할 수 없어도 현재 화면의 상태 변경은 유지 */
        }
    }

    function syncSidebarResponsiveRail(sidebar) {
        const state = sidebarControllerStates.get(sidebar);
        if (!state?.responsiveMediaQuery) return;

        const shouldUseRail = state.config.responsiveRail !== false && state.responsiveMediaQuery.matches;

        if (shouldUseRail) {
            if (!state.responsiveRailActive) {
                state.desktopCollapsed = sidebar.classList.contains("collapsed");
            }
            state.responsiveRailActive = true;
            sidebar.dataset.sidebarResponsiveRail = "true";
            setSidebarCollapsed(sidebar, true, { persist: false });
            return;
        }

        delete sidebar.dataset.sidebarResponsiveRail;
        if (!state.responsiveRailActive) return;

        state.responsiveRailActive = false;
        setSidebarCollapsed(sidebar, Boolean(state.desktopCollapsed), { persist: false });
    }

    function bindSidebarResponsiveRail(sidebar) {
        const state = sidebarControllerStates.get(sidebar);
        if (!state || typeof window.matchMedia !== "function") return;

        const query = state.config.responsiveRailQuery || RESPONSIVE_RAIL_QUERY;
        if (!state.responsiveMediaQuery || state.responsiveMediaQuery.media !== query) {
            if (state.responsiveMediaQuery && state.responsiveMediaListener) {
                state.responsiveMediaQuery.removeEventListener?.("change", state.responsiveMediaListener);
                state.responsiveMediaQuery.removeListener?.(state.responsiveMediaListener);
            }

            state.responsiveMediaQuery = window.matchMedia(query);
            state.responsiveMediaListener = () => syncSidebarResponsiveRail(sidebar);
            state.responsiveMediaQuery.addEventListener?.("change", state.responsiveMediaListener);
            if (!state.responsiveMediaQuery.addEventListener) {
                state.responsiveMediaQuery.addListener?.(state.responsiveMediaListener);
            }
        }

        syncSidebarResponsiveRail(sidebar);
    }

    function setSidebarCollapsed(sidebar, isCollapsed, options = {}) {
        if (typeof sidebar === "string") sidebar = document.querySelector(sidebar);
        if (!sidebar) return false;

        const state = sidebarControllerStates.get(sidebar);
        const collapsed = Boolean(isCollapsed);
        const config = state?.config || {};
        const stateTarget = config.stateTarget;
        if (state && !state.responsiveRailActive) state.desktopCollapsed = collapsed;

        sidebar.classList.toggle("collapsed", collapsed);
        if (stateTarget) {
            if (config.collapsedClass) stateTarget.classList.toggle(config.collapsedClass, collapsed);
            if (config.expandedClass) stateTarget.classList.toggle(config.expandedClass, !collapsed);
        }

        const collapseButton = sidebar.querySelector("#sidebarCollapseBtn");
        if (collapseButton) {
            const label = collapsed ? "사이드바 펼치기" : "사이드바 접기";
            collapseButton.setAttribute("aria-expanded", String(!collapsed));
            collapseButton.setAttribute("aria-label", label);
            collapseButton.title = label;
        }

        const brandButton = sidebar.querySelector("#sidebarBrandButton, .sidebar-brand");
        if (brandButton) {
            const label = collapsed ? "사이드바 펼치기" : "AI-ONE 홈";
            brandButton.setAttribute("aria-label", label);
            brandButton.title = label;
        }

        if (options.persist !== false && !state?.responsiveRailActive) {
            persistSidebarCollapsedState(config.storageKey, collapsed);
        }
        if (collapsed) window.AIOneTooltip?.hide();
        config.onChange?.(collapsed, sidebar);
        sidebar.dispatchEvent(
            new CustomEvent("sidebar:collapse-change", {
                bubbles: true,
                detail: { collapsed },
            }),
        );
        return collapsed;
    }

    function configureSidebar(sidebar, options = {}) {
        if (typeof sidebar === "string") sidebar = document.querySelector(sidebar);
        if (!sidebar) return null;

        bindSidebar(sidebar);
        const state = sidebarControllerStates.get(sidebar) || {};
        state.config = {
            activePage: options.activePage || document.body?.dataset.page || "",
            initialCollapsed: options.initialCollapsed ?? sidebar.classList.contains("collapsed"),
            stateTarget: options.stateTarget || null,
            collapsedClass: options.collapsedClass || "",
            expandedClass: options.expandedClass || "",
            storageKey: options.storageKey || "",
            collapseOnNavigate: Boolean(options.collapseOnNavigate),
            responsiveRail: options.responsiveRail !== false,
            responsiveRailQuery: options.responsiveRailQuery || RESPONSIVE_RAIL_QUERY,
            onChange: typeof options.onChange === "function" ? options.onChange : null,
        };
        sidebarControllerStates.set(sidebar, state);
        setActiveSidebarRoute(sidebar, state.config.activePage);

        if (sidebar.dataset.collapseControllerReady !== "true") {
            sidebar.dataset.collapseControllerReady = "true";
            sidebar.querySelector("#sidebarCollapseBtn")?.addEventListener("click", (event) => {
                event.stopPropagation();
                setSidebarCollapsed(sidebar, !sidebar.classList.contains("collapsed"));
            });
            sidebar.querySelector("#sidebarBrandButton, .sidebar-brand")?.addEventListener("click", (event) => {
                if (!sidebar.classList.contains("collapsed")) return;
                event.preventDefault();
                setSidebarCollapsed(sidebar, false);
            });
            sidebar.addEventListener("click", (event) => {
                const link = event.target.closest(".nav-link");
                if (!link || !sidebar.contains(link)) return;

                const currentConfig = sidebarControllerStates.get(sidebar)?.config;
                if (!currentConfig?.collapseOnNavigate || link.dataset.page === "home" || link.dataset.soonTarget || link.getAttribute("aria-disabled") === "true") return;
                setSidebarCollapsed(sidebar, true);
            });
        }

        const initialCollapsed = readSidebarCollapsedState(state.config.storageKey, Boolean(state.config.initialCollapsed));
        setSidebarCollapsed(sidebar, initialCollapsed, { persist: false });
        bindSidebarResponsiveRail(sidebar);
        return sidebar;
    }

    // 사이드바 초기화와 공개 API
    function bindSidebar(sidebar) {
        renderCompletionDots(sidebar);
        if (!sidebar || sidebar.dataset.modalTriggersReady === "true") return;

        sidebar.dataset.modalTriggersReady = "true";
        bindNavTooltips(sidebar);
        bindUserProfileTooltip(sidebar.querySelector(".user-card"), sidebar.querySelector(".user-account-menu"));
        bindAccountMenu(sidebar);
        sidebar.querySelectorAll("[data-modal-open]:not([data-sidebar-account-action])").forEach((trigger) => {
            trigger.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                openModal(trigger);
            });
        });
    }

    function init(root = document) {
        initCollapsedHomeNavigation();
        if (root.matches?.(".app-sidebar, .sidebar")) bindSidebar(root);
        root.querySelectorAll?.(".app-sidebar, .sidebar").forEach(bindSidebar);
    }

    window.AIOneSidebar = Object.freeze({
        init,
        configure: configureSidebar,
        setCollapsed: setSidebarCollapsed,
        openModal,
        bindNavTooltips,
        renderCompletionDots,
        markCompletion,
        clearCompletion,
    });
    window.AIOneUserProfileTooltip = Object.freeze({
        bind: bindUserProfileTooltip,
        hide: hideUserProfileTooltip,
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest("[data-sidebar-logout-confirm]")) return;
        logout();
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init(), { once: true });
    } else {
        init();
    }

    document.addEventListener("component:ready", (event) => {
        if (["sidebar", "sidebar-chatbot"].includes(event.detail?.name)) init(event.target);
        if (pendingModalRequest && event.detail?.name === "modal" && event.detail?.id === pendingModalRequest.targetId) {
            flushPendingModalRequest();
        }
    });
    document.addEventListener("app:includes-ready", (event) => {
        init(event.target);
        flushPendingModalRequest();
    });
})();

/* ============================ End: 사이드바 (Sidebar) ============================== */

/* ============================ Start: 파일 업로드 (File Upload) ============================ */

(() => {
    const FILE_SECURITY_SCAN_LIMIT = 1024 * 1024;
    const FILE_SENSITIVE_RULES = [
        { label: "개인정보 표기", pattern: /(개인정보|민감정보|개인 식별정보|개인식별정보)/i },
        { label: "주민등록·외국인등록 정보", pattern: /(주민등록(번호)?|주민번호|외국인등록(번호)?|\b\d{6}-?[1-4]\d{6}\b)/i },
        { label: "여권·면허 정보", pattern: /(여권번호|운전면허(번호)?|면허번호)/i },
        { label: "금융·인증 정보", pattern: /(계좌번호|신용카드(번호)?|카드번호|비밀번호|인증번호|보안카드)/i },
        { label: "건강·의료 정보", pattern: /(건강정보|진료기록|진단명|병력|의료정보|장애정보|유전정보|생체정보|지문정보)/i },
        { label: "민감한 개인 속성", pattern: /(범죄경력|정치적 견해|노동조합|종교정보|성생활|성적 지향)/i },
        { label: "연락처 정보", pattern: /(\b01[016789]-?\d{3,4}-?\d{4}\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i },
    ];
    const FILE_CONFIDENTIAL_RULES = [
        { label: "대외비", pattern: /(대외\s*비|대외비)/i },
        { label: "비공개·내부한정", pattern: /(비공개|내부한정|내부용|외부공개금지|외부 공개 금지)/i },
        { label: "보안·기밀", pattern: /(보안문서|기밀|confidential|secret)/i },
    ];

    async function inspectFileSecurity(file) {
        let contentSample = "";
        try {
            contentSample = await file.slice(0, FILE_SECURITY_SCAN_LIMIT).text();
        } catch {
            contentSample = "";
        }

        const target = `${file.name || ""}\n${contentSample}`;
        const sensitiveReasons = FILE_SENSITIVE_RULES.filter((rule) => rule.pattern.test(target)).map((rule) => rule.label);
        const confidentialReasons = FILE_CONFIDENTIAL_RULES.filter((rule) => rule.pattern.test(target)).map((rule) => rule.label);

        return {
            file,
            sensitiveReasons: [...new Set(sensitiveReasons)],
            confidentialReasons: [...new Set(confidentialReasons)],
            level: sensitiveReasons.length ? "sensitive" : confidentialReasons.length ? "confidential" : "safe",
        };
    }

    async function validateFileSecurity(inputFiles) {
        const files = Array.from(inputFiles || []);
        const results = await Promise.all(files.map(inspectFileSecurity));
        return {
            results,
            blocked: results.filter((result) => result.level === "sensitive"),
            confidential: results.filter((result) => result.level === "confidential"),
            safeFiles: results.filter((result) => result.level === "safe").map((result) => result.file),
        };
    }

    function bindUploadZone(zone) {
        if (!zone || zone.dataset.fileUploadReady === "true") return;

        const input = zone.querySelector('input[type="file"]');
        if (!input) return;

        const emitFiles = (fileList, source) => {
            const files = Array.from(fileList || []);
            if (!files.length) return;
            zone.dispatchEvent(
                new CustomEvent("app:file-upload", {
                    bubbles: true,
                    detail: { files, source },
                }),
            );
        };

        zone.addEventListener("click", (event) => {
            if (event.target === input) return;
            input.click();
        });
        zone.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            input.click();
        });
        input.addEventListener("change", () => {
            emitFiles(input.files, "picker");
            input.value = "";
        });
        zone.addEventListener("dragenter", (event) => {
            event.preventDefault();
            zone.classList.add("dragover");
        });
        zone.addEventListener("dragover", (event) => {
            event.preventDefault();
            zone.classList.add("dragover");
        });
        zone.addEventListener("dragleave", (event) => {
            if (event.relatedTarget && zone.contains(event.relatedTarget)) return;
            zone.classList.remove("dragover");
        });
        zone.addEventListener("drop", (event) => {
            event.preventDefault();
            zone.classList.remove("dragover");
            emitFiles(event.dataTransfer?.files, "drop");
        });

        zone.dataset.fileUploadReady = "true";
    }

    function init(root = document) {
        if (root.matches?.("[data-file-upload-zone]")) bindUploadZone(root);
        root.querySelectorAll?.("[data-file-upload-zone]").forEach(bindUploadZone);
    }

    window.AIOneUploadSecurity = Object.freeze({
        inspect: inspectFileSecurity,
        validate: validateFileSecurity,
    });
    window.AIOneFileUpload = Object.freeze({ init });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init(), { once: true });
    } else {
        init();
    }
    document.addEventListener("app:includes-ready", (event) => init(event.target));
    document.addEventListener("component:ready", (event) => {
        if (event.detail?.name === "file-upload") init(event.target);
    });
})();

/* ============================ End: 파일 업로드 (File Upload) ============================== */

/* ============================ Start: 파일 항목 (File Item) ============================ */

(() => {
    const ACTION_SCOPE_SELECTOR = "[data-file-actions]";
    const FILE_ITEM_SELECTOR = ".file-list > li";
    const PINNED_META_SUFFIX = " · 목록 고정";
    let pendingDelete = null;

    function getItems(list) {
        return Array.from(list?.children || []).filter((item) => item.matches("li:not(.file-list-empty)"));
    }

    function assignInitialOrder(list) {
        const items = getItems(list);
        const usedOrders = items.map((item) => Number(item.dataset.fileInitialIndex)).filter(Number.isFinite);
        let nextOrder = usedOrders.length ? Math.max(...usedOrders) + 1 : 0;

        items.forEach((item) => {
            if (Number.isFinite(Number(item.dataset.fileInitialIndex))) return;
            item.dataset.fileInitialIndex = String(nextOrder);
            nextOrder += 1;
        });
    }

    function syncPinnedState(item, isPinned) {
        item.classList.toggle("pinned", isPinned);

        const pinButton = item.querySelector('[data-menu-value="pin"]');
        if (pinButton) {
            pinButton.textContent = isPinned ? "목록 고정 해제" : "목록 고정";
            pinButton.setAttribute("aria-pressed", String(isPinned));
        }

        const meta = item.querySelector(".file-meta");
        if (meta) {
            meta.dataset.fileMetaBase ||= meta.textContent.replace(/\s*·\s*목록 고정$/, "").trim();
            meta.textContent = `${meta.dataset.fileMetaBase}${isPinned ? PINNED_META_SUFFIX : ""}`;
        }
    }

    function sortPinnedItems(list) {
        assignInitialOrder(list);
        getItems(list)
            .sort((first, second) => Number(second.classList.contains("pinned")) - Number(first.classList.contains("pinned")) || Number(first.dataset.fileInitialIndex) - Number(second.dataset.fileInitialIndex))
            .forEach((item) => list.append(item));
    }

    function syncListState(list) {
        if (!list || list.classList.contains("simple")) return;

        const count = getItems(list).length;
        const section = list.closest(".file-list-section");
        const countElement = section?.querySelector(".upload-summary-file-count");
        if (countElement) countElement.textContent = String(count);
        const summaryMessage = section?.querySelector(".upload-summary-footer-copy em");
        if (summaryMessage) summaryMessage.textContent = `${count}건 질의 확인`;

        const scope = list.closest(ACTION_SCOPE_SELECTOR);
        const emptyTarget = list.dataset.fileEmptyTarget ? scope?.querySelector(list.dataset.fileEmptyTarget) : null;
        if (emptyTarget) {
            emptyTarget.classList.toggle("hidden", count > 0);
            list.classList.toggle("hidden", count === 0);
        }
    }

    function selectItem(item) {
        const list = item.closest(".file-list");
        if (!list || list.classList.contains("simple")) return;
        getItems(list).forEach((candidate) => {
            candidate.classList.toggle("active", candidate === item);
        });
    }

    function getFileName(item) {
        return item.querySelector(".file-name, .file-name-simple")?.textContent.trim() || "선택한 파일";
    }

    function getDeleteModal(item) {
        const scope = item.closest(ACTION_SCOPE_SELECTOR);
        const modalId = scope?.dataset.fileDeleteModal;
        return modalId ? document.getElementById(modalId) : null;
    }

    function prepareDelete(item, trigger) {
        const modal = getDeleteModal(item);
        if (!modal || !window.AIOneModal) return;

        const fileName = getFileName(item);
        const nameElement = modal.querySelector("[data-file-delete-name]");
        if (nameElement) nameElement.textContent = fileName;

        pendingDelete = { item, modal, fileName };
        window.AIOneModal.open(modal, trigger);
    }

    function deletePendingItem() {
        const target = pendingDelete;
        if (!target?.item.isConnected) return;

        const { item, modal, fileName } = target;
        const list = item.closest(".file-list");
        const wasActive = item.classList.contains("active");
        const nextItem = item.nextElementSibling || item.previousElementSibling;

        item.remove();
        if (wasActive && nextItem?.matches("li:not(.file-list-empty)")) {
            selectItem(nextItem);
        }
        syncListState(list);

        pendingDelete = null;
        window.AIOneModal?.close(modal);
        list?.dispatchEvent(
            new CustomEvent("fileitem:delete", {
                bubbles: true,
                detail: { fileName },
            }),
        );
    }

    function togglePinnedItem(item) {
        const list = item.closest(".file-list");
        const isPinned = !item.classList.contains("pinned");
        syncPinnedState(item, isPinned);
        sortPinnedItems(list);
        item.dispatchEvent(
            new CustomEvent("fileitem:pinchange", {
                bubbles: true,
                detail: { pinned: isPinned, fileName: getFileName(item) },
            }),
        );
    }

    function init(root = document) {
        const scopes = [];
        if (root instanceof Element && root.matches(ACTION_SCOPE_SELECTOR)) scopes.push(root);
        root.querySelectorAll?.(ACTION_SCOPE_SELECTOR).forEach((scope) => scopes.push(scope));

        scopes.forEach((scope) => {
            scope.querySelectorAll(".file-list:not(.simple)").forEach((list) => {
                assignInitialOrder(list);
                getItems(list).forEach((item) => {
                    syncPinnedState(item, item.classList.contains("pinned"));
                });
                syncListState(list);
            });
        });
    }

    document.addEventListener("dropdownmenu:select", (event) => {
        const item = event.target.closest(FILE_ITEM_SELECTOR);
        if (!item?.closest(ACTION_SCOPE_SELECTOR)) return;

        if (event.detail?.value === "pin") togglePinnedItem(item);
        if (event.detail?.value === "delete") {
            prepareDelete(item, event.detail.item || event.target);
        }
    });

    document.addEventListener("click", (event) => {
        const confirmButton = event.target.closest("[data-file-delete-confirm]");
        if (confirmButton) {
            if (pendingDelete?.modal.contains(confirmButton)) deletePendingItem();
            return;
        }

        const removeButton = event.target.closest(".file-remove-simple");
        const simpleItem = removeButton?.closest(FILE_ITEM_SELECTOR);
        if (simpleItem?.closest(ACTION_SCOPE_SELECTOR)) {
            prepareDelete(simpleItem, removeButton);
            return;
        }

        const mainButton = event.target.closest(".file-item-main");
        const item = mainButton?.closest(FILE_ITEM_SELECTOR);
        if (item?.closest(ACTION_SCOPE_SELECTOR)) selectItem(item);
    });

    document.addEventListener("modal:close", (event) => {
        if (pendingDelete?.modal === event.target) pendingDelete = null;
    });

    window.AIOneFileItem = Object.freeze({
        init,
        syncPinnedState,
        prepareDelete,
    });
    document.addEventListener("DOMContentLoaded", () => init());
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* ============================ End: 파일 항목 (File Item) ============================== */

/* ============================ Start: 필터 버튼 (Filter Button) ============================ */

(() => {
    function getButtons(list) {
        return Array.from(list.querySelectorAll(".filter-btn")).filter((button) => button.closest(".filter-bar") === list);
    }

    function bindFilterBar(list) {
        const buttons = getButtons(list);
        if (!buttons.length) return;

        const selectedButton = buttons.find((button) => button.classList.contains("active")) || buttons.find((button) => !button.disabled);
        buttons.forEach((button) => button.setAttribute("aria-pressed", String(button === selectedButton)));
        selectedButton?.classList.add("active");
        list.dataset.filterButtonReady = "true";
    }

    function init(root = document) {
        if (root.matches?.(".filter-bar")) bindFilterBar(root);
        root.querySelectorAll?.(".filter-bar").forEach(bindFilterBar);

        if (document.documentElement.dataset.filterButtonEventsReady === "true") return;
        document.addEventListener("click", (event) => {
            const button = event.target.closest(".filter-btn");
            const list = button?.closest(".filter-bar");
            if (!button || !list || button.disabled || button.getAttribute("aria-disabled") === "true") return;

            getButtons(list).forEach((item) => {
                const isSelected = item === button;
                item.classList.toggle("active", isSelected);
                item.setAttribute("aria-pressed", String(isSelected));
            });
            list.dispatchEvent(
                new CustomEvent("filter-btn:change", {
                    bubbles: true,
                    detail: {
                        filter: button.dataset.filter || button.value || button.textContent.trim(),
                        button,
                    },
                }),
            );
        });
        document.documentElement.dataset.filterButtonEventsReady = "true";
    }

    window.AIOneFilterButtons = Object.freeze({ init });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init(), { once: true });
    } else {
        init();
    }
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* ============================ End: 필터 버튼 (Filter Button) ============================== */

/* ============================ Start: 진행률 표시줄 (Progress Bar) ============================ */

(() => {
    function resolveProgressbar(target) {
        if (target instanceof Element) return target;
        if (typeof target === "string") return document.querySelector(target);
        return null;
    }

    function setValue(target, nextValue) {
        const progressbar = resolveProgressbar(target);
        if (!progressbar) return null;

        const min = Number(progressbar.getAttribute("aria-valuemin") ?? 0);
        const max = Number(progressbar.getAttribute("aria-valuemax") ?? 100);
        const safeMin = Number.isFinite(min) ? min : 0;
        const safeMax = Number.isFinite(max) && max > safeMin ? max : 100;
        const numericValue = Number(nextValue);
        const value = Math.min(safeMax, Math.max(safeMin, Number.isFinite(numericValue) ? numericValue : safeMin));
        const percent = ((value - safeMin) / (safeMax - safeMin)) * 100;

        progressbar.style.setProperty("--progressbar-value", `${percent}%`);
        progressbar.dataset.value = String(value);
        progressbar.setAttribute("role", "progressbar");
        progressbar.setAttribute("aria-valuemin", String(safeMin));
        progressbar.setAttribute("aria-valuemax", String(safeMax));
        progressbar.setAttribute("aria-valuenow", String(value));
        progressbar.classList.toggle("is-high", percent >= 90);
        progressbar.classList.toggle("is-medium", percent >= 75 && percent < 90);
        progressbar.classList.toggle("is-low", percent < 75);
        progressbar
            .closest(".progressbar-row")
            ?.querySelector("[data-progressbar-value]")
            ?.replaceChildren(`${Math.round(percent)}%`);
        progressbar.dispatchEvent(
            new CustomEvent("progressbar:change", {
                bubbles: true,
                detail: { value, percent },
            }),
        );
        return progressbar;
    }

    function init(root = document) {
        const progressbars = [];
        if (root instanceof Element && root.matches("[data-progressbar]")) progressbars.push(root);
        root.querySelectorAll?.("[data-progressbar]").forEach((progressbar) => progressbars.push(progressbar));
        progressbars.forEach((progressbar) => {
            setValue(progressbar, progressbar.dataset.value ?? progressbar.getAttribute("aria-valuenow") ?? 0);
        });
    }

    window.AIOneProgressBar = Object.freeze({ init, setValue });
    document.addEventListener("DOMContentLoaded", () => init());
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* ============================ End: 진행률 표시줄 (Progress Bar) ============================== */

/* ============================ Start: 데이터 테이블 (Data Table) ============================ */

(() => {
    function init(root = document) {
        const tables = [];
        if (root instanceof Element && root.matches("[data-datatable]")) tables.push(root);
        root.querySelectorAll?.("[data-datatable]").forEach((table) => tables.push(table));

        tables.forEach((table) => {
            if (table.dataset.dataTableReady === "true") return;
            const tbody = table.tBodies[0];
            if (!tbody) return;

            const rowCheckboxes = () => Array.from(table.querySelectorAll("[data-table-select-row]"));
            const selectAll = table.querySelector("[data-table-select-all]");
            const emitSelection = () => {
                const checkboxes = rowCheckboxes().filter((input) => !input.disabled);
                const selected = checkboxes.filter((input) => input.checked);
                checkboxes.forEach((input) => {
                    const row = input.closest("tr");
                    row?.classList.toggle("is-selected", input.checked);
                    row?.setAttribute("aria-selected", String(input.checked));
                });
                if (selectAll) {
                    selectAll.checked = checkboxes.length > 0 && selected.length === checkboxes.length;
                    selectAll.indeterminate = selected.length > 0 && selected.length < checkboxes.length;
                }
                table.dispatchEvent(
                    new CustomEvent("datatable:selection-change", {
                        bubbles: true,
                        detail: {
                            selectedValues: selected.map((input) => input.value),
                        },
                    }),
                );
            };

            selectAll?.addEventListener("change", () => {
                rowCheckboxes().forEach((input) => {
                    if (!input.disabled) input.checked = selectAll.checked;
                });
                emitSelection();
            });
            rowCheckboxes().forEach((input) => input.addEventListener("change", emitSelection));

            table.querySelectorAll("[data-table-sort]").forEach((button) => {
                button.addEventListener("click", () => {
                    const header = button.closest("th");
                    if (!header) return;
                    const columnIndex = header.cellIndex;
                    const nextDirection = header.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
                    const sortType = button.dataset.sortType || "text";
                    const rows = Array.from(tbody.rows).filter((row) => !row.querySelector(".data-table-empty"));

                    const getValue = (row) => {
                        const cell = row.cells[columnIndex];
                        const rawValue = cell?.dataset.sortValue || cell?.textContent.trim() || "";
                        if (sortType === "number") {
                            const numberValue = Number(rawValue.replace(/[^\d.-]/g, ""));
                            return Number.isFinite(numberValue) ? numberValue : 0;
                        }
                        if (sortType === "date") {
                            const dateValue = Date.parse(rawValue);
                            return Number.isNaN(dateValue) ? 0 : dateValue;
                        }
                        return rawValue;
                    };

                    rows.sort((rowA, rowB) => {
                        const valueA = getValue(rowA);
                        const valueB = getValue(rowB);
                        const comparison = typeof valueA === "number" ? valueA - valueB : String(valueA).localeCompare(String(valueB), "ko", { numeric: true });
                        return nextDirection === "ascending" ? comparison : -comparison;
                    });

                    table.querySelectorAll("th[aria-sort]").forEach((item) => item.setAttribute("aria-sort", "none"));
                    header.setAttribute("aria-sort", nextDirection);
                    rows.forEach((row) => tbody.appendChild(row));
                    table.dispatchEvent(
                        new CustomEvent("datatable:sort", {
                            bubbles: true,
                            detail: {
                                column: button.dataset.tableSort,
                                direction: nextDirection,
                            },
                        }),
                    );
                });
            });

            table.dataset.dataTableReady = "true";
            emitSelection();
        });
    }

    window.AIOneDataTable = Object.freeze({ init });
    document.addEventListener("DOMContentLoaded", () => init());
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* ============================ End: 데이터 테이블 (Data Table) ============================== */

/* ============================ Start: 문서 상태 표시줄 (Document Status Bar) ============================ */

(() => {
    const rootSelector = "[data-document-statusbar]";
    const fullscreenClass = "document-statusbar-fullscreen";
    let pageSyncFrame = 0;

    function resolveRoot(target) {
        if (target instanceof Element) {
            return target.matches(rootSelector) ? target : target.closest(rootSelector);
        }
        if (typeof target === "string") return document.querySelector(target);
        return null;
    }

    function resolveSelector(root, selector) {
        if (!selector) return null;
        try {
            return document.querySelector(selector);
        } catch (error) {
            return null;
        }
    }

    function readNumber(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function isScrollable(element) {
        if (!(element instanceof Element)) return false;
        const overflowY = window.getComputedStyle(element).overflowY;
        return ["auto", "scroll", "overlay"].includes(overflowY) && element.scrollHeight > element.clientHeight + 1;
    }

    function resolvePageScrollTarget(pages, preferredTarget) {
        const pageList = Array.from(pages || []).filter((page) => page instanceof Element);
        if (isScrollable(preferredTarget)) return preferredTarget;

        let candidate = preferredTarget?.parentElement || pageList[0]?.parentElement || null;
        while (candidate) {
            if (isScrollable(candidate)) return candidate;
            candidate = candidate.parentElement;
        }
        return preferredTarget;
    }

    function getCurrentPage(pages, scrollTarget) {
        const pageList = Array.from(pages || []).filter((page) => page instanceof Element);
        const activeScrollTarget = resolvePageScrollTarget(pageList, scrollTarget);
        if (!pageList.length || !(activeScrollTarget instanceof Element)) return 1;

        const maxScrollTop = Math.max(0, activeScrollTarget.scrollHeight - activeScrollTarget.clientHeight);
        if (activeScrollTarget.scrollTop <= 1) return 1;
        if (maxScrollTop > 0 && activeScrollTarget.scrollTop >= maxScrollTop - 1) return pageList.length;

        const viewport = activeScrollTarget.getBoundingClientRect();
        let current = 1;
        let greatestVisibleHeight = -1;
        pageList.forEach((page, index) => {
            const pageRect = page.getBoundingClientRect();
            const visibleHeight = Math.max(0, Math.min(pageRect.bottom, viewport.bottom) - Math.max(pageRect.top, viewport.top));
            if (visibleHeight <= greatestVisibleHeight) return;
            greatestVisibleHeight = visibleHeight;
            current = index + 1;
        });
        return current;
    }

    function stateFor(root) {
        if (!root) return null;
        const min = readNumber(root.dataset.documentMinZoom, 50);
        const max = Math.max(min, readNumber(root.dataset.documentMaxZoom, 200));
        const step = Math.max(1, readNumber(root.dataset.documentZoomStep, 10));
        const target = resolveSelector(root, root.dataset.documentTarget);
        const scrollTarget = resolveSelector(root, root.dataset.documentScrollTarget);
        const fullscreenTarget = resolveSelector(root, root.dataset.documentFullscreenTarget) || root.parentElement;
        return {
            root,
            min,
            max,
            step,
            target,
            scrollTarget,
            fullscreenTarget,
        };
    }

    function updatePage(state) {
        const selector = state.root.dataset.documentPageSelector;
        if (!selector || !state.scrollTarget) return;

        let pages = [];
        try {
            pages = Array.from(state.target?.querySelectorAll(selector) || []);
        } catch (error) {
            return;
        }
        if (!pages.length) return;

        const pageTotal = state.root.querySelector("[data-document-page-total]");
        const pageCurrent = state.root.querySelector("[data-document-page-current]");
        const current = getCurrentPage(pages, state.scrollTarget);
        if (pageCurrent) pageCurrent.textContent = String(current);
        if (pageTotal) pageTotal.textContent = String(pages.length);
    }

    function syncDocumentPages() {
        pageSyncFrame = 0;
        document.querySelectorAll(rootSelector).forEach((statusbar) => {
            const state = stateFor(statusbar);
            if (state) updatePage(state);
        });
    }

    function scheduleDocumentPageSync() {
        if (pageSyncFrame) return;
        pageSyncFrame = window.requestAnimationFrame(syncDocumentPages);
    }

    function setZoom(target, nextZoom) {
        const root = resolveRoot(target);
        const state = stateFor(root);
        if (!state) return null;

        const zoom = Math.min(state.max, Math.max(state.min, readNumber(nextZoom, readNumber(root.dataset.documentZoom, 100))));
        root.dataset.documentZoom = String(zoom);
        if (state.target) {
            state.target.style.zoom = String(zoom / 100);
            state.target.dataset.documentZoom = String(zoom);
        }

        const value = root.querySelector("[data-document-statusbar-zoom-value]");
        const zoomOut = root.querySelector('[data-document-statusbar-action="zoom-out"]');
        const zoomIn = root.querySelector('[data-document-statusbar-action="zoom-in"]');
        if (value) value.textContent = `${zoom}%`;
        if (zoomOut) zoomOut.disabled = zoom <= state.min;
        if (zoomIn) zoomIn.disabled = zoom >= state.max;
        window.requestAnimationFrame(() => updatePage(state));

        root.dispatchEvent(
            new CustomEvent("document-statusbar:zoomchange", {
                bubbles: true,
                detail: { zoom, target: state.target },
            }),
        );
        return root;
    }

    function syncFullscreenState(root) {
        const state = stateFor(root);
        if (!state) return;
        const isFullscreen = state.fullscreenTarget?.classList.contains(fullscreenClass) || false;
        const button = root.querySelector('[data-document-statusbar-action="fullscreen"]');
        if (!button) return;
        button.setAttribute("aria-pressed", String(isFullscreen));
        button.setAttribute("aria-label", isFullscreen ? "문서 전체보기 종료" : "문서 전체보기");
        button.title = isFullscreen ? "문서 전체보기 종료" : "문서 전체보기";
    }

    function toggleFullscreen(target, force) {
        const root = resolveRoot(target);
        const state = stateFor(root);
        if (!state?.fullscreenTarget) return null;

        const nextState = typeof force === "boolean" ? force : !state.fullscreenTarget.classList.contains(fullscreenClass);
        document.querySelectorAll(`.${fullscreenClass}`).forEach((element) => {
            if (element !== state.fullscreenTarget) element.classList.remove(fullscreenClass);
        });
        state.fullscreenTarget.classList.toggle(fullscreenClass, nextState);
        document.querySelectorAll(rootSelector).forEach(syncFullscreenState);
        root.dispatchEvent(
            new CustomEvent("document-statusbar:fullscreenchange", {
                bubbles: true,
                detail: { fullscreen: nextState, target: state.fullscreenTarget },
            }),
        );
        return root;
    }

    function init(root = document) {
        const statusbars = [];
        if (root instanceof Element && root.matches(rootSelector)) statusbars.push(root);
        root.querySelectorAll?.(rootSelector).forEach((statusbar) => statusbars.push(statusbar));

        if (document.documentElement.dataset.documentStatusbarPageSyncReady !== "true") {
            document.documentElement.dataset.documentStatusbarPageSyncReady = "true";
            document.addEventListener("scroll", scheduleDocumentPageSync, {
                capture: true,
                passive: true,
            });
            window.addEventListener("resize", scheduleDocumentPageSync, { passive: true });
        }

        statusbars.forEach((statusbar) => {
            if (statusbar.dataset.documentStatusbarReady !== "true") {
                statusbar.dataset.documentStatusbarReady = "true";
                statusbar.addEventListener("click", (event) => {
                    const actionButton = event.target.closest("[data-document-statusbar-action]");
                    if (!actionButton || !statusbar.contains(actionButton)) return;
                    const action = actionButton.dataset.documentStatusbarAction;
                    const state = stateFor(statusbar);
                    if (!state) return;
                    if (action === "zoom-out") {
                        setZoom(statusbar, readNumber(statusbar.dataset.documentZoom, 100) - state.step);
                    }
                    if (action === "zoom-in") {
                        setZoom(statusbar, readNumber(statusbar.dataset.documentZoom, 100) + state.step);
                    }
                    if (action === "fullscreen") toggleFullscreen(statusbar);
                });
            }
            setZoom(statusbar, statusbar.dataset.documentZoom);
            syncFullscreenState(statusbar);
        });
        scheduleDocumentPageSync();
    }

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        const fullscreenTarget = document.querySelector(`.${fullscreenClass}`);
        if (!fullscreenTarget) return;
        fullscreenTarget.classList.remove(fullscreenClass);
        document.querySelectorAll(rootSelector).forEach(syncFullscreenState);
    });

    window.AIOneDocumentStatusBar = Object.freeze({
        getCurrentPage,
        init,
        setZoom,
        toggleFullscreen,
    });
    document.addEventListener("DOMContentLoaded", () => init());
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* ============================ End: 문서 상태 표시줄 (Document Status Bar) ============================== */

/* ============================ Start: 채팅 메시지 (Chat Message) ============================ */

(() => {
    const bindings = new WeakMap();
    const retryTimers = new WeakMap();
    const copyTimers = new WeakMap();
    const commonScriptUrl = Array.from(document.scripts)
        .map((script) => script.src)
        .find((scriptUrl) => /\/js\/common\.js(?:[?#]|$)/.test(scriptUrl));
    const iconBaseUrl = commonScriptUrl ? new URL("../assets/icons/", commonScriptUrl) : new URL("../../assets/icons/", document.currentScript?.src || document.baseURI);
    const answerPendingIconUrl = new URL("ai-answer-sparkles.svg", iconBaseUrl);

    function cloneCommonPrototype(prototypeId) {
        const prototype = document.getElementById(prototypeId);
        if (!prototype) return null;
        const source = prototype.hasAttribute("data-prototype-wrapper") ? prototype.firstElementChild : prototype;
        if (!source) return null;
        const clone = source.cloneNode(true);
        clone.removeAttribute("id");
        clone.removeAttribute("hidden");
        clone.removeAttribute("data-dom-prototype");
        return clone;
    }

    function ensureActions(message) {
        const messageList = message instanceof Element ? message.closest("[data-chat-message-list]") : null;
        if (
            !(message instanceof Element) ||
            message.dataset.role !== "ai" ||
            message.dataset.status === "pending" ||
            message.dataset.messageActions === "none" ||
            messageList?.dataset.messageActions === "none" ||
            message.querySelector(":scope > .msg-actions")
        )
            return;

        const variant = message.dataset.variant || messageList?.dataset.variant;
        const actions = cloneCommonPrototype("commonMessageActionsPrototype");
        if (!actions) return;
        actions.querySelector("[data-answer-action-only]")?.toggleAttribute("hidden", variant !== "answer");
        message.append(actions);
    }

    function ensureAnswerAvatar(message) {
        if (!(message instanceof Element)) return;
        const messageList = message.closest("[data-chat-message-list]");
        const variant = message.dataset.variant || messageList?.dataset.variant;
        if (variant !== "answer" || message.dataset.role !== "ai" || message.dataset.status === "pending" || message.querySelector(":scope > .chat-ai-avatar")) return;
        // 답변 메시지 아바타는 각 페이지의 실제 HTML 또는 메시지 원형에서 제공합니다.
    }

    function decorateActions(root = document) {
        const messages = [];
        if (root instanceof Element && root.matches('[data-component="chat-message"], .chat-msg')) {
            messages.push(root);
        }
        root.querySelectorAll?.('[data-component="chat-message"], .chat-msg').forEach((message) => messages.push(message));
        messages.forEach((message) => {
            ensureAnswerAvatar(message);
            ensureActions(message);
        });
    }

    function createPending({ variant = "answer", title = "생성 중", description = "답변서 초안을 생성하고 있습니다..." } = {}) {
        const prototypeId = variant === "answer" ? "commonAnswerPendingMessagePrototype" : "commonChatPendingMessagePrototype";
        const message = cloneCommonPrototype(prototypeId);
        if (!message) return null;

        if (variant === "answer") {
            const pendingIcon = message.querySelector(".typing-avatar img");
            if (pendingIcon && !pendingIcon.src) pendingIcon.src = answerPendingIconUrl.href;
            message.querySelector(".typing-title").textContent = title;
            message.querySelector(".typing-desc").textContent = description;
            return message;
        }

        message.setAttribute("aria-label", title);
        return message;
    }

    function getMessage(button) {
        return button.closest('[data-component="chat-message"], .chat-msg');
    }

    function emitAction(message, action, detail = {}) {
        if (!message) return;
        message.dispatchEvent(
            new CustomEvent("chat-message:action", {
                bubbles: true,
                detail: { action, ...detail },
            }),
        );
    }

    function setFeedback(button, message, options) {
        const action = button.dataset.action;
        const shouldActivate = button.getAttribute("aria-pressed") !== "true";
        const actions = button.closest(".msg-actions");

        actions?.querySelectorAll('[data-action="like"], [data-action="dislike"]').forEach((feedbackButton) => {
            feedbackButton.classList.remove("active");
            feedbackButton.setAttribute("aria-pressed", "false");
        });

        if (shouldActivate) {
            button.classList.add("active");
            button.setAttribute("aria-pressed", "true");
        }

        emitAction(message, action, {
            selected: shouldActivate,
            value: shouldActivate ? action : null,
        });
        options.onFeedback?.({
            action,
            button,
            message,
            selected: shouldActivate,
            value: shouldActivate ? action : null,
        });
    }

    function fallbackCopy(text) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("Clipboard copy failed");
    }

    async function writeClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }
        fallbackCopy(text);
    }

    function showCopyFeedback(button) {
        const originalLabel = button.getAttribute("aria-label") || "복사";
        const originalTitle = button.title || "복사";
        const activeTimer = copyTimers.get(button);
        if (activeTimer) window.clearTimeout(activeTimer);

        button.classList.add("active");
        button.setAttribute("aria-label", "복사됨");
        button.title = "복사됨";

        copyTimers.set(
            button,
            window.setTimeout(() => {
                button.classList.remove("active");
                button.setAttribute("aria-label", originalLabel);
                button.title = originalTitle;
                copyTimers.delete(button);
            }, 1200),
        );
    }

    async function copyMessage(button, message, options) {
        const text = options.getText?.({ button, message }) ?? message?.querySelector(".msg-content, .msg-text")?.innerText ?? "";

        try {
            await writeClipboard(text.trim());
            showCopyFeedback(button);
            emitAction(message, "copy", { copied: true, text });
            options.onCopy?.({ button, message, copied: true, text });
        } catch {
            emitAction(message, "copy", { copied: false, text });
            options.onCopy?.({ button, message, copied: false, text });
        }
    }

    function simulateRetry(message) {
        if (!message || message.classList.contains("is-pending")) return;

        const content = message.querySelector(".msg-content, .msg-text");
        const actions = message.querySelector(".msg-actions");
        if (!content || !actions) return;

        const activeTimer = retryTimers.get(message);
        if (activeTimer) window.clearTimeout(activeTimer);

        const originalContent = content.innerHTML;
        message.classList.add("is-pending");
        message.dataset.status = "pending";
        message.setAttribute("aria-busy", "true");
        const variant = message.dataset.variant || message.closest("[data-chat-message-list]")?.dataset.variant;
        content.innerHTML = variant === "answer" ? '<span class="typing-cursor" role="status" aria-label="답변 생성 중"></span>' : '<span class="chat-typing-ellipsis" role="status" aria-label="답변 생성 중">...</span>';
        actions.hidden = true;

        retryTimers.set(
            message,
            window.setTimeout(() => {
                content.innerHTML = originalContent;
                actions.hidden = false;
                message.classList.remove("is-pending");
                message.dataset.status = "complete";
                message.removeAttribute("aria-busy");
                retryTimers.delete(message);
                emitAction(message, "retry-complete");
            }, 800),
        );
    }

    function bind(root, options) {
        const rootWindow = root?.ownerDocument?.defaultView;
        const RootNode = rootWindow?.Node || window.Node;
        if (!root || !(root instanceof RootNode)) return;

        const currentBinding = bindings.get(root);
        if (currentBinding) {
            if (options) currentBinding.options = options;
            return;
        }

        const binding = { options: options || {} };
        decorateActions(root);
        const RootMutationObserver = rootWindow?.MutationObserver || window.MutationObserver;
        binding.observer = new RootMutationObserver(() => decorateActions(root));
        try {
            binding.observer.observe(root, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["data-message-actions", "data-role", "data-status"],
            });
        } catch (error) {
            binding.observer.disconnect();
            return;
        }
        root.addEventListener("click", (event) => {
            const target = event.target instanceof Element ? event.target : null;
            const button = target?.closest(".msg-action-btn[data-action]");
            if (!button || !root.contains(button)) return;

            const action = button.dataset.action;
            if (!["like", "dislike", "retry", "copy", "more", "report"].includes(action)) return;

            event.stopPropagation();
            const message = getMessage(button);

            if (action === "like" || action === "dislike") {
                setFeedback(button, message, binding.options);
                return;
            }
            if (action === "copy") {
                copyMessage(button, message, binding.options);
                return;
            }
            if (action === "report") {
                emitAction(message, "report");
                binding.options.onReport?.({ button, message });
                return;
            }
            if (action === "more") {
                emitAction(message, "more");
                binding.options.onMore?.({ button, message });
                return;
            }

            emitAction(message, "retry");
            if (typeof binding.options.onRetry === "function") {
                binding.options.onRetry({ button, message });
            } else {
                simulateRetry(message);
            }
        });

        bindings.set(root, binding);
    }

    function autoBind(root = document) {
        const lists = [];
        if (root instanceof Element && root.matches("[data-chat-message-list]")) lists.push(root);
        root.querySelectorAll?.("[data-chat-message-list]").forEach((messageList) => lists.push(messageList));
        lists.forEach((messageList) => bind(messageList));
    }

    window.ChatMessage = Object.freeze({ bind, autoBind, createPending, decorateActions });
    document.addEventListener("DOMContentLoaded", () => autoBind());
    document.addEventListener("app:includes-ready", (event) => autoBind(event.target));
})();

/* ============================ End: 채팅 메시지 (Chat Message) ============================== */

/* ============================ Start: 프롬프트 작성기 (Prompt Composer) ============================ */

(() => {
    function init(root = document) {
        const composers = [];
        if (root instanceof Element && root.matches("[data-prompt-composer]")) composers.push(root);
        root.querySelectorAll?.("[data-prompt-composer]").forEach((composer) => composers.push(composer));

        composers.forEach((composer) => {
            if (composer.dataset.promptComposerReady === "true") return;

            const input = composer.querySelector("[data-prompt-input]");
            const submitButton = composer.querySelector("[data-prompt-submit]");
            const attachButton = composer.querySelector("[data-prompt-attach]");
            const fileInput = composer.querySelector("[data-prompt-file-input]");
            const fileList = composer.querySelector("[data-prompt-files]");
            const currentCount = composer.querySelector("[data-prompt-current]");
            const form = composer.matches("form") ? composer : composer.querySelector("form");
            if (!input || !submitButton || !form) return;

            let selectedFiles = [];
            const maxLength = Number(input.getAttribute("maxlength")) || 0;
            const isMultiline = input.tagName === "TEXTAREA";

            const syncInput = () => {
                if (isMultiline) {
                    input.style.height = "auto";
                    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
                }
                submitButton.disabled = input.value.trim().length === 0;

                if (currentCount) {
                    currentCount.textContent = String(input.value.length);
                    currentCount.closest(".prompt-composer-counter")?.classList.toggle("is-limit", maxLength > 0 && input.value.length >= maxLength);
                }
            };

            const renderFiles = () => {
                if (!fileList) return;
                fileList.replaceChildren();
                selectedFiles.forEach((file, index) => {
                    const prototype = document.getElementById("commonPromptFilePrototype");
                    if (!prototype) return;
                    const item = prototype.cloneNode(true);
                    item.removeAttribute("id");
                    item.removeAttribute("hidden");
                    item.removeAttribute("data-dom-prototype");
                    const name = item.querySelector(".prompt-composer-file-name");
                    name.textContent = file.name;
                    const removeButton = item.querySelector("button");
                    removeButton.dataset.promptFileRemove = String(index);
                    removeButton.setAttribute("aria-label", `${file.name} 삭제`);
                    fileList.append(item);
                });
            };

            input.addEventListener("input", syncInput);
            input.addEventListener("keydown", (event) => {
                if (event.key !== "Enter" || event.isComposing) return;
                if (isMultiline && event.shiftKey) return;
                event.preventDefault();
                if (!submitButton.disabled) form.requestSubmit(submitButton);
            });

            attachButton?.addEventListener("click", () => fileInput?.click());
            fileInput?.addEventListener("change", () => {
                selectedFiles = Array.from(fileInput.files || []);
                renderFiles();
                composer.dispatchEvent(
                    new CustomEvent("promptcomposer:files-change", {
                        bubbles: true,
                        detail: { files: selectedFiles.slice() },
                    }),
                );
            });
            fileList?.addEventListener("click", (event) => {
                const removeButton = event.target.closest("[data-prompt-file-remove]");
                if (!removeButton) return;
                selectedFiles.splice(Number(removeButton.dataset.promptFileRemove), 1);
                if (fileInput) fileInput.value = "";
                renderFiles();
                composer.dispatchEvent(
                    new CustomEvent("promptcomposer:files-change", {
                        bubbles: true,
                        detail: { files: selectedFiles.slice() },
                    }),
                );
            });
            form.addEventListener("submit", (event) => {
                event.preventDefault();
                const value = input.value.trim();
                if (!value) return;
                composer.dispatchEvent(
                    new CustomEvent("promptcomposer:submit", {
                        bubbles: true,
                        detail: {
                            value,
                            files: selectedFiles.slice(),
                        },
                    }),
                );
            });

            composer.dataset.promptComposerReady = "true";
            syncInput();
        });
    }

    window.AIOnePromptComposer = Object.freeze({ init });
    document.addEventListener("DOMContentLoaded", () => init());
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* ============================ End: 프롬프트 작성기 (Prompt Composer) ============================== */

/* ============================ Start: 분할 핸들러 (Split Handler) ============================ */

(() => {
    const HANDLE_SELECTOR = [".split-handler-handle", ".three-panel > .panel-resize-handle"].join(", ");
    const DEFAULT_SPLIT_MIN_WIDTH = 160;
    const DEFAULT_PANEL_MIN_WIDTH = 220;
    const PANEL_HANDLE_WIDTH = 2;

    function getDirectChildren(container, predicate) {
        return Array.from(container?.children || []).filter(predicate);
    }

    function getSplitPanes(container) {
        return getDirectChildren(container, (element) => element.classList.contains("split-handler-left") || element.classList.contains("split-handler-right") || element.classList.contains("split-handler-pane"));
    }

    function getTwoPaneParts(handle) {
        const splitContainer = handle.closest('[data-component="split-handler"]');
        if (splitContainer && handle.parentElement === splitContainer && handle.classList.contains("split-handler-handle")) {
            const panes = getSplitPanes(splitContainer);
            const handles = getDirectChildren(splitContainer, (element) => element.classList.contains("split-handler-handle"));
            const handleIndex = handles.indexOf(handle);
            const left = panes[handleIndex];
            const right = panes[handleIndex + 1];
            return left && right ? { kind: "two-pane", container: splitContainer, handle, left, right } : null;
        }

        return null;
    }

    function getThreePanelParts(handle) {
        const container = handle.closest(".three-panel");
        if (!container || handle.parentElement !== container) return null;

        const compareHorizontalPosition = (first, second) => first.getBoundingClientRect().left - second.getBoundingClientRect().left;
        const panels = getDirectChildren(container, (element) => element.hasAttribute("data-slot")).sort(compareHorizontalPosition);
        const handles = getDirectChildren(container, (element) => element.classList.contains("panel-resize-handle")).sort(compareHorizontalPosition);
        const handleIndex = handles.indexOf(handle);
        const left = panels[handleIndex];
        const right = panels[handleIndex + 1];
        if (handleIndex < 0 || !left || !right) return null;

        return { kind: "three-panel", container, handle, panels, left, right };
    }

    function getResizeParts(handle) {
        if (handle.closest('[data-component="split-handler"]')) {
            return getTwoPaneParts(handle);
        }
        return getThreePanelParts(handle);
    }

    function getMinimum(container, totalWidth, fallback) {
        const configured = Number.parseFloat(container.dataset.splitMin);
        const minimum = Number.isFinite(configured) ? configured : fallback;
        return Math.min(Math.max(0, minimum), Math.max(0, Math.floor(totalWidth / 2)));
    }

    function getSplitOrientation(parts) {
        return parts.kind === "two-pane" && parts.container.classList.contains("type2") ? "vertical" : "horizontal";
    }

    function getPaneSize(pane, orientation) {
        const rect = pane.getBoundingClientRect();
        return orientation === "vertical" ? rect.height : rect.width;
    }

    function syncAria(parts) {
        const orientation = getSplitOrientation(parts);
        const beforeSize = Math.round(getPaneSize(parts.left, orientation));
        const afterSize = Math.round(getPaneSize(parts.right, orientation));
        const totalSize = beforeSize + afterSize;
        const fallback = parts.kind === "three-panel" ? DEFAULT_PANEL_MIN_WIDTH : DEFAULT_SPLIT_MIN_WIDTH;
        const minimum = getMinimum(parts.container, totalSize, fallback);

        parts.handle.setAttribute("aria-orientation", orientation === "vertical" ? "horizontal" : "vertical");
        parts.handle.setAttribute("aria-valuemin", String(minimum));
        parts.handle.setAttribute("aria-valuemax", String(Math.max(minimum, totalSize - minimum)));
        parts.handle.setAttribute("aria-valuenow", String(beforeSize));
    }

    function applyTwoPaneSizes(parts, requestedBeforeSize, totalSize) {
        const orientation = getSplitOrientation(parts);
        const sizeProperty = orientation === "vertical" ? "height" : "width";
        const crossSizeProperty = orientation === "vertical" ? "width" : "height";
        const minimum = getMinimum(parts.container, totalSize, DEFAULT_SPLIT_MIN_WIDTH);
        const beforeSize = Math.min(Math.max(Math.round(requestedBeforeSize), minimum), totalSize - minimum);
        const afterSize = totalSize - beforeSize;

        parts.left.style.setProperty("flex", "none", "important");
        parts.left.style.removeProperty(crossSizeProperty);
        parts.left.style.setProperty(sizeProperty, `${beforeSize}px`);
        parts.right.style.setProperty("flex", "none", "important");
        parts.right.style.removeProperty(crossSizeProperty);
        parts.right.style.setProperty(sizeProperty, `${afterSize}px`);
        syncAria(parts);
        const detail = {
            handle: parts.handle,
            left: parts.left,
            right: parts.right,
            orientation,
            beforeSize,
            afterSize,
        };
        if (orientation === "vertical") {
            detail.topHeight = beforeSize;
            detail.bottomHeight = afterSize;
        } else {
            detail.leftWidth = beforeSize;
            detail.rightWidth = afterSize;
        }
        parts.container.dispatchEvent(
            new CustomEvent("split-handler:resize", {
                bubbles: true,
                detail,
            }),
        );
    }

    function readThreePanelWidths(parts) {
        return new Map(parts.panels.map((panel) => [panel, Math.round(panel.getBoundingClientRect().width)]));
    }

    function applyThreePanelWidths(parts, requestedLeftWidth, totalWidth, startWidths) {
        const minimum = getMinimum(parts.container, totalWidth, DEFAULT_PANEL_MIN_WIDTH);
        const leftWidth = Math.min(Math.max(Math.round(requestedLeftWidth), minimum), totalWidth - minimum);
        const widths = new Map(startWidths);
        widths.set(parts.left, leftWidth);
        widths.set(parts.right, totalWidth - leftWidth);

        parts.container.style.gridTemplateColumns = parts.panels.flatMap((panel, index) => (index < parts.panels.length - 1 ? [`${widths.get(panel)}px`, `${PANEL_HANDLE_WIDTH}px`] : [`${widths.get(panel)}px`])).join(" ");
        getDirectChildren(parts.container, (element) => element.classList.contains("panel-resize-handle")).forEach((handle) => {
            const nextParts = getThreePanelParts(handle);
            if (nextParts) syncAria(nextParts);
        });
    }

    function applyWidths(parts, requestedLeftWidth, totalWidth, startWidths) {
        if (parts.kind === "three-panel") {
            applyThreePanelWidths(parts, requestedLeftWidth, totalWidth, startWidths);
            return;
        }
        applyTwoPaneSizes(parts, requestedLeftWidth, totalWidth);
    }

    function init(root = document) {
        const handles = [];
        if (root instanceof Element && root.matches(HANDLE_SELECTOR)) handles.push(root);
        root.querySelectorAll?.(HANDLE_SELECTOR).forEach((handle) => handles.push(handle));
        handles.forEach((handle) => {
            const parts = getResizeParts(handle);
            if (parts) syncAria(parts);
        });
    }

    function reset(container) {
        if (!(container instanceof Element)) return;
        if (container.matches(".three-panel")) {
            container.style.removeProperty("grid-template-columns");
        } else {
            getDirectChildren(container, (element) => element.classList.contains("split-handler-left") || element.classList.contains("split-handler-right") || element.classList.contains("split-handler-pane")).forEach((panel) => {
                panel.style.removeProperty("flex");
                panel.style.removeProperty("width");
                panel.style.removeProperty("height");
            });
        }
        init(container);
    }

    if (document.documentElement.dataset.splitHandlerEventsReady !== "true") {
        document.documentElement.dataset.splitHandlerEventsReady = "true";

        document.addEventListener("pointerdown", (event) => {
            const handle = event.target.closest(HANDLE_SELECTOR);
            if (!handle || event.button !== 0) return;
            const parts = getResizeParts(handle);
            if (!parts) return;

            event.preventDefault();
            const orientation = getSplitOrientation(parts);
            const pointerId = event.pointerId;
            const startPosition = orientation === "vertical" ? event.clientY : event.clientX;
            const startBeforeSize = getPaneSize(parts.left, orientation);
            const startAfterSize = getPaneSize(parts.right, orientation);
            const totalSize = startBeforeSize + startAfterSize;
            const startWidths = parts.kind === "three-panel" ? readThreePanelWidths(parts) : null;

            handle.classList.add("active");
            document.body.style.cursor = orientation === "vertical" ? "row-resize" : "col-resize";
            document.body.style.userSelect = "none";

            const onPointerMove = (moveEvent) => {
                if (moveEvent.pointerId !== pointerId) return;
                moveEvent.preventDefault();
                const currentPosition = orientation === "vertical" ? moveEvent.clientY : moveEvent.clientX;
                applyWidths(parts, startBeforeSize + currentPosition - startPosition, totalSize, startWidths);
            };
            const onPointerEnd = (endEvent) => {
                if (endEvent.pointerId !== pointerId) return;
                handle.classList.remove("active");
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
                document.removeEventListener("pointermove", onPointerMove);
                document.removeEventListener("pointerup", onPointerEnd);
                document.removeEventListener("pointercancel", onPointerEnd);
            };

            document.addEventListener("pointermove", onPointerMove, { passive: false });
            document.addEventListener("pointerup", onPointerEnd);
            document.addEventListener("pointercancel", onPointerEnd);
        });

        document.addEventListener("keydown", (event) => {
            const handle = event.target.closest(HANDLE_SELECTOR);
            if (!handle) return;
            const parts = getResizeParts(handle);
            if (!parts) return;
            const orientation = getSplitOrientation(parts);
            const supportedKeys = orientation === "vertical" ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
            if (!supportedKeys.includes(event.key)) return;

            event.preventDefault();
            const beforeSize = getPaneSize(parts.left, orientation);
            const afterSize = getPaneSize(parts.right, orientation);
            const positiveKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
            const difference = (event.key === positiveKey ? 1 : -1) * (event.shiftKey ? 32 : 16);
            const startWidths = parts.kind === "three-panel" ? readThreePanelWidths(parts) : null;
            applyWidths(parts, beforeSize + difference, beforeSize + afterSize, startWidths);
        });
    }

    window.AIOneSplitHandler = Object.freeze({ init, reset });
    document.addEventListener("component:ready", (event) => init(event.target));
    document.addEventListener("app:includes-ready", (event) => init(event.target));
    document.addEventListener("DOMContentLoaded", () => init());
    init();
})();

/* ============================ End: 분할 핸들러 (Split Handler) ============================== */

/* ============================ Start: 사이드 팝업 (Side Pop) ============================ */

(() => {
    const variants = new Set(["run-list", "chat-list", "content"]);
    const sizes = new Set(["small", "medium", "large", "xlarge"]);
    const listTypes = Object.freeze({
        run: {
            itemSelector: ".sidepop-run-item",
            titleSelector: ".sidepop-run-title",
            renameLabel: "제목 변경",
            menuLabel: "실행 건 관리",
            eventName: "sidepop:run-action",
        },
        chat: {
            itemSelector: ".sidepop-chat-item",
            titleSelector: ".sidepop-chat-name",
            renameLabel: "이름 변경",
            menuLabel: "대화 관리",
            eventName: "sidepop:chat-action",
        },
    });
    const actions = Object.freeze([{ value: "pin", label: "고정" }, { value: "rename" }, { value: "delete", label: "삭제" }]);
    const modalContexts = new WeakMap();
    const modalOrigins = new WeakMap();
    const sharedActionContexts = new WeakMap();
    let pinSequence = 0;
    const controller = window.AIOneLayerFactory.create({
        type: "sidepop",
        layerSelector: "[data-sidepop]",
        openAttribute: "data-sidepop-open",
        closeAttribute: "data-sidepop-close",
        closeOnLayerClick: false,
    });

    function resolveLayer(target) {
        if (target instanceof Element) return target.closest("[data-sidepop]") || target;
        if (typeof target !== "string") return null;
        return target.startsWith("#") ? document.querySelector(target) : document.getElementById(target);
    }

    function setVariant(target, variant = "run-list") {
        const layer = resolveLayer(target);
        const sidepop = layer?.querySelector(".sidepop");
        if (!sidepop || !variants.has(variant)) return false;

        variants.forEach((name) => sidepop.classList.toggle(`sidepop-variant-${name}`, name === variant));
        sidepop.dataset.sidepopVariant = variant;
        layer.dispatchEvent(
            new CustomEvent("sidepop:variant-change", {
                bubbles: true,
                detail: { variant },
            }),
        );
        return true;
    }

    function setSize(target, size = "medium") {
        const layer = resolveLayer(target);
        const sidepop = layer?.querySelector(".sidepop");
        if (!sidepop || !sizes.has(size)) return false;

        sizes.forEach((name) => sidepop.classList.toggle(`sidepop-${name}`, name === size));
        sidepop.dataset.sidepopSize = size;
        layer.dispatchEvent(
            new CustomEvent("sidepop:size-change", {
                bubbles: true,
                detail: { size },
            }),
        );
        return true;
    }

    function syncPositionControl(layer) {
        const buttons = layer?.querySelectorAll("[data-sidepop-position-toggle]");
        if (!buttons?.length) return;

        const isLeft = layer.classList.contains("sidepop-position-left");
        const destination = isLeft ? "오른쪽" : "왼쪽";
        buttons.forEach((button) => {
            const label = button.querySelector("span");
            if (label) label.textContent = `${isLeft ? "우측" : "좌측"}으로 이동`;
            button.setAttribute("aria-label", `Drawer를 ${destination}으로 이동`);
        });
    }

    function setPosition(target, position = "right") {
        const layer = resolveLayer(target);
        if (!layer) return false;

        const isLeft = position === "left";
        layer.classList.toggle("sidepop-position-left", isLeft);
        syncPositionControl(layer);
        layer.dispatchEvent(
            new CustomEvent("sidepop:position-change", {
                bubbles: true,
                detail: { position: isLeft ? "left" : "right" },
            }),
        );
        return true;
    }

    function initPositionControls(root = document) {
        const layers = [];
        if (root.matches?.("[data-sidepop]")) layers.push(root);
        root.querySelectorAll?.("[data-sidepop]").forEach((layer) => layers.push(layer));
        layers.forEach(syncPositionControl);
    }

    function getListType(item) {
        if (item?.matches(listTypes.run.itemSelector)) return "run";
        if (item?.matches(listTypes.chat.itemSelector)) return "chat";
        return "";
    }

    function getListItems(container, type) {
        const selector = listTypes[type]?.itemSelector;
        if (!container || !selector) return [];
        return Array.from(container.children).filter((item) => item.matches(selector));
    }

    function getItemTitle(item, type = getListType(item)) {
        const title = item?.querySelector(listTypes[type]?.titleSelector);
        if (!title) return "";
        if (type !== "chat") return title.textContent.replace(/\s+/g, " ").trim();

        return Array.from(title.childNodes)
            .filter((node) => !(node instanceof Element && node.classList.contains("sidepop-chat-icon")))
            .map((node) => node.textContent)
            .join("")
            .replace(/\s+/g, " ")
            .trim();
    }

    function setItemTitle(item, type, value) {
        const title = item?.querySelector(listTypes[type]?.titleSelector);
        if (!title) return;

        if (type === "chat") {
            const icon = title.querySelector(".sidepop-chat-icon");
            title.replaceChildren();
            if (icon) title.append(icon);
            title.append(document.createTextNode(value));
            item.querySelector(".sidepop-chat-select")?.setAttribute("aria-label", `${value} 대화 열기`);
            return;
        }
        title.textContent = value;
    }

    function createListActionMenu(trigger, item, type, itemIndex, itemCount) {
        const definition = listTypes[type];
        const layerId = item.closest("[data-sidepop]")?.id || "sidepop";
        const menuId = `${layerId}-${type}-action-${itemIndex + 1}`;
        const prototype = document.getElementById("commonSidepopActionPrototype");
        if (!prototype) return;
        const component = prototype.cloneNode(true);
        const menu = component.querySelector(".sidepop-list-action-menu");
        if (!menu) return;

        component.removeAttribute("id");
        component.removeAttribute("hidden");
        component.removeAttribute("data-dom-prototype");
        component.setAttribute("data-dropdown-menu", "");
        component.classList.add(`sidepop-${type}-action`);

        trigger.before(component);
        component.prepend(trigger);
        trigger.dataset.dropdownTrigger = "";
        trigger.setAttribute("aria-label", "더보기");
        trigger.setAttribute("title", "더보기");
        trigger.setAttribute("aria-haspopup", "menu");
        trigger.setAttribute("aria-expanded", "false");
        trigger.setAttribute("aria-controls", menuId);

        menu.classList.add(`sidepop-${type}-action-menu`);
        menu.id = menuId;
        menu.hidden = true;
        menu.setAttribute("role", "menu");
        menu.setAttribute("aria-label", definition.menuLabel);
        menu.dataset.placement = itemCount > 3 && itemIndex >= itemCount - 2 ? "top-end" : "bottom-end";

        actions.forEach((action) => {
            const button = menu.querySelector(`[data-menu-value="${action.value}"]`);
            const label = button?.querySelector(".sidepop-list-action-label");
            if (!button || !label) return;
            const isPinned = item.classList.contains("is-pinned");

            if (action.value === "pin") button.setAttribute("aria-pressed", String(isPinned));
            label.textContent = action.value === "pin" ? (isPinned ? "고정 해제" : "고정") : action.value === "rename" ? definition.renameLabel : action.label;
        });
    }

    function resolveSharedActionModal(item) {
        const modalId = item.closest("[data-sidepop]")?.dataset.sidepopActionModal;
        return modalId ? document.getElementById(modalId) : null;
    }

    function syncSharedActionModal(modal, item, type) {
        const isPinned = item.classList.contains("is-pinned");
        const shareButton = modal.querySelector('[data-sidepop-list-action="share"]');
        const pinButton = modal.querySelector('[data-sidepop-list-action="pin"]');
        const pinLabel = pinButton?.querySelector("[data-sidepop-action-label]");

        if (shareButton) shareButton.hidden = type !== "chat";
        pinButton?.setAttribute("aria-pressed", String(isPinned));
        if (pinLabel) pinLabel.textContent = isPinned ? "고정 해제" : "고정";
    }

    function bindSharedActionModal(modal) {
        if (!modal || modal.dataset.sidepopSharedActionsReady === "true") return;

        modal.addEventListener("click", (event) => {
            const button = event.target.closest("[data-sidepop-list-action]");
            const context = sharedActionContexts.get(modal);
            if (!button || !context) return;

            event.preventDefault();
            event.stopPropagation();
            const action = button.dataset.sidepopListAction;
            const { item, type, trigger } = context;
            window.AIOneModal?.close(modal);

            if (action === "share") {
                dispatchListAction(item, type, action, { completed: true });
                return;
            }
            if (action === "pin") {
                togglePinned(item, type);
                return;
            }
            if (["rename", "delete"].includes(action)) {
                queueMicrotask(() => openItemModal(item, type, action, trigger));
            }
        });
        modal.dataset.sidepopSharedActionsReady = "true";
    }

    function bindSharedActionTrigger(trigger, item, type, modal) {
        if (trigger.dataset.sidepopSharedActionReady === "true") return;

        trigger.setAttribute("aria-label", "더보기");
        trigger.setAttribute("title", "더보기");
        trigger.setAttribute("aria-haspopup", "menu");
        trigger.setAttribute("aria-expanded", "false");
        trigger.setAttribute("aria-controls", modal.id);
        trigger.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const layer = item.closest("[data-sidepop]");
            sharedActionContexts.set(modal, { item, type, trigger });
            syncSharedActionModal(modal, item, type);
            bindSharedActionModal(modal);
            trigger.setAttribute("aria-expanded", "true");
            // 투명 작업 메뉴는 SidePop의 기존 backdrop을 그대로 사용해야 한다.
            // 여기서까지 backdrop을 해제하면 화면 전체 dim이 사라진다.
            if (!modal.classList.contains("modal-menu-backdrop")) {
                layer?.classList.add("has-child-modal");
            }
            modal.classList.add("modal-over-sidepop");
            if (layer) modalOrigins.set(modal, layer);
            window.AIOneModal?.open(modal, trigger);
        });
        trigger.dataset.sidepopSharedActionReady = "true";
    }

    function initListActionMenus(root = document) {
        Object.entries(listTypes).forEach(([type, definition]) => {
            const items = [];
            if (root.matches?.(definition.itemSelector)) items.push(root);
            root.querySelectorAll?.(definition.itemSelector).forEach((item) => items.push(item));

            items.forEach((item) => {
                if (item.closest("[data-dom-prototype]")) return;

                const container = item.parentElement;
                const siblings = getListItems(container, type);
                if (!item.dataset.sidepopOriginalOrder) {
                    item.dataset.sidepopOriginalOrder = String(siblings.indexOf(item));
                }
                if (item.classList.contains("is-pinned") && !item.dataset.sidepopPinOrder) {
                    pinSequence += 1;
                    item.dataset.sidepopPinOrder = String(pinSequence);
                }

                const select = item.querySelector(":scope > .sidepop-chat-select");
                if (type === "chat" && select && !select.getAttribute("aria-label")) {
                    select.setAttribute("aria-label", `${getItemTitle(item, type)} 대화 열기`);
                }

                const trigger = item.querySelector(".btn-more");
                if (!trigger || trigger.closest("[data-dropdown-menu], .sidepop-list-action")) return;
                const sharedActionModal = resolveSharedActionModal(item);
                if (sharedActionModal) {
                    bindSharedActionTrigger(trigger, item, type, sharedActionModal);
                    return;
                }
                createListActionMenu(trigger, item, type, siblings.indexOf(item), siblings.length);
            });
        });

        window.AIOneDropdownMenu?.init(root);
    }

    function reorderList(item, type) {
        const container = item?.parentElement;
        const items = getListItems(container, type);
        items.sort((left, right) => {
            const leftPinned = left.classList.contains("is-pinned");
            const rightPinned = right.classList.contains("is-pinned");
            if (leftPinned !== rightPinned) return rightPinned - leftPinned;
            if (leftPinned) {
                return Number(right.dataset.sidepopPinOrder || 0) - Number(left.dataset.sidepopPinOrder || 0);
            }
            return Number(left.dataset.sidepopOriginalOrder || 0) - Number(right.dataset.sidepopOriginalOrder || 0);
        });
        items.forEach((listItem) => container.append(listItem));
    }

    function updatePinControl(item, isPinned) {
        const button = item.querySelector('.sidepop-list-action [data-menu-value="pin"]');
        button?.setAttribute("aria-pressed", String(isPinned));
        const label = button?.querySelector(".sidepop-list-action-label");
        if (label) label.textContent = isPinned ? "고정 해제" : "고정";
    }

    function dispatchListAction(item, type, action, detail = {}) {
        const payload = {
            action,
            type,
            item,
            title: getItemTitle(item, type),
            ...detail,
        };
        item.dispatchEvent(
            new CustomEvent("sidepop:list-action", {
                bubbles: true,
                detail: payload,
            }),
        );
        item.dispatchEvent(
            new CustomEvent(listTypes[type].eventName, {
                bubbles: true,
                detail: payload,
            }),
        );
    }

    function togglePinned(item, type) {
        const isPinned = !item.classList.contains("is-pinned");
        item.classList.toggle("is-pinned", isPinned);
        item.dataset.pinned = String(isPinned);
        if (isPinned) {
            pinSequence += 1;
            item.dataset.sidepopPinOrder = String(pinSequence);
        } else {
            delete item.dataset.sidepopPinOrder;
        }
        updatePinControl(item, isPinned);
        reorderList(item, type);
        dispatchListAction(item, type, "pin", { completed: true, pinned: isPinned });
    }

    function bindActionModal(modal) {
        if (!modal || modal.dataset.sidepopActionsReady === "true") return;
        modal.querySelector("[data-sidepop-rename-confirm]")?.addEventListener("click", (event) => {
            event.preventDefault();
            completeRename(modal);
        });
        modal.querySelector("[data-sidepop-delete-confirm]")?.addEventListener("click", (event) => {
            event.preventDefault();
            completeDelete(modal);
        });
        modal.dataset.sidepopActionsReady = "true";
    }

    function openItemModal(item, type, action, trigger) {
        const layer = item.closest("[data-sidepop]");
        const modalId = action === "rename" ? layer?.dataset.sidepopRenameModal : layer?.dataset.sidepopDeleteModal;
        const modal = modalId ? document.getElementById(modalId) : null;

        if (!modal || !window.AIOneModal) {
            dispatchListAction(item, type, action, { completed: false, modalAvailable: false });
            return;
        }

        bindActionModal(modal);
        modalContexts.set(modal, { action, item, type });
        modalOrigins.set(modal, layer);
        layer.classList.add("has-child-modal");
        modal.classList.add("modal-over-sidepop");
        if (action === "rename") {
            const input = modal.querySelector("[data-sidepop-rename-input]");
            const error = modal.querySelector("[data-sidepop-rename-error]");
            if (input) {
                input.value = getItemTitle(item, type);
                input.removeAttribute("aria-invalid");
            }
            if (error) error.hidden = true;
        } else {
            const title = modal.querySelector("[data-sidepop-delete-title]");
            if (title) title.textContent = getItemTitle(item, type);
        }

        window.AIOneModal.open(modal, trigger);
        if (action === "rename") {
            window.setTimeout(() => {
                const input = modal.querySelector("[data-sidepop-rename-input]");
                input?.focus();
                input?.select();
            }, 0);
        }
        dispatchListAction(item, type, action, { completed: false, modalAvailable: true });
    }

    function completeRename(modal) {
        const context = modalContexts.get(modal);
        const input = modal.querySelector("[data-sidepop-rename-input]");
        const error = modal.querySelector("[data-sidepop-rename-error]");
        const value = input?.value.trim() || "";
        if (!context || context.action !== "rename") return;

        if (!value) {
            if (error) error.hidden = false;
            input?.setAttribute("aria-invalid", "true");
            input?.focus();
            return;
        }

        const previousTitle = getItemTitle(context.item, context.type);
        setItemTitle(context.item, context.type, value);
        dispatchListAction(context.item, context.type, "rename", {
            completed: true,
            previousTitle,
            title: value,
        });
        window.AIOneModal?.close(modal);
    }

    function decrementPanelCounts(item) {
        const panel = item.closest(".sidepop-variant-panel");
        const counters = new Set(panel?.querySelectorAll(".sidepop-list-count, .sidepop-list-meta strong") || []);
        counters.forEach((counter) => {
            const current = Number(counter.textContent.match(/\d+/)?.[0]);
            if (!Number.isFinite(current)) return;
            counter.textContent = counter.textContent.replace(/\d+/, String(Math.max(0, current - 1)));
        });
    }

    function completeDelete(modal) {
        const context = modalContexts.get(modal);
        if (!context || context.action !== "delete") return;

        const { item, type } = context;
        const container = item.parentElement;
        const siblings = getListItems(container, type).filter((candidate) => candidate !== item);
        const wasActive = item.classList.contains("is-active");
        const title = getItemTitle(item, type);

        dispatchListAction(item, type, "delete", {
            completed: true,
            removed: true,
            title,
        });
        window.AIOneModal?.close(modal);
        decrementPanelCounts(item);
        item.remove();
        if (wasActive) siblings[0]?.classList.add("is-active");
    }

    function getRuleItems(list) {
        return Array.from(list?.children || []).filter((item) => item.matches(".rule-item"));
    }

    function activateRuleItem(item, shouldFocus = false) {
        const list = item?.closest(".rule-list");
        const items = getRuleItems(list);
        if (!list || !items.includes(item)) return false;

        items.forEach((ruleItem) => {
            const isActive = ruleItem === item;
            ruleItem.classList.toggle("active", isActive);
            ruleItem.setAttribute("aria-selected", String(isActive));
            ruleItem.tabIndex = isActive ? 0 : -1;
        });
        if (shouldFocus) item.focus();
        return true;
    }

    function initRuleLists(root = document) {
        const lists = [];
        if (root.matches?.(".rule-list")) lists.push(root);
        root.querySelectorAll?.(".rule-list").forEach((list) => lists.push(list));

        lists.forEach((list) => {
            const items = getRuleItems(list);
            if (!items.length) return;

            list.setAttribute("role", "tablist");
            list.setAttribute("aria-orientation", "vertical");
            items.forEach((item) => item.setAttribute("role", "tab"));
            activateRuleItem(items.find((item) => item.classList.contains("active")) || items[0]);
        });
    }

    document.addEventListener(
        "click",
        (event) => {
            const positionButton = event.target.closest("[data-sidepop-position-toggle]");
            if (positionButton) {
                const layer = positionButton.closest("[data-sidepop]");
                setPosition(layer, layer?.classList.contains("sidepop-position-left") ? "right" : "left");
                return;
            }

            const trigger = event.target.closest("[data-sidepop-open]");
            if (trigger) {
                const target = trigger.getAttribute("data-sidepop-open");
                if (trigger.dataset.sidepopSize) setSize(target, trigger.dataset.sidepopSize);
                if (trigger.dataset.sidepopVariant) setVariant(target, trigger.dataset.sidepopVariant);
                return;
            }

            const ruleItem = event.target.closest(".rule-list > .rule-item");
            if (ruleItem) activateRuleItem(ruleItem);
        },
        true,
    );

    document.addEventListener("input", (event) => {
        const input = event.target.closest("[data-sidepop-rename-input]");
        if (!input) return;
        input.removeAttribute("aria-invalid");
        const error = input.closest("[data-modal]")?.querySelector("[data-sidepop-rename-error]");
        if (error) error.hidden = true;
    });

    document.addEventListener("dropdownmenu:select", (event) => {
        const actionComponent = event.target.closest?.(".sidepop-list-action");
        const item = actionComponent?.closest(".sidepop-run-item, .sidepop-chat-item");
        const type = getListType(item);
        const action = event.detail?.value;
        if (!item || !type || !actions.some((candidate) => candidate.value === action)) return;

        if (action === "pin") {
            togglePinned(item, type);
            return;
        }

        const trigger = actionComponent.querySelector("[data-dropdown-trigger]");
        queueMicrotask(() => openItemModal(item, type, action, trigger));
    });

    document.addEventListener("keydown", (event) => {
        const renameInput = event.target.closest?.("[data-sidepop-rename-input]");
        if (renameInput && event.key === "Enter") {
            event.preventDefault();
            renameInput.closest("[data-modal]")?.querySelector("[data-sidepop-rename-confirm]")?.click();
            return;
        }

        const currentItem = event.target.closest?.(".rule-list > .rule-item");
        if (!currentItem) return;

        const items = getRuleItems(currentItem.closest(".rule-list"));
        const currentIndex = items.indexOf(currentItem);
        let nextItem = null;

        if (event.key === "ArrowDown") nextItem = items[(currentIndex + 1) % items.length];
        if (event.key === "ArrowUp") nextItem = items[(currentIndex - 1 + items.length) % items.length];
        if (event.key === "Home") nextItem = items[0];
        if (event.key === "End") nextItem = items[items.length - 1];
        if (["Enter", " "].includes(event.key)) nextItem = currentItem;
        if (!nextItem) return;

        event.preventDefault();
        activateRuleItem(nextItem, true);
    });

    document.addEventListener("modal:close", (event) => {
        const origin = modalOrigins.get(event.target);
        if (!origin) return;
        sharedActionContexts.get(event.target)?.trigger?.setAttribute("aria-expanded", "false");
        origin.classList.remove("has-child-modal");
        event.target.classList.remove("modal-over-sidepop");
        modalOrigins.delete(event.target);
        sharedActionContexts.delete(event.target);
    });

    window.AIOneSidePop = Object.freeze({
        init: controller.init,
        open: controller.open,
        close: controller.close,
        setVariant,
        setSize,
        setPosition,
        initRuleLists,
        initListActionMenus,
        initRunActionMenus: initListActionMenus,
    });
    document.addEventListener("DOMContentLoaded", () => {
        controller.init();
        initPositionControls();
        initRuleLists();
        initListActionMenus();
    });
    document.addEventListener("app:includes-ready", (event) => {
        controller.init(event.target);
        initPositionControls(event.target);
        initRuleLists(event.target);
        initListActionMenus(event.target);
    });
})();

/* ============================ End: 사이드 팝업 (Side Pop) ============================== */

/* ============================ Start: 텍스트 입력 영역 (Textarea) ============================ */

(() => {
    function bindCharacterCount(field) {
        if (!field || field.dataset.characterCountReady === "true") return;

        const textarea = field.querySelector("textarea[maxlength]");
        const currentCount = field.querySelector("[data-character-current]");
        if (!textarea || !currentCount) return;

        const sync = () => {
            currentCount.textContent = String(textarea.value.length);
        };
        textarea.addEventListener("input", sync);
        field.dataset.characterCountReady = "true";
        sync();
    }

    function init(root = document) {
        if (root.matches?.("[data-character-count]")) bindCharacterCount(root);
        root.querySelectorAll?.("[data-character-count]").forEach(bindCharacterCount);
    }

    window.AIOneTextarea = Object.freeze({ init });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init(), { once: true });
    } else {
        init();
    }
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* ============================ End: 텍스트 입력 영역 (Textarea) ============================== */

/* ============================ Start: 토스트 (Toast) ============================ */

(() => {
    const timers = new WeakMap();

    function resolve(target) {
        if (target instanceof Element) return target;
        if (typeof target === "string") return document.querySelector(target);
        return document.querySelector("[data-toast]");
    }

    function hide(target) {
        const toast = resolve(target);
        if (!toast) return;

        const currentTimers = timers.get(toast);
        if (currentTimers) {
            clearTimeout(currentTimers.hide);
            clearTimeout(currentTimers.hidden);
        }

        toast.classList.remove("is-visible");
        const hiddenTimer = window.setTimeout(() => {
            if (!toast.classList.contains("is-visible")) toast.hidden = true;
        }, 200);
        timers.set(toast, { hide: 0, hidden: hiddenTimer });
    }

    function show(message, options = {}) {
        const toast = resolve(options.target);
        if (!toast) return null;

        const messageElement = toast.querySelector("[data-toast-message]") || toast;
        messageElement.textContent = String(message ?? "");
        toast.hidden = false;
        toast.setAttribute("role", toast.getAttribute("role") || "status");
        toast.setAttribute("aria-live", toast.getAttribute("aria-live") || "polite");
        toast.setAttribute("aria-atomic", "true");

        const currentTimers = timers.get(toast);
        if (currentTimers) {
            clearTimeout(currentTimers.hide);
            clearTimeout(currentTimers.hidden);
        }

        window.requestAnimationFrame(() => toast.classList.add("is-visible"));

        const duration = Number.isFinite(Number(options.duration)) ? Math.max(0, Number(options.duration)) : 2000;
        const hideTimer = duration > 0 ? window.setTimeout(() => hide(toast), duration) : 0;
        timers.set(toast, { hide: hideTimer, hidden: 0 });
        return toast;
    }

    window.AIOneToast = Object.freeze({ show, hide });
})();

/* ============================ End: 토스트 (Toast) ============================== */

/* ============================ Start: 탑바 (Top Bar) ============================ */

(() => {
    const FONT_STORAGE_KEY = "ai-one-font-scale";
    const MIN_FONT_PERCENT = 100;
    const MAX_FONT_PERCENT = 150;
    const FONT_STEP = 10;

    function clampFontPercent(value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return MIN_FONT_PERCENT;
        return Math.min(MAX_FONT_PERCENT, Math.max(MIN_FONT_PERCENT, Math.round(numericValue)));
    }

    function readFontPercent() {
        try {
            const scale = Number(localStorage.getItem(FONT_STORAGE_KEY));
            return Number.isFinite(scale) ? clampFontPercent(scale * 100) : MIN_FONT_PERCENT;
        } catch (error) {
            return MIN_FONT_PERCENT;
        }
    }

    function applyFontPercent(percent) {
        const nextPercent = clampFontPercent(percent);
        const scale = nextPercent / 100;

        document.documentElement.style.setProperty("--ui-font-scale", String(scale));
        try {
            localStorage.setItem(FONT_STORAGE_KEY, String(scale));
        } catch (error) {
            // 저장소를 사용할 수 없는 환경에서는 현재 화면에만 적용합니다.
        }

        document.querySelectorAll("[data-accessory-font-value]").forEach((value) => {
            value.textContent = `${nextPercent}%`;
        });
        document.querySelectorAll("[data-accessory-font-decrease]").forEach((button) => {
            button.disabled = nextPercent <= MIN_FONT_PERCENT;
        });
        document.querySelectorAll("[data-accessory-font-increase]").forEach((button) => {
            button.disabled = nextPercent >= MAX_FONT_PERCENT;
        });
        document.dispatchEvent(
            new CustomEvent("ai-one-font-size-change", {
                detail: { percent: nextPercent, scale },
            }),
        );
    }

    async function toggleFullscreen() {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
        } catch (error) {
            document.dispatchEvent(new CustomEvent("topbar:fullscreen-unavailable"));
        }
    }

    function setOpen(tool, shouldOpen) {
        const trigger = tool.querySelector(".accessory-trigger");
        const fontPanel = tool.querySelector(".accessory-font-panel");

        tool.classList.toggle("open", shouldOpen);
        trigger?.classList.toggle("active", shouldOpen);
        trigger?.setAttribute("aria-expanded", String(shouldOpen));
        if (!shouldOpen) fontPanel?.classList.add("hidden");
    }

    function closeOtherTools(currentTool) {
        document.querySelectorAll(".accessory-tool.open").forEach((tool) => {
            if (tool !== currentTool) setOpen(tool, false);
        });
    }

    function initAccessoryTool(tool) {
        if (tool.dataset.topbarAccessoryReady === "true") return;

        const trigger = tool.querySelector(".accessory-trigger");
        const fontPanel = tool.querySelector(".accessory-font-panel");
        if (!trigger || !fontPanel) return;

        tool.dataset.topbarAccessoryReady = "true";
        trigger.addEventListener("click", (event) => {
            event.stopPropagation();
            const shouldOpen = !tool.classList.contains("open");
            closeOtherTools(shouldOpen ? tool : null);
            setOpen(tool, shouldOpen);
        });

        tool.querySelectorAll("[data-accessory-action]").forEach((button) => {
            button.addEventListener("click", (event) => {
                event.stopPropagation();
                const action = button.dataset.accessoryAction;
                if (button.classList.contains("is-disabled")) return;

                if (action === "font") {
                    const shouldOpen = fontPanel.classList.contains("hidden");
                    fontPanel.classList.toggle("hidden", !shouldOpen);
                    button.setAttribute("aria-expanded", String(shouldOpen));
                    return;
                }

                fontPanel.classList.add("hidden");
                if (action === "fullscreen") toggleFullscreen();
                tool.dispatchEvent(
                    new CustomEvent("topbar:accessory-action", {
                        bubbles: true,
                        detail: { action },
                    }),
                );
            });
        });

        tool.querySelector("[data-accessory-font-decrease]")?.addEventListener("click", (event) => {
            event.stopPropagation();
            applyFontPercent(readFontPercent() - FONT_STEP);
        });
        tool.querySelector("[data-accessory-font-increase]")?.addEventListener("click", (event) => {
            event.stopPropagation();
            applyFontPercent(readFontPercent() + FONT_STEP);
        });
        tool.querySelector(".accessory-font-default")?.addEventListener("click", (event) => {
            event.stopPropagation();
            applyFontPercent(MIN_FONT_PERCENT);
        });
        fontPanel.addEventListener("click", (event) => event.stopPropagation());
    }

    function init(root = document) {
        const tools = [];
        if (root instanceof Element && root.matches("[data-accessory-tools]")) tools.push(root);
        root.querySelectorAll?.("[data-accessory-tools]").forEach((tool) => tools.push(tool));
        tools.forEach(initAccessoryTool);
        applyFontPercent(readFontPercent());
    }

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        document.querySelectorAll(".accessory-tool.open").forEach((tool) => setOpen(tool, false));
    });
    document.addEventListener("click", (event) => {
        if (event.target.closest(".accessory-tool")) return;
        document.querySelectorAll(".accessory-tool.open").forEach((tool) => setOpen(tool, false));
    });
    document.addEventListener("component:ready", (event) => {
        if (event.detail?.name === "topbar") init(event.target);
    });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => init());
    else init();

    window.AIOneTopbar = Object.freeze({ init, applyFontPercent });
})();

/* ============================ End: 탑바 (Top Bar) ============================== */

window.AIOneSharedBundle = Object.freeze({ assetsBundled: true });
