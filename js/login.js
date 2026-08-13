(() => {
    "use strict";

    /* 파일 구성: 로그인 저장 상태 -> 폼 검증 -> 제출/이동. */

    /* ============================ 시작: 로그인 폼 ============================ */

    const SAVED_ID_KEY = "ai-one-saved-login-id";

    // 로그인 폼 초기화
    function initLoginForm() {
        const form = document.getElementById("loginForm");
        const userId = document.getElementById("userId");
        const userPw = document.getElementById("userPw");
        const saveId = document.getElementById("rememberMe");
        if (!form || !userId || !userPw || !saveId || form.dataset.loginReady === "true") return;

        form.dataset.loginReady = "true";
        try {
            const savedId = localStorage.getItem(SAVED_ID_KEY);
            if (savedId) {
                userId.value = savedId;
                saveId.checked = true;
                userPw.focus();
            }
        } catch (error) {
            /* 저장소를 사용할 수 없어도 현재 로그인은 계속 진행 */
        }

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const id = userId.value.trim();
            const password = userPw.value.trim();
            if (!id || !password) {
                window.alert("아이디와 비밀번호를 입력해주세요.");
                return;
            }

            try {
                if (saveId.checked) localStorage.setItem(SAVED_ID_KEY, id);
                else localStorage.removeItem(SAVED_ID_KEY);
            } catch (error) {
                /* 저장소를 사용할 수 없어도 현재 로그인은 계속 진행 */
            }
            window.location.href = "ai-home.html";
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initLoginForm, { once: true });
    } else {
        initLoginForm();
    }

    /* ============================ 끝: 로그인 폼 ============================== */
})();
