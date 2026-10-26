const { AppError } = require("./errors");
const { readJson } = require("./storage");

const managedImageFilePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp|gif)$/;
const managedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function validateCatalogProduct(record) {
    if (!record || typeof record.id !== "string" || !record.id ||
        typeof record.name !== "string" || !record.name.trim() ||
        typeof record.imageUrl !== "string") {
        return false;
    }
    const hasFileName = record.imageFileName !== undefined;
    const hasMimeType = record.imageMimeType !== undefined;
    const hasSize = record.imageSize !== undefined;
    if (!hasFileName && !hasMimeType && !hasSize) return true;
    return hasFileName && hasMimeType && hasSize &&
        typeof record.imageFileName === "string" && managedImageFilePattern.test(record.imageFileName) &&
        managedImageMimeTypes.has(record.imageMimeType) &&
        record.imageUrl === "/uploads/catalog/" + record.imageFileName &&
        Number.isSafeInteger(record.imageSize) && record.imageSize > 0;
}

function catalogReferenceError(catalogProductId) {
    return new AppError(500, "INVALID_CATALOG_REFERENCE", "Inventory data has an invalid catalog reference.", {
        catalogProductId: catalogProductId
    });
}

function findCatalogProduct(catalogProducts, id) {
    return catalogProducts.find(function (catalogProduct) {
        return catalogProduct && catalogProduct.id === id;
    }) || null;
}

function publicCatalogProduct(catalogProduct) {
    const { sourceProductId, ...publicFields } = catalogProduct;
    return publicFields;
}

