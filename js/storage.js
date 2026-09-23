// Shared browser persistence. Reads never overwrite existing data.
const SESSION_KEY = "sari2_current_user";
const storageWarnings = [];

function initializeSampleInventory() {
    // Never mix sample history with an existing inventory, or replace even empty/corrupt data.
    if (typeof sampleProducts === "undefined" || typeof sampleStockMovements === "undefined") return;
    try {
        if (localStorage.getItem("sari2_products") !== null ||
            localStorage.getItem("sari2_stock_movements") !== null) return;
        // Serialization copies the plain seed arrays; normal reads return independent objects.
        if (!saveStockTransaction(sampleProducts, sampleStockMovements)) {
            storageWarnings.push("Sample inventory could not be saved. Check browser storage and reload to try again.");
        }
    } catch (error) {
        storageWarnings.push("Sample inventory could not be initialized. Check browser storage.");
    }
}

function readStoredValue(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
        storageWarnings.push("Some saved data could not be read. Check browser storage before making inventory changes.");
        return fallback;
    }
}

function getProducts() {
    initializeSampleInventory();
    const products = readStoredValue("sari2_products", []);
    if (!Array.isArray(products)) {
        storageWarnings.push("Saved products are not in the expected format.");
        return [];
    }
    const validProducts = products.filter(function (product) {
        return product && typeof product.name === "string" && product.name.trim() &&
            Number.isInteger(product.quantity) && product.quantity >= 0;
    });
    if (validProducts.length !== products.length) {
        storageWarnings.push("Some invalid product records could not be displayed.");
    }
    return validProducts;
}

function saveProducts(products) {
    try {
        localStorage.setItem("sari2_products", JSON.stringify(products));
        return true;
    } catch (error) {
        return false;
    }
}

function getSettings() {
    let settings = readStoredValue("sari2_settings", {});
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
        storageWarnings.push("Saved settings could not be used. Default inventory settings are shown.");
        settings = {};
    }
    return {
        storeName: typeof settings.storeName === "string" && settings.storeName.trim() ? settings.storeName : "My Store",
        ownerName: typeof settings.ownerName === "string" ? settings.ownerName : "",
        defaultLowStockThreshold: Number.isInteger(settings.defaultLowStockThreshold) && settings.defaultLowStockThreshold >= 0 ? settings.defaultLowStockThreshold : 5,
        expirationWarningDays: Number.isInteger(settings.expirationWarningDays) && settings.expirationWarningDays >= 0 ? settings.expirationWarningDays : 7
    };
}

function saveSettings(settings) {
    try {
        localStorage.setItem("sari2_settings", JSON.stringify(settings));
        return true;
    } catch (error) {
        return false;
    }
}

function getStockMovements() {
    initializeSampleInventory();
    const movements = readStoredValue("sari2_stock_movements", []);
    if (!Array.isArray(movements)) {
        storageWarnings.push("Saved stock movements are not in the expected format.");
        return [];
    }
    const valid = movements.filter(function (movement) {
        return movement && typeof movement.productName === "string" &&
            ["stock-in", "stock-out"].includes(movement.type) &&
            Number.isSafeInteger(movement.quantity) && movement.quantity > 0 &&
            typeof movement.date === "string" && Number.isFinite(new Date(movement.date).getTime());
    });
    if (valid.length !== movements.length) storageWarnings.push("Some saved stock movements could not be read.");
    return valid;
}

// Save history first; restore it if the product write fails. No other keys change.
function saveStockTransaction(products, movements) {
    let previousHistory;
    let historySaved = false;
    try {
        previousHistory = localStorage.getItem("sari2_stock_movements");
        localStorage.setItem("sari2_stock_movements", JSON.stringify(movements));
        historySaved = true;
        localStorage.setItem("sari2_products", JSON.stringify(products));
        return true;
    } catch (error) {
        if (historySaved) {
            try {
                if (previousHistory === null) localStorage.removeItem("sari2_stock_movements");
                else localStorage.setItem("sari2_stock_movements", previousHistory);
            } catch (restoreError) {
                storageWarnings.push("History could not be restored after a failed save. Check inventory and history before retrying.");
            }
        }
        return false;
    }
}
