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