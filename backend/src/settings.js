const { AppError } = require("./errors");
const { normalizeStoreName } = require("./registration");
const { mutateJsonStores, readJson } = require("./storage");

const defaultSettings = Object.freeze({
    defaultLowStockThreshold: 5,
    expirationWarningDays: 7
});
const scopeFields = ["storeId", "storeCode", "code"];
const ownerOnlyFields = [
    "storeName",
    "ownerName",
    "defaultLowStockThreshold",
    "expirationWarningDays"
];

function normalizeText(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function validateInputObject(input, options = {}) {
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
}

function validateInteger(value, field, label, maximum, errors) {
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
        errors[field] = label + " must be a whole number from 0 to " + maximum + ".";
    }
}

function validateDisplayName(value, field, label, errors) {
    const normalized = normalizeText(value);
    if (!normalized) errors[field] = label + " is required.";
    else if (normalized.length > 100) errors[field] = label + " must be 100 characters or fewer.";
    return normalized;
}

function validateSettings(input, options = {}) {
    validateInputObject(input, options);

    const values = {
        storeName: normalizeText(input.storeName),
        ownerName: "",
        defaultLowStockThreshold: input.defaultLowStockThreshold,
        expirationWarningDays: input.expirationWarningDays
    };
    const errors = {};

    if (!values.storeName) errors.storeName = "Store name is required.";
    else if (values.storeName.length > 100) errors.storeName = "Store name must be 100 characters or fewer.";
    values.ownerName = validateDisplayName(input.ownerName, "ownerName", "Owner name", errors);
    validateInteger(values.defaultLowStockThreshold, "defaultLowStockThreshold", "Low-stock threshold", 1000000, errors);
    validateInteger(values.expirationWarningDays, "expirationWarningDays", "Expiration warning days", 3650, errors);

    if (Object.keys(errors).length) {
        throw new AppError(400, "VALIDATION_ERROR", "Settings validation failed.", errors);
    }
    return values;
}

function validateStaffSettings(input) {
    validateInputObject(input);
    const protectedField = ownerOnlyFields.find(function (field) {
        return Object.prototype.hasOwnProperty.call(input, field);
    });
    if (protectedField) {
        throw new AppError(403, "SETTINGS_FORBIDDEN", "Staff may update only their own account name.", {
            [protectedField]: "Only a Store Owner may update this setting."
        });
    }

    const errors = {};
    const staffName = validateDisplayName(input.staffName, "staffName", "Staff name", errors);
    if (Object.keys(errors).length) {
        throw new AppError(400, "VALIDATION_ERROR", "Settings validation failed.", errors);
    }
    return { staffName: staffName };
}

function createSettingsRecord(store, values = defaultSettings) {
    return {
        storeId: store.id,
        defaultLowStockThreshold: values.defaultLowStockThreshold,
        expirationWarningDays: values.expirationWarningDays
    };
}

function findStoreOwner(users, store) {
    const ownerById = users.find(function (user) {
        return user && user.id === store.ownerUserId && user.storeId === store.id && user.role === "Store Owner";
    });
    if (ownerById) return ownerById;
    return users.find(function (user) {
        return user && user.storeId === store.id && user.role === "Store Owner";
    }) || null;
}

function findAuthenticatedUser(users, authUser, storeId) {
    const user = users.find(function (item) {
        return item && item.id === authUser.id && item.storeId === storeId && item.role === authUser.role;
    });
    if (!user) throw new AppError(401, "ACCOUNT_UNAVAILABLE", "The authenticated account is unavailable.");
    return user;
}

function safeSettings(record, store, owner, user) {
    return {
        storeName: store.name,
        ownerName: owner ? owner.name : "",
        ...(user.role === "Store Staff" ? { staffName: user.name } : {}),
        defaultLowStockThreshold: record.defaultLowStockThreshold,
        expirationWarningDays: record.expirationWarningDays,
        ...(user.role === "Store Owner" ? { storeCode: store.code } : {})
    };
}

