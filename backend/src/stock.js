const crypto = require("node:crypto");
const { AppError } = require("./errors");
const { mutateJsonStores, readJson } = require("./storage");

const movementTypes = ["stock-in", "stock-out"];

function validateTransaction(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new AppError(400, "VALIDATION_ERROR", "Stock transaction data must be a JSON object.");
    }

    const errors = {};
    if (typeof input.productId !== "string" || !input.productId.trim()) {
        errors.productId = "Product ID is required.";
    }
    if (!movementTypes.includes(input.type)) {
        errors.type = "Type must be stock-in or stock-out.";
    }
    if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
        errors.quantity = "Quantity must be a positive whole number.";
    }
    if (Object.prototype.hasOwnProperty.call(input, "storeId")) {
        errors.storeId = "Store scope is determined by the authenticated session.";
    }

    if (Object.keys(errors).length) {
        throw new AppError(400, "VALIDATION_ERROR", "Stock transaction validation failed.", errors);
    }

    return {
        productId: input.productId.trim(),
        type: input.type,
        quantity: input.quantity
    };
}

async function listStockMovements(storeId) {
    const movements = await readJson("stockMovements");
    return movements
        .filter(function (movement) { return movement && movement.storeId === storeId; })
        .sort(function (first, second) {
            return new Date(second.date).getTime() - new Date(first.date).getTime();
        });
}