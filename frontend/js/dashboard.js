const dashboardContent = document.querySelector(".app-content");
const dashboardFeedback = document.getElementById("dashboard-feedback");
let dashboardData = null;
let dashboardLoaded = false;

function setDashboardPending(isPending) {
    dashboardContent.setAttribute("aria-busy", isPending ? "true" : "false");
    if (isPending && !dashboardLoaded) renderDashboardUnavailable("Loading dashboard data...");
}

const dashboardRequest = Sari2Api.createRequestGuard(setDashboardPending);

function renderDashboardUnavailable(message) {
    ["total-products", "low-stock-count", "expiring-soon-count", "out-of-stock-count"].forEach(function (id) {
        document.getElementById(id).textContent = "—";
    });
    document.getElementById("expiration-window").textContent = "";
    document.getElementById("inventory-empty").hidden = true;
    document.getElementById("view-all-low-stock").hidden = true;
    document.getElementById("view-all-out-of-stock").hidden = true;
    document.getElementById("view-all-expiring-soon").hidden = true;
    renderMonitoringRows("low-stock-list", [], message, 3, 0);
    renderMonitoringRows("out-of-stock-list", [], message, 3, 0);
    renderMonitoringRows("expiring-soon-list", [], message, 2, 0);
}

function renderDashboard(data) {
    const summary = data.summary;
    const monitoring = data.monitoring;

    document.getElementById("total-products").textContent = summary.totalProducts;
    document.getElementById("low-stock-count").textContent = summary.lowStock;
    document.getElementById("expiring-soon-count").textContent = summary.expiringSoon;
    document.getElementById("out-of-stock-count").textContent = summary.outOfStock;
    document.getElementById("expiration-window").textContent =
        "Today and the next " + data.expirationWarningDays + " days.";
    document.getElementById("inventory-empty").hidden = summary.totalProducts !== 0;

    document.getElementById("view-all-low-stock").hidden = summary.lowStock === 0;
    document.getElementById("view-all-out-of-stock").hidden = summary.outOfStock === 0;
    document.getElementById("view-all-expiring-soon").hidden = summary.expiringSoon === 0;

    renderMonitoringRows("low-stock-list", monitoring.lowStock.slice(0, 3).map(function (product) {
        return [product.name, product.quantity, product.lowStockThreshold];
    }), "No low-stock products.", 3, summary.lowStock);

    renderMonitoringRows("out-of-stock-list", monitoring.outOfStock.slice(0, 3).map(function (product) {
        return [product.name, product.category || "N/A", product.quantity];
    }), "No out-of-stock products.", 3, summary.outOfStock);

    renderExpiringSoonPreview(monitoring.expiringSoon.map(function (product) {
        return [product.name, formatExpirationDate(product.expirationDate)];
    }));
}

async function loadDashboard(forceRefresh = false) {
    dashboardFeedback.textContent = "";
    try {
        const data = await dashboardRequest.run(async function () {
            const context = forceRefresh ? await initializeApp(true) : await appReady;
            if (!context) return null;
            return Sari2Api.request("/dashboard");
        });
        if (!data) {
            dashboardData = null;
            dashboardLoaded = false;
            renderDashboardUnavailable("Dashboard data is unavailable.");
            return;
        }
        dashboardData = data;
        dashboardLoaded = true;
        renderDashboard(data);
    } catch (error) {
        dashboardData = null;
        dashboardLoaded = false;
        renderDashboardUnavailable("Dashboard data is unavailable.");
        dashboardFeedback.textContent = error.message ||
            "Unable to load dashboard data. Check the server and try again.";
    }
}

function renderExpiringSoonPreview(rows) {
    const body = document.getElementById("expiring-soon-list");
    const card = body.closest(".monitoring-card");
    const stockCards = document.querySelectorAll(".dashboard-stock-column > .monitoring-card");
    // Measure the actual left cards, not their stretched grid container. The right
    // preview must never enlarge the height used to calculate its own capacity.
    const leftHeight = stockCards[1].getBoundingClientRect().bottom - stockCards[0].getBoundingClientRect().top;
    const style = window.getComputedStyle(card);
    const bottomInset = parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth);
    let visible = 0;

    for (let count = 1; count <= rows.length; count += 1) {
        renderMonitoringRows("expiring-soon-list", rows.slice(0, count), "No products are expiring soon.", 2, rows.length);
        const availableBottom = card.getBoundingClientRect().top + leftHeight - bottomInset;
        if (body.closest("table").getBoundingClientRect().bottom > availableBottom) {
            // The last product can replace the 'more' row without adding height.
            if (count === rows.length - 1) {
                renderMonitoringRows("expiring-soon-list", rows, "No products are expiring soon.", 2, rows.length);
                if (body.closest("table").getBoundingClientRect().bottom <= availableBottom) visible = rows.length;
            }
            break;
        }
        visible = count;
    }
    renderMonitoringRows("expiring-soon-list", rows.slice(0, visible), "No products are expiring soon.", 2, rows.length);
}

function renderMonitoringRows(targetId, rows, emptyMessage, columnCount, totalCount) {
    const body = document.getElementById(targetId);
    body.replaceChildren();

    if (totalCount === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = columnCount;
        cell.className = "empty-state";
        cell.textContent = emptyMessage;
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }
    rows.forEach(function (values) {
        const row = document.createElement("tr");
        values.forEach(function (value, index) {
            const cell = document.createElement("td");
            cell.textContent = value;
            if (index === 0) {
                cell.className = "dashboard-product-name";
                cell.title = value;
            } else if (targetId !== "out-of-stock-list" || index === 2) {
                cell.className = "dashboard-centered";
            }
            row.appendChild(cell);
        });
        body.appendChild(row);
    });

    const remaining = totalCount - rows.length;

    if (remaining > 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = columnCount;
        cell.className = "dashboard-more-products";
        cell.textContent = "+" + remaining + " more " + (remaining === 1 ? "product" : "products");
        row.appendChild(cell);
        body.appendChild(row);
    }
}

loadDashboard();
window.addEventListener("pageshow", function (event) {
    if (event.persisted) loadDashboard(true);
});
window.addEventListener("focus", function () {
    loadDashboard(true);
});
let dashboardResizeFrame;
window.addEventListener("resize", function () {
    window.cancelAnimationFrame(dashboardResizeFrame);
    dashboardResizeFrame = window.requestAnimationFrame(function () {
        if (dashboardData) renderDashboard(dashboardData);
    });
});
if (document.fonts) document.fonts.ready.then(function () {
    if (dashboardData) renderDashboard(dashboardData);
});
