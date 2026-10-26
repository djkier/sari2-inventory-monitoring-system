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

function normalizeCategoryName(value) {
    return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function resolveProductCategory(values, categories, storeId) {
    let category;
    if (values.categoryId) {
        category = categories.find(function (item) {
            return item && item.id === values.categoryId && item.storeId === storeId;
        });
    } else {
        const normalizedName = normalizeCategoryName(values.category);
        category = categories.find(function (item) {
            return item && item.storeId === storeId &&
                normalizeCategoryName(item.name) === normalizedName;
        });
    }
    if (!category) {
        throw new AppError(400, "CATEGORY_NOT_FOUND", "Select a category that belongs to this store.", {
            categoryId: "Category not found for the authenticated store."
        });
    }
    return { ...values, categoryId: category.id, category: category.name };
}

function catalogNotFound(id) {
    return new AppError(400, "CATALOG_PRODUCT_NOT_FOUND", "Select a valid shared catalog product.", {
        catalogProductId: "Catalog product not found."
    });
}

function requireCatalogProduct(catalogProducts, id) {
    const catalogProduct = findCatalogProduct(catalogProducts, id);
    if (!catalogProduct) throw catalogNotFound(id);
    return catalogProduct;
}

function findProductIndex(products, id, storeId) {
    return products.findIndex(function (product) {
        return product && product.id === id && product.storeId === storeId;
    });
}

function notFound(id) {
    return new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.", { id: id });
}

async function listProducts(storeId) {
    const [products, catalogProducts] = await Promise.all([
        readJson("products"),
        readJson("catalogProducts")
    ]);
    return products.filter(function (product) {
        return product && product.storeId === storeId;
    }).map(function (product) { return hydrateProduct(product, catalogProducts); });
}

async function getProduct(id, storeId) {
    const [products, catalogProducts] = await Promise.all([
        readJson("products"),
        readJson("catalogProducts")
    ]);
    const product = products.find(function (item) {
        return item && item.id === id && item.storeId === storeId;
    });
    if (!product) throw notFound(id);
    return hydrateProduct(product, catalogProducts);
}

async function createProduct(input, storeId) {
    const values = validateProductInput(input, { requireQuantity: true });
    const productId = crypto.randomUUID();
    return mutateJsonStores(["products", "catalogProducts"], async function (data) {
        const resolvedValues = resolveProductCategory(values, await readJson("categories"), storeId);
        let catalogProduct;
        let catalogProducts = data.catalogProducts;
        if (resolvedValues.catalogProductId) {
            catalogProduct = requireCatalogProduct(catalogProducts, resolvedValues.catalogProductId);
        } else {
            catalogProduct = {
                id: crypto.randomUUID(),
                name: resolvedValues.name,
                imageUrl: resolvedValues.imageUrl || "",
                sourceProductId: productId
            };
            catalogProducts = catalogProducts.concat(catalogProduct);
        }
        const product = {
            id: productId,
            storeId: storeId,
            ...resolvedValues,
            catalogProductId: catalogProduct.id,
            name: catalogProduct.name,
            imageUrl: catalogProduct.imageUrl
        };
        return {
            values: {
                products: data.products.concat(product),
                catalogProducts: catalogProducts
            },
            result: product
        };
    });
}

async function updateProduct(id, input, storeId) {
    const values = validateProductInput(input);
    return mutateJsonStores(["products", "catalogProducts"], async function (data) {
        const index = findProductIndex(data.products, id, storeId);
        if (index === -1) throw notFound(id);
        const resolvedValues = resolveProductCategory(values, await readJson("categories"), storeId);
        const currentProduct = data.products[index];
        const targetCatalogId = resolvedValues.catalogProductId || currentProduct.catalogProductId;
        let catalogProducts = data.catalogProducts.slice();
        let catalogProduct = requireCatalogProduct(catalogProducts, targetCatalogId);

        if (targetCatalogId === currentProduct.catalogProductId && catalogProduct.imageFileName &&
            resolvedValues.imageUrl !== undefined && resolvedValues.imageUrl !== catalogProduct.imageUrl) {
            throw new AppError(
                409,
                "MANAGED_IMAGE_REQUIRES_UPLOAD",
                "Replace this catalog image using the image upload control.",
                { imageUrl: "Managed catalog images must be replaced through the image upload endpoint." }
            );
        }

        if (targetCatalogId === currentProduct.catalogProductId &&
            (resolvedValues.name !== undefined || resolvedValues.imageUrl !== undefined)) {
            catalogProduct = {
                ...catalogProduct,
                ...(resolvedValues.name === undefined ? {} : { name: resolvedValues.name }),
                ...(resolvedValues.imageUrl === undefined ? {} : { imageUrl: resolvedValues.imageUrl })
            };
            const catalogIndex = catalogProducts.findIndex(function (item) { return item.id === catalogProduct.id; });
            catalogProducts[catalogIndex] = catalogProduct;
        }

        const updatedProducts = data.products.map(function (product) {
            return product && product.catalogProductId === catalogProduct.id
                ? { ...product, name: catalogProduct.name, imageUrl: catalogProduct.imageUrl }
                : product;
        });
        const updatedProduct = {
            ...updatedProducts[index],
            ...Object.fromEntries(editableFields.map(function (field) {
                return [field, resolvedValues[field]];
            })),
            catalogProductId: catalogProduct.id,
            name: catalogProduct.name,
            imageUrl: catalogProduct.imageUrl
        };
        updatedProducts[index] = updatedProduct;
        return {
            values: { products: updatedProducts, catalogProducts: catalogProducts },
            result: updatedProduct
        };
    });
}

async function deleteProduct(id, storeId) {
    return mutateJson("products", async function (products) {
        const index = findProductIndex(products, id, storeId);
        if (index === -1) throw notFound(id);
        const deletedProduct = hydrateProduct(products[index], await readJson("catalogProducts"));
        const updatedProducts = products.slice();
        updatedProducts.splice(index, 1);
        return { value: updatedProducts, result: deletedProduct };
    });
}

module.exports = {
    createProduct,
    deleteProduct,
    getProduct,
    listProducts,
    updateProduct,
    validateProductInput
};