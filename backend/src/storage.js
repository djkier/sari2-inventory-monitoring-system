const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const dataDirectory = path.resolve(
    process.env.SARI2_DATA_DIR || path.resolve(__dirname, "../data")
);

const fileNames = Object.freeze({
    catalogProducts: "catalog-products.json",
    categories: "categories.json",
    products: "products.json",
    stockMovements: "stock-movements.json",
    settings: "settings.json",
    users: "users.json",
    stores: "stores.json"
});

const locks = new Map();

function getFilePath(name) {
    const fileName = fileNames[name];

    if (!fileName) {
        throw new Error("Unknown storage collection: " + name);
    }

    return path.join(dataDirectory, fileName);
}

function withLock(name, callback) {
    const previous = locks.get(name) || Promise.resolve();
    const current = previous.catch(function () {}).then(callback);

    locks.set(name, current);

    return current.finally(function () {
        if (locks.get(name) === current) {
            locks.delete(name);
        }
    });
}

async function withCollectionLocks(names, callback) {
    const uniqueNames = Array.from(new Set(names)).sort();

    for (const name of uniqueNames) {
        getFilePath(name);
    }

    async function acquire(index) {
        if (index === uniqueNames.length) {
            return callback();
        }

        return withLock(uniqueNames[index], function () {
            return acquire(index + 1);
        });
    }

    return acquire(0);
}

async function readJson(name) {
    try {
        const content = await fs.readFile(getFilePath(name), "utf8");
        const value = JSON.parse(content);

        if (value === null || typeof value !== "object") {
            throw new Error("Stored JSON must be an object or array.");
        }

        return value;
    } catch (error) {
        if (error.code === "ENOENT") {
            return [];
        }

        throw error;
    }
}

async function writeJson(name, value) {
    const filePath = getFilePath(name);

    if (value === null || typeof value !== "object") {
        throw new Error("Stored JSON must be an object or array.");
    }

    await fs.mkdir(dataDirectory, { recursive: true });

    const tempPath = path.join(
        dataDirectory,
        "." + fileNames[name] + "." + crypto.randomUUID() + ".tmp"
    );

    try {
        await fs.writeFile(
            tempPath,
            JSON.stringify(value, null, 2) + "\n",
            "utf8"
        );

        await fs.rename(tempPath, filePath);
    } catch (error) {
        await fs.unlink(tempPath).catch(function () {});
        throw error;
    }
}

async function mutateJson(name, mutator) {
    return withCollectionLocks([name], async function () {
        const current = await readJson(name);
        const outcome = await mutator(current);

        if (!outcome ||
            !Object.prototype.hasOwnProperty.call(outcome, "result")) {
            throw new Error("JSON mutator must return a result.");
        }

        let updatedValue;

        if (Object.prototype.hasOwnProperty.call(outcome, "value")) {
            updatedValue = outcome.value;
        } else if (
            outcome.values &&
            Object.prototype.hasOwnProperty.call(outcome.values, name)
        ) {
            updatedValue = outcome.values[name];
        } else {
            throw new Error("JSON mutator did not return updated data.");
        }

        await writeJson(name, updatedValue);

        return outcome.result;
    });
}

async function mutateJsonStores(names, mutator) {
    const uniqueNames = Array.from(new Set(names)).sort();

    return withCollectionLocks(uniqueNames, async function () {
        const stores = {};

        for (const name of uniqueNames) {
            stores[name] = await readJson(name);
        }

        const outcome = await mutator(stores);

        if (
            !outcome ||
            !outcome.values ||
            !Object.prototype.hasOwnProperty.call(outcome, "result")
        ) {
            throw new Error("Multi-store mutator must return values and result.");
        }

        const changedNames = uniqueNames.filter(function (name) {
            return Object.prototype.hasOwnProperty.call(outcome.values, name);
        });

        const originals = {};
        for (const name of changedNames) {
            originals[name] = stores[name];
        }

        try {
            for (const name of changedNames) {
                await writeJson(name, outcome.values[name]);
            }
        } catch (error) {
            for (const name of changedNames) {
                await writeJson(name, originals[name]).catch(function () {});
            }

            throw error;
        }

        return outcome.result;
    });
}

module.exports = {
    dataDirectory,
    mutateJson,
    mutateJsonStores,
    readJson,
    writeJson
};
