(function (global) {
    "use strict";

    const apiPrefix = "/api";

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
            throw new ApiError(
                "NETWORK_ERROR",
                "Unable to connect to the Sari2 server. Check that it is running and try again.",
                { cause: error }
            );
        }

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
        request: request
    });

    global.Sari2Api = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
