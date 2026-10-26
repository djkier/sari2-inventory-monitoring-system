const { AppError } = require("./errors");
const { listProducts } = require("./products");
const { getSettings } = require("./settings");

const scopeFields = ["storeId", "storeCode", "code"];

function formatCalendarDate(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

function isValidCalendarDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parts = value.split("-").map(Number);
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(parts[0], parts[1] - 1, parts[2]);
    return date.getUTCFullYear() === parts[0] &&
        date.getUTCMonth() === parts[1] - 1 &&
        date.getUTCDate() === parts[2];
}

function addCalendarDays(value, days) {
    const parts = value.split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    date.setUTCDate(date.getUTCDate() + days);
    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, "0"),
        String(date.getUTCDate()).padStart(2, "0")
    ].join("-");
}

function getLowStockThreshold(product, settings) {
    return Number.isSafeInteger(product.lowStockThreshold) && product.lowStockThreshold >= 0
        ? product.lowStockThreshold
        : settings.defaultLowStockThreshold;
}

function getStockStatus(product, settings) {
    if (product.quantity === 0) return "Out of Stock";
    return product.quantity <= getLowStockThreshold(product, settings) ? "Low Stock" : "In Stock";
}

function getExpirationStatus(product, warningDays, asOfDate) {
    if (!product.expirationDate) return "No Expiration";
    if (!isValidCalendarDate(product.expirationDate)) return "Invalid Date";
    if (product.expirationDate < asOfDate) return "Expired";
    return product.expirationDate <= addCalendarDays(asOfDate, warningDays) ? "Expiring Soon" : "Safe";
}

function assertNoStoreScope(query) {
    const forgedField = scopeFields.find(function (field) {
        return Object.prototype.hasOwnProperty.call(query || {}, field);
    });
    if (forgedField) {
        throw new AppError(400, "STORE_SCOPE_NOT_ALLOWED", "Store scope is determined by the authenticated session.", {
            [forgedField]: "Remove this field from the request."
        });
    }
}

f

module.exports = {
    assertNoStoreScope,
    buildDashboardData,
    buildMonitoringData,
    getDashboardData,
    getExpirationStatus,
    getLowStockThreshold,
    getMonitoringData,
    getStockStatus,
    isValidCalendarDate
};
