const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");

const dataDirectory = path.resolve(__dirname, "../data");
const dataFiles = Object.freeze({
    products: {
        fileName: "products.json",
        initialValue: [],
        isValid: Array.isArray
    },
    stockMovements: {
        fileName: "stock-movements.json",
        initialValue: [],
        isValid: Array.isArray
    },
    settings: {
        fileName: "settings.json",
        initialValue: {
            storeName: "My Store",
            defaultLowStockThreshold: 5,
            expirationWarningDays: 7
        },
        isValid: function (value) {
            return value !== null && typeof value === "object" && !Array.isArray(value);
        }
    },
    users: {
        fileName: "users.json",
        initialValue: [],
        isValid: Array.isArray
    },
    stores: {
        fileName: "stores.json",
        initialValue: [],
        isValid: Array.isArray
    },
    categories: {
        fileName: "categories.json",
        initialValue: [],
        isValid: Array.isArray
    },
    catalogProducts: {
        fileName: "catalog-products.json",
        initialValue: [],
        isValid: Array.isArray
    },
    contactMessages: {
        fileName: "contact-messages.json",
        initialValue: [],
        isValid: Array.isArray
    }
});
let mutationQueue = Promise.resolve();

function getDefinition(key) {
    const definition = dataFiles[key];
    if (!definition) {
        const error = new Error("Unknown data store: " + key);
        error.code = "UNKNOWN_DATA_STORE";
        throw error;
    }
    return definition;
}

function getDataPath(key) {
    return path.join(dataDirectory, getDefinition(key).fileName);
}

async function writeJson(key, value) {
    const definition = getDefinition(key);
    if (!definition.isValid(value)) {
        const error = new TypeError("Invalid top-level value for data store: " + key);
        error.code = "INVALID_DATA_SHAPE";
        throw error;
    }

    await fs.mkdir(dataDirectory, { recursive: true });
    const filePath = getDataPath(key);
    const temporaryPath = path.join(
        dataDirectory,
        "." + definition.fileName + "." + process.pid + "." + crypto.randomUUID() + ".tmp"
    );

    try {
        await fs.writeFile(temporaryPath, JSON.stringify(value, null, 2) + "\n", "utf8");
        await fs.rename(temporaryPath, filePath);
    } catch (error) {
        await fs.rm(temporaryPath, { force: true }).catch(function () {});
        throw error;
    }
}

async function readJson(key) {
    const definition = getDefinition(key);
    let raw;

    try {
        raw = await fs.readFile(getDataPath(key), "utf8");
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
        await writeJson(key, definition.initialValue);
        raw = await fs.readFile(getDataPath(key), "utf8");
    }

    let value;
    try {
        value = JSON.parse(raw);
    } catch (error) {
        error.code = "INVALID_JSON_DATA";
        throw error;
    }

    if (!definition.isValid(value)) {
        const error = new TypeError("Invalid top-level value in data store: " + key);
        error.code = "INVALID_DATA_SHAPE";
        throw error;
    }
    return value;
}

async function initializeStorage() {
    await fs.mkdir(dataDirectory, { recursive: true });
    for (const key of Object.keys(dataFiles)) {
        await readJson(key);
    }
}

function enqueueMutation(operation) {
    const mutation = mutationQueue.then(operation);
    mutationQueue = mutation.then(function () {}, function () {});
    return mutation;
}

function mutateJsonStores(keys, mutator) {
    const uniqueKeys = Array.from(new Set(keys));
    if (!uniqueKeys.length || uniqueKeys.length !== keys.length) {
        const error = new TypeError("A data mutation requires unique data stores.");
        error.code = "INVALID_DATA_MUTATION";
        throw error;
    }
    uniqueKeys.forEach(getDefinition);

    return enqueueMutation(async function () {
        const currentValues = {};
        for (const key of uniqueKeys) currentValues[key] = await readJson(key);

        const outcome = await mutator(currentValues);
        if (!outcome || !outcome.values || typeof outcome.values !== "object") {
            const error = new TypeError("A multi-store mutation must return values.");
            error.code = "INVALID_DATA_MUTATION";
            throw error;
        }

        for (const key of uniqueKeys) {
            if (!Object.prototype.hasOwnProperty.call(outcome.values, key)) {
                const error = new TypeError("Missing value for data store: " + key);
                error.code = "INVALID_DATA_MUTATION";
                throw error;
            }
            const definition = getDefinition(key);
            if (!definition.isValid(outcome.values[key])) {
                const error = new TypeError("Invalid top-level value for data store: " + key);
                error.code = "INVALID_DATA_SHAPE";
                throw error;
            }
        }

        const writtenKeys = [];
        try {
            for (const key of uniqueKeys) {
                await writeJson(key, outcome.values[key]);
                writtenKeys.push(key);
            }
        } catch (error) {
            const rollbackErrors = [];
            for (const key of writtenKeys.reverse()) {
                try {
                    await writeJson(key, currentValues[key]);
                } catch (rollbackError) {
                    rollbackErrors.push({ key: key, message: rollbackError.message });
                }
            }
            if (rollbackErrors.length) error.rollbackErrors = rollbackErrors;
            throw error;
        }

        return outcome.result;
    });
}

function mutateJson(key, mutator) {
    return mutateJsonStores([key], async function (values) {
        const outcome = await mutator(values[key]);
        if (!outcome || !Object.prototype.hasOwnProperty.call(outcome, "value")) {
            const error = new TypeError("A data mutation must return a value.");
            error.code = "INVALID_DATA_MUTATION";
            throw error;
        }
        return {
            values: { [key]: outcome.value },
            result: outcome.result
        };
    });
}

module.exports = {
    dataDirectory,
    initializeStorage,
    mutateJson,
    mutateJsonStores,
    readJson,
    writeJson
};
