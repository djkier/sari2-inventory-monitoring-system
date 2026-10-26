const crypto = require("node:crypto");
const { AppError } = require("./errors");
const { findCatalogProduct, hydrateProduct } = require("./catalog-products");
const { mutateJson, mutateJsonStores, readJson } = require("./storage");

const editableFields = [
    "categoryId",
    "category",
    "price",
    "lowStockThreshold",
    "expirationDate"
];

function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
}

function isValidCalendarDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parts = value.split("-").map(Number);
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(parts[0], parts[1] - 1, parts[2]);
    return date.getUTCFullYear() === parts[0] &&
        date.getUTCMonth() === parts[1] - 1 &&
        date.getUTCDate() === parts[2];
}

function validateProductInput(input, options = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new AppError(400, "VALIDATION_ERROR", "Product data must be a JSON object.");
    }

    const errors = {};
    const values = {};

    if (typeof input.catalogProductId === "string" && input.catalogProductId.trim()) {
        values.catalogProductId = input.catalogProductId.trim();
    } else if (input.catalogProductId !== undefined) {
        errors.catalogProductId = "Catalog product ID must be a nonempty string.";
    }

    if (typeof input.name === "string" && input.name.trim()) {
        values.name = input.name.trim();
    } else if (!values.catalogProductId) {
        errors.name = "This field is required when creating a new catalog product.";
    } else if (input.name !== undefined) {
        errors.name = "Product name must be a nonempty string when provided.";
    }

    if (typeof input.categoryId === "string" && input.categoryId.trim()) {
        values.categoryId = input.categoryId.trim();
    } else if (input.categoryId !== undefined) {
        errors.categoryId = "Category ID must be a nonempty string.";
    }
    if (typeof input.category === "string" && input.category.trim()) {
        values.category = input.category.trim().replace(/\s+/g, " ");
    } else if (!values.categoryId) {
        errors.category = "This field is required.";
    } else if (input.category !== undefined) {
        errors.category = "Category name must be a nonempty string when provided.";
    }

    if (typeof input.price !== "number" || !Number.isFinite(input.price) || input.price < 0) {
        errors.price = "Price must be a finite number of zero or more.";
    } else {
        values.price = input.price;
    }

    if (!Number.isSafeInteger(input.lowStockThreshold) || input.lowStockThreshold < 0) {
        errors.lowStockThreshold = "Low-stock threshold must be a whole number of zero or more.";
    } else {
        values.lowStockThreshold = input.lowStockThreshold;
    }

    if (options.requireQuantity) {
        if (!Number.isSafeInteger(input.quantity) || input.quantity < 0) {
            errors.quantity = "Initial quantity must be a whole number of zero or more.";
        } else {
            values.quantity = input.quantity;
        }
    } else if (hasOwn(input, "quantity")) {
        errors.quantity = "Use a stock transaction to change product quantity.";
    }

    const expirationDate = input.expirationDate === undefined ? "" : input.expirationDate;
    if (typeof expirationDate !== "string" || (expirationDate && !isValidCalendarDate(expirationDate))) {
        errors.expirationDate = "Expiration date must be empty or a valid YYYY-MM-DD date.";
    } else {
        values.expirationDate = expirationDate;
    }

    if (input.imageUrl !== undefined) {
        if (typeof input.imageUrl !== "string") {
            errors.imageUrl = "Image URL must be a string.";
        } else {
            values.imageUrl = input.imageUrl.trim();
        }
    } else if (!values.catalogProductId) {
        values.imageUrl = "";
    }

    if (!options.requireQuantity && hasOwn(input, "id")) {
        errors.id = "Product ID cannot be changed.";
    }
    if (hasOwn(input, "storeId") && !options.allowStoreId) {
        errors.storeId = "Store scope is determined by the authenticated session.";
    }

    if (Object.keys(errors).length) {
        throw new AppError(400, "VALIDATION_ERROR", "Product validation failed.", errors);
    }

    return values;
}
