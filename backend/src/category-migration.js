const crypto = require("node:crypto");
const { AppError } = require("./errors");
const { normalizeCategoryName } = require("./categories");
const { mutateJsonStores, readJson } = require("./storage");

function migrationError(message, details) {
    return new AppError(500, "CATEGORY_MIGRATION_ERROR", message, details);
}

function planCategoryMigration(categories, products, validStoreIds) {
    const ids = new Set();
    const categoriesByStoreAndName = new Map();

    categories.forEach(function (category) {
        if (!category || typeof category.id !== "string" || !category.id ||
            typeof category.storeId !== "string" || !validStoreIds.has(category.storeId) ||
            typeof category.name !== "string" || !category.name.trim()) {
            throw migrationError("Stored category data is invalid.");
        }
        if (ids.has(category.id)) {
            throw migrationError("Stored category IDs must be unique.", { id: category.id });
        }
        ids.add(category.id);
        const key = category.storeId + "\u0000" + normalizeCategoryName(category.name);
        if (categoriesByStoreAndName.has(key)) {
            throw migrationError("Category names must be unique within each store.", {
                storeId: category.storeId,
                name: category.name
            });
        }
        categoriesByStoreAndName.set(key, category);
    });

    let addedCount = 0;
    let changed = false;
    const migratedCategories = categories.slice();
    const categoriesById = new Map(categories.map(function (category) { return [category.id, category]; }));
    const migratedProducts = products.map(function (product) {
        if (!product || typeof product.storeId !== "string" || !validStoreIds.has(product.storeId)) {
            throw migrationError("A product has an invalid store relationship.", {
                id: product && product.id
            });
        }

        let category;
        if (typeof product.categoryId === "string" && product.categoryId) {
            category = categoriesById.get(product.categoryId);
            if (!category || category.storeId !== product.storeId) {
                throw migrationError("A product has an invalid category relationship.", {
                    id: product.id,
                    categoryId: product.categoryId
                });
            }
        } else {
            if (typeof product.category !== "string" || !product.category.trim()) {
                throw migrationError("A product is missing its legacy category name.", { id: product.id });
            }
            const displayName = product.category.trim().replace(/\s+/g, " ");
            const key = product.storeId + "\u0000" + normalizeCategoryName(displayName);
            category = categoriesByStoreAndName.get(key);
            if (!category) {
                let id;
                do id = crypto.randomUUID(); while (ids.has(id));
                ids.add(id);
                category = { id: id, storeId: product.storeId, name: displayName };
                migratedCategories.push(category);
                categoriesById.set(id, category);
                categoriesByStoreAndName.set(key, category);
                addedCount += 1;
            }
        }

        if (product.categoryId === category.id && product.category === category.name) return product;
        changed = true;
        return { ...product, categoryId: category.id, category: category.name };
    });

    return {
        changed: changed || addedCount > 0,
        addedCount: addedCount,
        categories: migratedCategories,
        products: migratedProducts
    };
}

async function migrateLegacyCategories() {
    const stores = await readJson("stores");
    const validStoreIds = new Set(stores
        .filter(function (store) { return store && typeof store.id === "string"; })
        .map(function (store) { return store.id; }));
    return mutateJsonStores(["categories", "products"], function (data) {
        const plan = planCategoryMigration(data.categories, data.products, validStoreIds);
        return {
            values: { categories: plan.categories, products: plan.products },
            result: plan
        };
    });
}

module.exports = {
    migrateLegacyCategories,
    planCategoryMigration
};