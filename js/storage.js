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