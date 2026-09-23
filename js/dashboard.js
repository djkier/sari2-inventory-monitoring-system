function renderDashboard() {
    if (!initializeApp()) {
        return;
    }
    storageWarnings.length = 0;
    const settings = getSettings();
    const products = getProducts();
    const today = new Date();
    const lowStock = products.filter(function (product) {
        return getStockStatus(product, settings) === "Low Stock";
    });
    const expiringSoon = products.filter(function (product) {
        return getExpirationStatus(product, settings.expirationWarningDays, today) === "Expiring Soon";
    });
    const outOfStock = products.filter(function (product) {
        return getStockStatus(product, settings) === "Out of Stock";
    });

    document.getElementById("store-name").textContent = settings.storeName;
    document.getElementById("total-products").textContent = products.length;
    document.getElementById("low-stock-count").textContent = lowStock.length;
    document.getElementById("expiring-soon-count").textContent = expiringSoon.length;
    document.getElementById("out-of-stock-count").textContent = outOfStock.length;
    document.getElementById("expiration-window").textContent = "Today and the next " + settings.expirationWarningDays + " days.";
    document.getElementById("inventory-empty").hidden = products.length !== 0;

    document.getElementById("view-all-low-stock").hidden = lowStock.length === 0;
    document.getElementById("view-all-out-of-stock").hidden = outOfStock.length === 0;
    document.getElementById("view-all-expiring-soon").hidden = expiringSoon.length === 0;

    lowStock.sort(function (a, b) { return a.quantity - b.quantity || a.name.localeCompare(b.name); });
    outOfStock.sort(function (a, b) { return a.name.localeCompare(b.name); });
    renderMonitoringRows("low-stock-list", lowStock.slice(0, 3).map(function (product) {
        return [product.name, product.quantity, getLowStockThreshold(product, settings)];
    }), "No low-stock products.", 3, lowStock.length);

    renderMonitoringRows("out-of-stock-list", outOfStock.slice(0, 3).map(function (product) {
        return [product.name, product.category || "N/A", product.quantity];
    }), "No out-of-stock products.", 3, outOfStock.length);
    expiringSoon.sort(function (a, b) { return a.expirationDate.localeCompare(b.expirationDate); });

    renderExpiringSoonPreview(expiringSoon.map(function (product) {
        return [product.name, formatExpirationDate(product.expirationDate)];
    }));

    if (products.some(function (product) { return getExpirationStatus(product, settings.expirationWarningDays, today) === "Invalid Date"; })) {
        storageWarnings.push("Some products have invalid expiration dates and are excluded from expiration monitoring.");
    }
    document.getElementById("dashboard-feedback").textContent = storageWarnings.join(" ");
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

