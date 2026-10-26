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

function compareNames(left, right) {
    return left.name.localeCompare(right.name, "en", { sensitivity: "base" });
}

function buildMonitoringData(products, settings, asOfDate = formatCalendarDate(new Date())) {
    if (!isValidCalendarDate(asOfDate)) {
        throw new TypeError("Monitoring date must use a valid YYYY-MM-DD calendar date.");
    }

    const counts = {
        totalProducts: products.length,
        inStock: 0,
        lowStock: 0,
        outOfStock: 0,
        safe: 0,
        expiringSoon: 0,
        expired: 0,
        noExpiration: 0,
        invalidDate: 0
    };
    const statusKeys = {
        "In Stock": "inStock",
        "Low Stock": "lowStock",
        "Out of Stock": "outOfStock",
        Safe: "safe",
        "Expiring Soon": "expiringSoon",
        Expired: "expired",
        "No Expiration": "noExpiration",
        "Invalid Date": "invalidDate"
    };

    const monitoredProducts = products.map(function (product) {
        const stockStatus = getStockStatus(product, settings);
        const expirationStatus = getExpirationStatus(product, settings.expirationWarningDays, asOfDate);
        counts[statusKeys[stockStatus]] += 1;
        counts[statusKeys[expirationStatus]] += 1;
        return {
            ...product,
            effectiveLowStockThreshold: getLowStockThreshold(product, settings),
            stockStatus: stockStatus,
            expirationStatus: expirationStatus
        };
    });

    monitoredProducts.sort(compareNames);
    return {
        asOfDate: asOfDate,
        defaultLowStockThreshold: settings.defaultLowStockThreshold,
        expirationWarningDays: settings.expirationWarningDays,
        counts: counts,
        products: monitoredProducts
    };
}

function buildDashboardData(monitoring) {
    const lowStock = monitoring.products
        .filter(function (product) { return product.stockStatus === "Low Stock"; })
        .sort(function (left, right) {
            return left.quantity - right.quantity || compareNames(left, right);
        })
        .map(function (product) {
            return {
                id: product.id,
                name: product.name,
                quantity: product.quantity,
                lowStockThreshold: product.effectiveLowStockThreshold
            };
        });
    const outOfStock = monitoring.products
        .filter(function (product) { return product.stockStatus === "Out of Stock"; })
        .sort(compareNames)
        .map(function (product) {
            return {
                id: product.id,
                name: product.name,
                category: product.category,
                quantity: product.quantity
            };
        });
    const expiringSoon = monitoring.products
        .filter(function (product) { return product.expirationStatus === "Expiring Soon"; })
        .sort(function (left, right) {
            return left.expirationDate.localeCompare(right.expirationDate) || compareNames(left, right);
        })
        .map(function (product) {
            return {
                id: product.id,
                name: product.name,
                expirationDate: product.expirationDate
            };
        });

    return {
        asOfDate: monitoring.asOfDate,
        expirationWarningDays: monitoring.expirationWarningDays,
        summary: {
            totalProducts: monitoring.counts.totalProducts,
            lowStock: monitoring.counts.lowStock,
            outOfStock: monitoring.counts.outOfStock,
            expiringSoon: monitoring.counts.expiringSoon
        },
        monitoring: {
            lowStock: lowStock,
            outOfStock: outOfStock,
            expiringSoon: expiringSoon
        }
    };
}

async function getMonitoringData(storeId) {
    const [products, settings] = await Promise.all([
        listProducts(storeId),
        getSettings(storeId, "Store Staff")
    ]);
    return buildMonitoringData(products, settings);
}

async function getDashboardData(storeId) {
    return buildDashboardData(await getMonitoringData(storeId));
}

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
