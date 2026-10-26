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

async function createStockMovement(input, storeId) {
    const transaction = validateTransaction(input);

    return mutateJsonStores(["products", "stockMovements"], function (stores) {
        const productIndex = stores.products.findIndex(function (product) {
            return product && product.id === transaction.productId && product.storeId === storeId;
        });
        if (productIndex === -1) {
            throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.", {
                id: transaction.productId
            });
        }

        const product = stores.products[productIndex];
        if (transaction.type === "stock-out" && transaction.quantity > product.quantity) {
            throw new AppError(409, "INSUFFICIENT_STOCK", "Insufficient stock for this transaction.", {
                availableQuantity: product.quantity,
                requestedQuantity: transaction.quantity
            });
        }

        const change = transaction.type === "stock-in" ? transaction.quantity : -transaction.quantity;
        const resultingQuantity = product.quantity + change;
        if (!Number.isSafeInteger(resultingQuantity) || resultingQuantity < 0) {
            throw new AppError(400, "INVALID_RESULTING_QUANTITY", "The resulting quantity is outside the supported range.");
        }

        const updatedProduct = { ...product, quantity: resultingQuantity };
        const updatedProducts = stores.products.slice();
        updatedProducts[productIndex] = updatedProduct;

        const movement = {
            id: crypto.randomUUID(),
            storeId: storeId,
            productId: product.id,
            productName: product.name,
            type: transaction.type,
            quantity: transaction.quantity,
            date: new Date().toISOString(),
            resultingQuantity: resultingQuantity
        };

        return {
            values: {
                products: updatedProducts,
                stockMovements: stores.stockMovements.concat(movement)
            },
            result: { product: updatedProduct, movement: movement }
        };
    });
}

module.exports = {
    createStockMovement,
    listStockMovements,
    validateTransaction
};
