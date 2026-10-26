const { AppError } = require("./errors");
const { normalizeStoreName } = require("./registration");
const { mutateJsonStores, readJson } = require("./storage");

const defaultSettings = Object.freeze({
    ownerName: "",
    defaultLowStockThreshold: 5,
    expirationWarningDays: 7
});
const scopeFields = ["storeId", "storeCode", "code"];

function normalizeText(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function validateInteger(value, field, label, maximum, errors) {
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
        errors[field] = label + " must be a whole number from 0 to " + maximum + ".";
    }
}

function validateSettings(input, options = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new AppError(400, "VALIDATION_ERROR", "Settings data must be a JSON object.");
    }

    if (options.rejectScope !== false) {
        const forgedField = scopeFields.find(function (field) {
            return Object.prototype.hasOwnProperty.call(input, field);
        });
        if (forgedField) {
            throw new AppError(400, "STORE_SCOPE_NOT_ALLOWED", "Store scope is determined by the authenticated session.", {
                [forgedField]: "Remove this field from the request."
            });
        }
    }

    const values = {
        storeName: normalizeText(input.storeName),
        ownerName: normalizeText(input.ownerName),
        defaultLowStockThreshold: input.defaultLowStockThreshold,
        expirationWarningDays: input.expirationWarningDays
    };
    const errors = {};

    if (!values.storeName) errors.storeName = "Store name is required.";
    else if (values.storeName.length > 100) errors.storeName = "Store name must be 100 characters or fewer.";
    if (typeof input.ownerName !== "string") errors.ownerName = "Owner name must be text.";
    else if (values.ownerName.length > 100) errors.ownerName = "Owner name must be 100 characters or fewer.";
    validateInteger(values.defaultLowStockThreshold, "defaultLowStockThreshold", "Low-stock threshold", 1000000, errors);
    validateInteger(values.expirationWarningDays, "expirationWarningDays", "Expiration warning days", 3650, errors);

    if (Object.keys(errors).length) {
        throw new AppError(400, "VALIDATION_ERROR", "Settings validation failed.", errors);
    }
    return values;
}

function createSettingsRecord(store, values = defaultSettings) {
    return {
        storeId: store.id,
        storeName: store.name,
        ownerName: values.ownerName,
        defaultLowStockThreshold: values.defaultLowStockThreshold,
        expirationWarningDays: values.expirationWarningDays
    };
}

function safeSettings(record, store, role) {
    return {
        ...record,
        ...(role === "Store Owner" ? { storeCode: store.code } : {})
    };
}

function validateStoredRecord(record, store) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
        throw new AppError(500, "INVALID_SETTINGS_DATA", "Stored settings are invalid.");
    }
    if (record.storeId !== undefined && record.storeId !== store.id) {
        throw new AppError(500, "INVALID_SETTINGS_DATA", "Stored settings do not match their store.");
    }

    let values;
    try {
        values = validateSettings({
            storeName: store.name,
            ownerName: record.ownerName,
            defaultLowStockThreshold: record.defaultLowStockThreshold,
            expirationWarningDays: record.expirationWarningDays
        }, { rejectScope: false });
    } catch (error) {
        throw new AppError(500, "INVALID_SETTINGS_DATA", "Stored settings are invalid.");
    }
    return createSettingsRecord(store, values);
}

function isLegacySettings(value) {
    return ["storeName", "ownerName", "defaultLowStockThreshold", "expirationWarningDays"].some(function (field) {
        return Object.prototype.hasOwnProperty.call(value, field);
    });
}

async function migrateLegacySettings(demoStoreId) {
    return mutateJsonStores(["stores", "settings"], function (data) {
        const storesById = new Map(data.stores.filter(Boolean).map(function (store) {
            return [store.id, store];
        }));
        const demoStore = storesById.get(demoStoreId);
        if (!demoStore) {
            throw new AppError(500, "DEMO_STORE_UNAVAILABLE", "The demo store is unavailable for settings migration.");
        }

        const migrated = {};
        if (isLegacySettings(data.settings)) {
            const legacyValues = validateSettings({
                storeName: demoStore.name,
                ownerName: data.settings.ownerName,
                defaultLowStockThreshold: data.settings.defaultLowStockThreshold,
                expirationWarningDays: data.settings.expirationWarningDays
            }, { rejectScope: false });
            migrated[demoStore.id] = createSettingsRecord(demoStore, legacyValues);
        } else {
            for (const [storeId, record] of Object.entries(data.settings)) {
                const store = storesById.get(storeId);
                if (!store) {
                    throw new AppError(500, "INVALID_SETTINGS_DATA", "Stored settings reference an unknown store.");
                }
                migrated[storeId] = validateStoredRecord(record, store);
            }
        }

        return {
            values: { stores: data.stores, settings: migrated },
            result: migrated
        };
    });
}

