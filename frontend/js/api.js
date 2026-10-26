(function () {
    "use strict";

    const API_BASE = "/api";

    class ApiError extends Error {
        constructor(code, message, status) {
            super(message || "An unexpected API error occurred.");
            this.name = "ApiError";
            this.code = code || "API_ERROR";
            this.status = status || 0;
        }
    }

    async function request(path, options = {}) {
        const normalizedPath = String(path).replace(/^\/+/, "");
        const headers = new Headers(options.headers || {});
        const config = { credentials: "same-origin", ...options, headers };

        if (config.body != null && typeof config.body !== "string") {
            headers.set("Content-Type", "application/json");
            config.body = JSON.stringify(config.body);
        }

        let response;

        try {
            response = await fetch(API_BASE + "/" + normalizedPath, config);
        } catch (error) {
            throw new ApiError(
                "NETWORK_ERROR",
                "Unable to connect to the server. Check that the backend is running."
            );
        }

        if (response.status === 204) return null;

        const contentType = response.headers.get("content-type") || "";
        let data;

        try {
            data = contentType.includes("application/json")
                ? await response.json()
                : await response.text();
        } catch (error) {
            throw new ApiError(
                "INVALID_RESPONSE",
                "The server returned an unreadable response.",
                response.status
            );
        }

        if (!response.ok) {
            const details = data && typeof data === "object" ? data.error : null;
            throw new ApiError(
                details && details.code,
                details && details.message || "The request failed. Please try again.",
                response.status
            );
        }

        return data;
    }

    function createRequestGuard(onPending = function () {}) {
        let pending = false;

        return {
            get pending() {
                return pending;
            },

            async run(callback) {
                if (pending) return null;

                pending = true;
                onPending(true);

                try {
                    return await callback();
                } finally {
                    pending = false;
                    onPending(false);
                }
            }
        };
    }

    window.Sari2Api = Object.freeze({
        ApiError,
        createRequestGuard,
        request
    });
})();