function validateStoredRecord(record, store) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
        throw new AppError(500, "INVALID_SETTINGS_DATA", "Stored settings are invalid.");
    }
    if (record.storeId !== undefined && record.storeId !== store.id) {
        throw new AppError(500, "INVALID_SETTINGS_DATA", "Stored settings do not match their store.");
    }

    const errors = {};
    validateInteger(record.defaultLowStockThreshold, "defaultLowStockThreshold", "Low-stock threshold", 1000000, errors);
    validateInteger(record.expirationWarningDays, "expirationWarningDays", "Expiration warning days", 3650, errors);
    if (Object.keys(errors).length) {
        throw new AppError(500, "INVALID_SETTINGS_DATA", "Stored settings are invalid.");
    }
    return createSettingsRecord(store, record);
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
            migrated[demoStore.id] = validateStoredRecord(data.settings, demoStore);
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

async function getSettings(storeId, authUser) {
    const [stores, settings, users] = await Promise.all([
        readJson("stores"),
        readJson("settings"),
        readJson("users")
    ]);
    const store = stores.find(function (item) { return item && item.id === storeId; });
    if (!store) throw new AppError(404, "STORE_NOT_FOUND", "Store not found.");

    const user = findAuthenticatedUser(users, authUser, storeId);
    const owner = findStoreOwner(users, store);
    const record = settings[storeId]
        ? validateStoredRecord(settings[storeId], store)
        : createSettingsRecord(store);
    return safeSettings(record, store, owner, user);
}

async function getInventorySettings(storeId) {
    const [stores, settings] = await Promise.all([readJson("stores"), readJson("settings")]);
    const store = stores.find(function (item) { return item && item.id === storeId; });
    if (!store) throw new AppError(404, "STORE_NOT_FOUND", "Store not found.");
    return settings[storeId]
        ? validateStoredRecord(settings[storeId], store)
        : createSettingsRecord(store);
}

async function updateOwnerSettings(input, storeId, authUser) {
    const values = validateSettings(input);
    return mutateJsonStores(["stores", "users", "settings"], function (data) {
        const storeIndex = data.stores.findIndex(function (item) {
            return item && item.id === storeId;
        });
        if (storeIndex === -1) throw new AppError(404, "STORE_NOT_FOUND", "Store not found.");

        const currentStore = data.stores[storeIndex];
        const userIndex = data.users.findIndex(function (item) {
            return item && item.id === authUser.id && item.storeId === storeId && item.role === "Store Owner";
        });
        if (userIndex === -1 || (currentStore.ownerUserId && currentStore.ownerUserId !== authUser.id)) {
            throw new AppError(403, "SETTINGS_FORBIDDEN", "Only the registered Store Owner may update store settings.");
        }

        const stores = data.stores.slice();
        const store = {
            ...currentStore,
            name: values.storeName,
            normalizedName: normalizeStoreName(values.storeName),
            ownerUserId: authUser.id
        };
        stores[storeIndex] = store;

        const users = data.users.slice();
        const user = { ...users[userIndex], name: values.ownerName };
        users[userIndex] = user;

        const record = createSettingsRecord(store, values);
        return {
            values: {
                stores: stores,
                users: users,
                settings: { ...data.settings, [storeId]: record }
            },
            result: {
                store: store,
                user: user,
                settings: safeSettings(record, store, user, user)
            }
        };
    });
}

async function updateStaffSettings(input, storeId, authUser) {
    const values = validateStaffSettings(input);
    const currentSettings = await getSettings(storeId, authUser);
    const user = await mutateJsonStores(["users"], function (data) {
        const userIndex = data.users.findIndex(function (item) {
            return item && item.id === authUser.id && item.storeId === storeId && item.role === "Store Staff";
        });
        if (userIndex === -1) {
            throw new AppError(403, "SETTINGS_FORBIDDEN", "Only the authenticated Staff account may update this name.");
        }
        const users = data.users.slice();
        const updatedUser = { ...users[userIndex], name: values.staffName };
        users[userIndex] = updatedUser;
        return { values: { users: users }, result: updatedUser };
    });
    return { user: user, settings: { ...currentSettings, staffName: user.name } };
}

function updateSettings(input, storeId, authUser) {
    if (authUser.role === "Store Owner") return updateOwnerSettings(input, storeId, authUser);
    if (authUser.role === "Store Staff") return updateStaffSettings(input, storeId, authUser);
    throw new AppError(403, "SETTINGS_FORBIDDEN", "This account may not update settings.");
}

module.exports = {
    createSettingsRecord,
    defaultSettings,
    getInventorySettings,
    getSettings,
    migrateLegacySettings,
    safeSettings,
    updateSettings,
    validateSettings,
    validateStaffSettings
};
