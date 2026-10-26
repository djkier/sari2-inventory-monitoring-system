const path = require("node:path");
const fs = require("node:fs/promises");
const { AppError } = require("./errors");
const { validateProductInput } = require("./products");
const { dataDirectory, mutateJsonStores, readJson } = require("./storage");

const backupDirectory = path.join(dataDirectory, "backups", "pre-store-migration");

function migrationError(message, details) {
    return new AppError(500, "INVALID_INVENTORY_MIGRATION_DATA", message, details);
}

function validateStableId(record, dataset, index, seenIds) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
        throw migrationError("Invalid " + dataset + " record.", { index: index });
    }
    if (typeof record.id !== "string" || !record.id.trim()) {
        throw migrationError("A " + dataset + " record is missing a stable ID.", { index: index });
    }
    if (seenIds.has(record.id)) {
        throw migrationError("Duplicate " + dataset + " ID.", { id: record.id });
    }
    seenIds.add(record.id);
}

function validateStoreId(record, dataset, index, validStoreIds) {
    if (!Object.prototype.hasOwnProperty.call(record, "storeId")) return;
    if (typeof record.storeId !== "string" || !validStoreIds.has(record.storeId)) {
        throw migrationError("A " + dataset + " record has an unknown store.", {
            index: index,
            storeId: record.storeId
        });
    }
}

function validateMovement(movement, index) {
    const details = {};
    if (typeof movement.productId !== "string" || !movement.productId.trim()) {
        details.productId = "Product ID is required.";
    }
    if (typeof movement.productName !== "string" || !movement.productName.trim()) {
        details.productName = "Product name snapshot is required.";
    }
    if (!["stock-in", "stock-out"].includes(movement.type)) {
        details.type = "Movement type must be stock-in or stock-out.";
    }
    if (!Number.isSafeInteger(movement.quantity) || movement.quantity <= 0) {
        details.quantity = "Movement quantity must be a positive whole number.";
    }
    if (typeof movement.date !== "string" || !Number.isFinite(new Date(movement.date).getTime())) {
        details.date = "Movement date must be a valid timestamp.";
    }
    if (!Number.isSafeInteger(movement.resultingQuantity) || movement.resultingQuantity < 0) {
        details.resultingQuantity = "Resulting quantity must be a whole number of zero or more.";
    }
    if (Object.keys(details).length) {
        throw migrationError("Invalid stock movement record.", { index: index, fields: details });
    }
}

function planInventoryMigration(products, movements, stores, demoStoreId) {
    const validStoreIds = new Set(stores.map(function (store) { return store && store.id; }));
    if (!validStoreIds.has(demoStoreId)) {
        throw migrationError("The designated demo store is unavailable.", { storeId: demoStoreId });
    }

    const productIds = new Set();
    products.forEach(function (product, index) {
        validateStableId(product, "product", index, productIds);
        validateProductInput(product, { requireQuantity: true, allowStoreId: true });
        validateStoreId(product, "product", index, validStoreIds);
    });

    const movementIds = new Set();
    movements.forEach(function (movement, index) {
        validateStableId(movement, "stock movement", index, movementIds);
        validateMovement(movement, index);
        validateStoreId(movement, "stock movement", index, validStoreIds);
    });

    let migratedProductCount = 0;
    let migratedMovementCount = 0;
    const migratedProducts = products.map(function (product) {
        if (Object.prototype.hasOwnProperty.call(product, "storeId")) return product;
        migratedProductCount += 1;
        return { ...product, storeId: demoStoreId };
    });
    const migratedMovements = movements.map(function (movement) {
        if (Object.prototype.hasOwnProperty.call(movement, "storeId")) return movement;
        migratedMovementCount += 1;
        return { ...movement, storeId: demoStoreId };
    });

    const productById = new Map(migratedProducts.map(function (product) {
        return [product.id, product];
    }));
    migratedMovements.forEach(function (movement, index) {
        const product = productById.get(movement.productId);
        if (product && product.storeId !== movement.storeId) {
            throw migrationError("A stock movement and its product belong to different stores.", {
                index: index,
                movementId: movement.id,
                productId: product.id
            });
        }
    });

    return {
        changed: migratedProductCount > 0 || migratedMovementCount > 0,
        products: migratedProducts,
        stockMovements: migratedMovements,
        migratedProductCount: migratedProductCount,
        migratedMovementCount: migratedMovementCount
    };
}

async function writeBackupFile(fileName, value) {
    const filePath = path.join(backupDirectory, fileName);
    try {
        await fs.writeFile(filePath, JSON.stringify(value, null, 2) + "\n", {
            encoding: "utf8",
            flag: "wx"
        });
    } catch (error) {
        if (error.code !== "EEXIST") throw error;
        const existing = JSON.parse(await fs.readFile(filePath, "utf8"));
        if (!Array.isArray(existing)) {
            throw migrationError("An existing migration backup is invalid.", { fileName: fileName });
        }
    }
}
