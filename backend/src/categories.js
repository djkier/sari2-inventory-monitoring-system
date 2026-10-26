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

async function listCategories(storeId) {
    const categories = await readJson("categories");
    return categories
        .filter(function (category) { return category && category.storeId === storeId; })
        .sort(function (left, right) {
            return left.name.localeCompare(right.name, "en", { sensitivity: "base" });
        });
}

async function getCategory(id, storeId) {
    const categories = await readJson("categories");
    const category = categories.find(function (item) {
        return item && item.id === id && item.storeId === storeId;
    });
    if (!category) throw categoryNotFound(id);
    return category;
}

async function createCategory(input, storeId) {
    const values = validateCategoryInput(input);
    return mutateJson("categories", function (categories) {
        assertUniqueName(categories, values.name, storeId);
        const category = { id: crypto.randomUUID(), storeId: storeId, name: values.name };
        return { value: categories.concat(category), result: category };
    });
}

async function updateCategory(id, input, storeId) {
    const values = validateCategoryInput(input);
    return mutateJsonStores(["categories", "products"], function (data) {
        const index = findCategoryIndex(data.categories, id, storeId);
        if (index === -1) throw categoryNotFound(id);
        assertUniqueName(data.categories, values.name, storeId, id);

        const category = { ...data.categories[index], name: values.name };
        const categories = data.categories.slice();
        categories[index] = category;
        const products = data.products.map(function (product) {
            return product && product.storeId === storeId && product.categoryId === id
                ? { ...product, category: category.name }
                : product;
        });
        return {
            values: { categories: categories, products: products },
            result: category
        };
    });
}

async function deleteCategory(id, storeId) {
    return mutateJsonStores(["categories", "products"], function (data) {
        const index = findCategoryIndex(data.categories, id, storeId);
        if (index === -1) throw categoryNotFound(id);
        const referenced = data.products.some(function (product) {
            return product && product.storeId === storeId && product.categoryId === id;
        });
        if (referenced) {
            throw new AppError(409, "CATEGORY_IN_USE", "Category cannot be deleted while products use it.", {
                id: id
            });
        }

        const deletedCategory = data.categories[index];
        const categories = data.categories.slice();
        categories.splice(index, 1);
        return {
            values: { categories: categories, products: data.products },
            result: deletedCategory
        };
    });
}

module.exports = {
    createCategory,
    deleteCategory,
    getCategory,
    listCategories,
    normalizeCategoryName,
    updateCategory,
    validateCategoryInput
};