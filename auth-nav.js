(function () {
    function apiBase() {
        if (window.location.protocol === "file:") {
            return "http://localhost:3000";
        }
        return "";
    }

    function getToken() {
        return localStorage.getItem("cannonballToken");
    }

    function getEmail() {
        return localStorage.getItem("cannonballEmail");
    }

    function setSession(token, email) {
        localStorage.setItem("cannonballToken", token);
        localStorage.setItem("cannonballEmail", email);
        localStorage.setItem("loggedIn", "true");
    }

    function clearSession() {
        localStorage.removeItem("cannonballToken");
        localStorage.removeItem("cannonballEmail");
        localStorage.removeItem("loggedIn");
    }

    function authHeaders() {
        var token = getToken();
        if (!token) {
            return {};
        }
        return { Authorization: "Bearer " + token };
    }

    window.CannonballAuth = {
        apiBase: apiBase,
        getToken: getToken,
        getEmail: getEmail,
        setSession: setSession,
        clearSession: clearSession,
        isLoggedIn: function () {
            return Boolean(getToken());
        },
        authHeaders: authHeaders
    };
})();
