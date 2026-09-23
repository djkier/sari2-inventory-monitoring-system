const expirationFilter = document.getElementById("expiration-filter");
const expirationPageSize = 10;
let expirationPage = 1;

function initializeExpirationFilterFromUrl() {
    const requested = new URLSearchParams(window.location.search).get("expirationStatus");
    const option = Array.from(expirationFilter.options).find(function (item) {
        return item.value && item.value.toLowerCase().replaceAll(" ", "-") === requested;
    });
    if (option) expirationFilter.value = option.value;
}

function renderExpiration() {
    if (!initializeApp()) return;

    storageWarnings.length = 0;
    const settings = getSettings();
    const products = getProducts();
    const today = new Date();
    // Expiration depends only on the date, never on the stock quantity or threshold.
    const entries = products.map(function (product) {
        return { product: product, status: getExpirationStatus(product, settings.expirationWarningDays, today) };
    });
    const matching = entries.filter(function (entry) {
        return !expirationFilter.value || entry.status === expirationFilter.value;
    });
    matching.sort(function (a, b) { return a.product.name.localeCompare(b.product.name, "en", { sensitivity: "base" }); });
    const pageCount = Math.max(1, Math.ceil(matching.length / expirationPageSize));
    expirationPage = Math.max(1, Math.min(expirationPage, pageCount));
    document.getElementById("expiration-pagination").hidden = matching.length <= expirationPageSize;
    document.getElementById("expiration-page-info").textContent = "Page " + expirationPage + " of " + pageCount;
    document.getElementById("expiration-previous").disabled = expirationPage === 1;
    document.getElementById("expiration-next").disabled = expirationPage === pageCount;

    document.getElementById("store-name").textContent = settings.storeName;
    document.getElementById("expiration-window").textContent = "Expiring Soon includes today and the next " + settings.expirationWarningDays + " days.";
    document.getElementById("expiration-count").textContent = "Showing " + matching.length + " of " + products.length + " products.";
    if (entries.some(function (entry) { return entry.status === "Invalid Date"; })) {
        storageWarnings.push("Some products have invalid expiration dates. Review their dates on the Products page.");
    }
    document.getElementById("expiration-feedback").textContent = storageWarnings.join(" ");

    const body = document.getElementById("expiration-list");
    body.replaceChildren();
    if (matching.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 4;
        cell.className = "empty-state";
        cell.textContent = products.length === 0 ? "No products found." : "No products match this expiration status.";
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }
    const start = (expirationPage - 1) * expirationPageSize;
    matching.slice(start, start + expirationPageSize).forEach(function (entry) {
        const row = document.createElement("tr");
        [entry.product.name, entry.product.quantity, formatExpirationDate(entry.product.expirationDate)].forEach(function (value) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });
        const statusCell = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = "status-badge status-" + entry.status.toLowerCase().replaceAll(" ", "-");
        badge.textContent = entry.status;
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
renderExpiration();
window.addEventListener("pageshow", renderExpiration);
window.addEventListener("focus", renderExpiration);
window.addEventListener("storage", function (event) {
    if (event.key === "sari2_products" || event.key === "sari2_settings" || event.key === null) {
        renderExpiration();
    }
});
