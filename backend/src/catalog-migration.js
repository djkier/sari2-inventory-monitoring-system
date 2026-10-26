const crypto = require("node:crypto");
const { AppError } = require("./errors");
const { validateCatalogProduct } = require("./catalog-products");
const { mutateJsonStores } = require("./storage");

function migrationError(message, details) {
    return new AppError(500, "CATALOG_MIGRATION_ERROR", message, details);
}

function planCatalogMigration(catalogProducts, products) {
    const ids = new Set();
    const catalogById = new Map();
    const catalogBySourceProductId = new Map();

    catalogProducts.forEach(function (catalogProduct) {
        if (!validateCatalogProduct(catalogProduct)) {
            throw migrationError("Stored catalog product data is invalid.");
        }
        if (ids.has(catalogProduct.id)) {
            throw migrationError("Stored catalog product IDs must be unique.", { id: catalogProduct.id });
        }
        ids.add(catalogProduct.id);
        catalogById.set(catalogProduct.id, catalogProduct);
        if (catalogProduct.sourceProductId !== undefined) {
            if (typeof catalogProduct.sourceProductId !== "string" || !catalogProduct.sourceProductId ||
                catalogBySourceProductId.has(catalogProduct.sourceProductId)) {
                throw migrationError("Catalog migration source IDs must be unique nonempty strings.", {
                    sourceProductId: catalogProduct.sourceProductId
                });
            }
            catalogBySourceProductId.set(catalogProduct.sourceProductId, catalogProduct);
        }
    });

    let changed = false;
    let addedCount = 0;
    const migratedCatalogProducts = catalogProducts.slice();
    const migratedProducts = products.map(function (product) {
        if (!product || typeof product.id !== "string" || !product.id) {
            throw migrationError("Stored inventory product data is invalid.");
        }

        let catalogProduct;
        if (typeof product.catalogProductId === "string" && product.catalogProductId) {
            catalogProduct = catalogById.get(product.catalogProductId);
            if (!catalogProduct) {
                throw migrationError("An inventory product has an invalid catalog reference.", {
                    id: product.id,
                    catalogProductId: product.catalogProductId
                });
            }
        } else {
            catalogProduct = catalogBySourceProductId.get(product.id);
            if (!catalogProduct) {
                if (typeof product.name !== "string" || !product.name.trim() ||
                    (product.imageUrl !== undefined && typeof product.imageUrl !== "string")) {
                    throw migrationError("A legacy inventory product is missing catalog fields.", { id: product.id });
                }
                let id;
                do id = crypto.randomUUID(); while (ids.has(id));
                ids.add(id);
                catalogProduct = {
                    id: id,
                    name: product.name.trim(),
                    imageUrl: typeof product.imageUrl === "string" ? product.imageUrl.trim() : "",
                    sourceProductId: product.id
                };
                migratedCatalogProducts.push(catalogProduct);
                catalogById.set(id, catalogProduct);
                catalogBySourceProductId.set(product.id, catalogProduct);
                addedCount += 1;
            }
        }

        if (product.catalogProductId === catalogProduct.id &&
            product.name === catalogProduct.name && product.imageUrl === catalogProduct.imageUrl) {
            return product;
        }
        changed = true;
        return {
            ...product,
            catalogProductId: catalogProduct.id,
            name: catalogProduct.name,
            imageUrl: catalogProduct.imageUrl
        };
    });

    return {
        changed: changed || addedCount > 0,
        addedCount: addedCount,
        catalogProducts: migratedCatalogProducts,
        products: migratedProducts
    };
}

function migrateLegacyCatalogProducts() {
    return mutateJsonStores(["catalogProducts", "products"], function (data) {
        const plan = planCatalogMigration(data.catalogProducts, data.products);
        return {
            values: { catalogProducts: plan.catalogProducts, products: plan.products },
            result: plan
        };
    });
}

module.exports = {
    migrateLegacyCatalogProducts,
    planCatalogMigration
};