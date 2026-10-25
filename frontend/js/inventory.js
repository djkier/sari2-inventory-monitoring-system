// Shared stock and calendar-date rules for inventory monitoring pages.
function getLowStockThreshold(product, settings) {
    return Number.isInteger(product.lowStockThreshold) && product.lowStockThreshold >= 0
        ? product.lowStockThreshold : settings.defaultLowStockThreshold;
}

function getStockStatus(product, settings) {

    if (product.quantity === 0) {
        return "Out of Stock";
    }
    return product.quantity <= getLowStockThreshold(product, settings) ? "Low Stock" : "In Stock";
}

function parseCalendarDate(value) {

    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }
    const parts = value.split("-").map(Number);
    const date = new Date(0);
    date.setHours(0, 0, 0, 0);
    date.setFullYear(parts[0], parts[1] - 1, parts[2]);
    return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 && date.getDate() === parts[2] ? date : null;
}

function getExpirationStatus(product, warningDays, today = new Date()) {

    if (!product.expirationDate) {
        return "No Expiration";
    }
    const expiration = parseCalendarDate(product.expirationDate);

    if (!expiration) {
        return "Invalid Date";
    }
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const warningEnd = new Date(start);
    warningEnd.setDate(warningEnd.getDate() + warningDays);
    
    if (expiration < start) {
        return "Expired";
    }
    return expiration <= warningEnd ? "Expiring Soon" : "Safe";
}

function formatExpirationDate(value) {
    const date = parseCalendarDate(value);
    return date ? date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "N/A";
}