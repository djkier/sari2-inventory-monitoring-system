(function (global) {
    "use strict";

    const apiPrefix = "/api";
    const connectionToastId = "server-connection-toast";
    let connectionUnavailable = false;
    let connectionToastDismissed = false;

    class ApiError extends Error {
        constructor(code, message, options = {}) {
            super(message);
            this.name = "ApiError";
            this.code = code;
            this.status = options.status || 0;
            if (options.details !== undefined) this.details = options.details;
            if (options.cause !== undefined) this.cause = options.cause;
        }
    }

    function removeConnectionToast() {
        if (typeof document === "undefined") return;
        const toast = document.getElementById(connectionToastId);
        if (toast) toast.remove();
    }

    function showConnectionToast() {
        if (typeof document === "undefined" || connectionToastDismissed ||
            document.getElementById(connectionToastId)) return;

        const toast = document.createElement("div");
        const icon = document.createElement("span");
        const message = document.createElement("div");
        const title = document.createElement("strong");
        const detail = document.createElement("span");
        const closeButton = document.createElement("button");

        toast.id = connectionToastId;
        toast.className = "server-connection-toast";
        toast.setAttribute("role", "alert");
        toast.setAttribute("aria-live", "assertive");
        toast.setAttribute("aria-atomic", "true");
        icon.className = "server-connection-toast-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "!";
        message.className = "server-connection-toast-message";
        title.textContent = "Unable to connect to the Sari2 server.";
        detail.textContent = "Check that it is running and try again.";
        closeButton.className = "server-connection-toast-close";
        closeButton.type = "button";
        closeButton.setAttribute("aria-label", "Dismiss server connection error");
        closeButton.textContent = "\u00d7";
        closeButton.addEventListener("click", function () {
            connectionToastDismissed = true;
            removeConnectionToast();
        });

        message.append(title, detail);
        toast.append(icon, message, closeButton);
        document.body.appendChild(toast);
    }

    function reportConnectionFailure() {
        if (!connectionUnavailable) {
            connectionUnavailable = true;
            connectionToastDismissed = false;
        }
        showConnectionToast();
    }

    function reportConnectionRecovery() {
        if (!connectionUnavailable) return;
        connectionUnavailable = false;
        connectionToastDismissed = false;
        removeConnectionToast();
    }

    function isNetworkError(error) {
        return Boolean(error && error.code === "NETWORK_ERROR");
    }

    function getInlineErrorMessage(error, fallback) {
        if (isNetworkError(error) || connectionUnavailable) return "";
        return error && typeof error.message === "string" && error.message ? error.message : fallback;
    }

    function buildApiUrl(path) {
        if (typeof path !== "string" || !path.trim()) {
            throw new TypeError("An API path is required.");
        }
        const normalizedPath = path.trim();
        if (normalizedPath === apiPrefix || normalizedPath.startsWith(apiPrefix + "/")) {
            return normalizedPath;
        }
        return apiPrefix + "/" + normalizedPath.replace(/^\/+/, "");
    }

    function isSerializableBody(body) {
        if (body === null || typeof body !== "object") return false;
        if (typeof FormData !== "undefined" && body instanceof FormData) return false;
        if (typeof Blob !== "undefined" && body instanceof Blob) return false;
        if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return false;
        return true;
    }

    async function request(path, options = {}) {
        const url = buildApiUrl(path);
        const headers = new Headers(options.headers || {});
        headers.set("Accept", "application/json");

        let body = options.body;
        if (isSerializableBody(body)) {
            body = JSON.stringify(body);
            if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
        }

        let response;
        try {
            response = await fetch(url, {
                ...options,
                headers: headers,
                body: body,
                credentials: "include"
            });
        } catch (error) {
            reportConnectionFailure();
            throw new ApiError(
                "NETWORK_ERROR",
                "Unable to connect to the Sari2 server. Check that it is running and try again.",
                { cause: error }
            );
        }
        reportConnectionRecovery();

        let payload;
        try {
            payload = await response.json();
        } catch (error) {
            throw new ApiError(
                "INVALID_RESPONSE",
                "The server returned an unreadable response.",
                { status: response.status, cause: error }
            );
        }

        if (!response.ok) {
            const serverError = payload && payload.error;
            throw new ApiError(
                serverError && serverError.code ? serverError.code : "HTTP_ERROR",
                serverError && serverError.message ? serverError.message : "The request failed.",
                {
                    status: response.status,
                    details: serverError && serverError.details
                }
            );
        }

        if (!payload || payload.success !== true || !Object.prototype.hasOwnProperty.call(payload, "data")) {
            throw new ApiError(
                "INVALID_RESPONSE",
                "The server returned an unexpected response.",
                { status: response.status }
            );
        }

        return payload.data;
    }

    function createRequestGuard(onPendingChange) {
        let activeRequest = null;

        function notify(isPending) {
            if (typeof onPendingChange === "function") onPendingChange(isPending);
        }

        return {
            get isPending() {
                return activeRequest !== null;
            },
            run: function (operation) {
                if (activeRequest) return activeRequest;
                if (typeof operation !== "function") {
                    return Promise.reject(new TypeError("A request operation is required."));
                }

                notify(true);
                activeRequest = Promise.resolve()
                    .then(operation)
                    .finally(function () {
                        activeRequest = null;
                        notify(false);
                    });
                return activeRequest;
            }
        };
    }

    const api = Object.freeze({
        ApiError: ApiError,
        createRequestGuard: createRequestGuard,
        getInlineErrorMessage: getInlineErrorMessage,
        isConnectionUnavailable: function () { return connectionUnavailable; },
        isNetworkError: isNetworkError,
        request: request
    });

    global.Sari2Api = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
