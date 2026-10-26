const crypto = require("node:crypto");
const { AppError } = require("./errors");
const { mutateJson, mutateJsonStores, readJson } = require("./storage");

function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeCategoryName(value) {
    return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function validateCategoryInput(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new AppError(400, "VALIDATION_ERROR", "Category data must be a JSON object.");
    }

    const errors = {};
    let name = "";
    if (typeof input.name !== "string" || !input.name.trim()) {
        errors.name = "Category name is required.";
    } else {
        name = input.name.trim().replace(/\s+/g, " ");
    }
    if (hasOwn(input, "id")) errors.id = "Category ID cannot be changed.";
    if (hasOwn(input, "storeId")) {
        errors.storeId = "Store scope is determined by the authenticated session.";
    }

    if (Object.keys(errors).length) {
        throw new AppError(400, "VALIDATION_ERROR", "Category validation failed.", errors);
    }
    return { name: name };
}

function findCategoryIndex(categories, id, storeId) {
    return categories.findIndex(function (category) {
        return category && category.id === id && category.storeId === storeId;
    });
}

function categoryNotFound(id) {
    return new AppError(404, "CATEGORY_NOT_FOUND", "Category not found.", { id: id });
}

function assertUniqueName(categories, name, storeId, excludedId) {
    const normalizedName = normalizeCategoryName(name);
    const duplicate = categories.find(function (category) {
        return category && category.storeId === storeId && category.id !== excludedId &&
            normalizeCategoryName(category.name) === normalizedName;
    });
    if (duplicate) {
        throw new AppError(409, "CATEGORY_NAME_CONFLICT", "A category with this name already exists.", {
            name: "Category names must be unique within a store."
        });
    }
}
