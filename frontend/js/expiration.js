const expirationFilter = document.getElementById("expiration-filter");
const expirationPageSize = 10;
let expirationPage = 1;
let expirationProducts = [];
let expirationWarningDays = 0;
let expirationInvalidCount = 0;
let expirationLoading = false;
let expirationLoadError = "";

const expirationLoadRequest = Sari2Api.createRequestGuard(function (pending) {
    expirationLoading = pending;
    renderExpiration();
});

function initializeExpirationFilterFromUrl() {
    const requested = new URLSearchParams(window.location.search).get("expirationStatus");
    const option = Array.from(expirationFilter.options).find(function (item) {
        return item.value && item.value.toLowerCase().replaceAll(" ", "-") === requested;
    });
    if (option) expirationFilter.value = option.value;
}

async function loadExpiration(forceRefresh = false) {
    expirationLoadError = "";
    return expirationLoadRequest.run(async function () {
        try {
            const context = forceRefresh ? await initializeApp(true) : await appReady;
            if (!context) {
                throw new Sari2Api.ApiError("AUTHENTICATION_REQUIRED", "Unable to load expiration monitoring.");
            }
            const monitoring = await Sari2Api.request("/monitoring");
            if (!monitoring || !Array.isArray(monitoring.products) ||
                !Number.isSafeInteger(monitoring.expirationWarningDays) ||
                !monitoring.counts || !Number.isSafeInteger(monitoring.counts.invalidDate) ||
                monitoring.products.some(function (product) {
                    return !product || typeof product.name !== "string" ||
                        !["Safe", "Expiring Soon", "Expired", "No Expiration", "Invalid Date"].includes(product.expirationStatus);
                })) {
                throw new Sari2Api.ApiError("INVALID_RESPONSE", "The server returned invalid monitoring data.");
            }
            expirationProducts = monitoring.products;
            expirationWarningDays = monitoring.expirationWarningDays;
            expirationInvalidCount = monitoring.counts.invalidDate;
            expirationLoadError = "";
            return true;
        } catch (error) {
            expirationProducts = [];
            expirationInvalidCount = 0;
            expirationLoadError = error instanceof Sari2Api.ApiError
                ? error.message
                : "Unable to load expiration monitoring.";
            return false;
        }
    });
}

function renderExpiration() {
    const body = document.getElementById("expiration-list");
    body.replaceChildren();
    document.getElementById("expiration-feedback").textContent = expirationLoadError ||
        (expirationInvalidCount > 0
            ? "Some products have invalid expiration dates. Review their dates on the Products page."
            : "");

    if (expirationLoading || expirationLoadError) {
        document.getElementById("expiration-window").textContent = "";
        document.getElementById("expiration-count").textContent = "";
        document.getElementById("expiration-pagination").hidden = true;
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 4;
        cell.className = "empty-state";
        cell.textContent = expirationLoading
            ? "Loading expiration monitoring..."
            : "Expiration monitoring could not be loaded.";
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }

    const matching = expirationProducts.filter(function (product) {
        return !expirationFilter.value || product.expirationStatus === expirationFilter.value;
    });
    matching.sort(function (left, right) {
        return left.name.localeCompare(right.name, "en", { sensitivity: "base" });
    });
    const pageCount = Math.max(1, Math.ceil(matching.length / expirationPageSize));
    expirationPage = Math.max(1, Math.min(expirationPage, pageCount));
    document.getElementById("expiration-pagination").hidden = matching.length <= expirationPageSize;
    document.getElementById("expiration-page-info").textContent = "Page " + expirationPage + " of " + pageCount;
    document.getElementById("expiration-previous").disabled = expirationPage === 1;
    document.getElementById("expiration-next").disabled = expirationPage === pageCount;

    document.getElementById("expiration-window").textContent =
        "Expiring Soon includes today and the next " + expirationWarningDays + " days.";
    document.getElementById("expiration-count").textContent =
        "Showing " + matching.length + " of " + expirationProducts.length + " products.";

    if (matching.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 4;
        cell.className = "empty-state";
        cell.textContent = expirationProducts.length === 0
            ? "No products found."
            : "No products match this expiration status.";
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }
    const start = (expirationPage - 1) * expirationPageSize;
    matching.slice(start, start + expirationPageSize).forEach(function (product) {
        const row = document.createElement("tr");
        [product.name, product.quantity, formatExpirationDate(product.expirationDate)].forEach(function (value) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });
        const statusCell = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = "status-badge status-" + product.expirationStatus.toLowerCase().replaceAll(" ", "-");
        badge.textContent = product.expirationStatus;
        statusCell.appendChild(badge);
        row.appendChild(statusCell);
        body.appendChild(row);
    });
}

expirationFilter.addEventListener("change", function () {
    expirationPage = 1;
    renderExpiration();
});
document.getElementById("expiration-previous").addEventListener("click", function () {
    expirationPage -= 1;
    renderExpiration();
});
document.getElementById("expiration-next").addEventListener("click", function () {
    expirationPage += 1;
    renderExpiration();
});
initializeExpirationFilterFromUrl();
loadExpiration();
window.addEventListener("pageshow", function (event) {
    if (event.persisted) loadExpiration(true);
});
window.addEventListener("focus", function () {
    loadExpiration(true);
});
