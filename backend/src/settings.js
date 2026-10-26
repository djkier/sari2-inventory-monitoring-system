const { AppError } = require("./errors");
const { mutateJsonStores, readJson } = require("./storage");

const DEFAULT_SETTINGS = {
    defaultLowStockThreshold: 5,
    expirationWarningDays: 7
};

async function getSettings(storeId) {
    const [records, stores] = await Promise.all([
        readJson("settings"),
        readJson("stores")
    ]);
    const store = Array.isArray(stores)
        ? stores.find(function (item) { return item && item.id === storeId; })
        : null;
    if (!store) throw new AppError(404, "STORE_NOT_FOUND", "Store not found.");

    const saved = (Array.isArray(records) ? records : []).find(function (item) {
        return item && item.storeId === storeId;
    });

    return {
        ...DEFAULT_SETTINGS,
        ...(saved || {}),
        storeName: store.name,
        hasSavedSettings: Boolean(saved)
    };
}

async function saveSettings(storeId, input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new AppError(400, "VALIDATION_ERROR", "Settings must be a JSON object.");
    }
    if (Object.prototype.hasOwnProperty.call(input, "storeId") ||
        Object.prototype.hasOwnProperty.call(input, "storeIdentity")) {
        throw new AppError(400, "STORE_SCOPE_NOT_ALLOWED", "Store scope is determined by the authenticated session.");
    }

    const storeName = typeof input.storeName === "string" ? input.storeName.trim() : "";
    const ownerName = typeof input.ownerName === "string" ? input.ownerName.trim() : "";
    const defaultLowStockThreshold = input.defaultLowStockThreshold;
    const expirationWarningDays = input.expirationWarningDays;
    if (!storeName || storeName.length > 120 || ownerName.length > 120 ||
        !Number.isSafeInteger(defaultLowStockThreshold) || defaultLowStockThreshold < 0 ||
        !Number.isSafeInteger(expirationWarningDays) || expirationWarningDays < 0) {
        throw new AppError(400, "VALIDATION_ERROR", "Check the store name and inventory settings.");
    }

    return mutateJsonStores(["settings", "stores"], function (collections) {
        if (!Array.isArray(collections.settings) || !Array.isArray(collections.stores)) {
            throw new Error("Store settings must be arrays.");
        }
        const store = collections.stores.find(function (item) {
            return item && item.id === storeId;
        });
        if (!store) throw new AppError(404, "STORE_NOT_FOUND", "Store not found.");

        const saved = {
            ...(collections.settings.find(function (item) {
                return item && item.storeId === storeId;
            }) || {}),
            storeId,
            storeName,
            ownerName,
            defaultLowStockThreshold,
            expirationWarningDays
        };
        const settingsIndex = collections.settings.findIndex(function (item) {
            return item && item.storeId === storeId;
        });
        const settings = collections.settings.slice();
        if (settingsIndex === -1) settings.push(saved);
        else settings[settingsIndex] = saved;

        const stores = collections.stores.map(function (item) {
            return item.id === storeId ? { ...item, name: storeName } : item;
        });
        return {
            values: { settings, stores },
            result: {
                ...saved,
                storeName
            }
        };
    });
}

module.exports = {
    getSettings,
    saveSettings
};
