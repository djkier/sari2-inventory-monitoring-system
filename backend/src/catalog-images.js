const path = require("node:path");
const crypto = require("node:crypto");
const fsConstants = require("node:fs").constants;
const fs = require("node:fs/promises");
const { AppError } = require("./errors");
const { publicCatalogProduct } = require("./catalog-products");
const { mutateJsonStores } = require("./storage");
const {
    deletedUploadsManifestPath,
    originalUploadsDirectory,
    runtimeCatalogImageDirectory,
    runtimeUploadsDirectory
} = require("./storage-paths");

const imageDirectory = runtimeCatalogImageDirectory;
const imageUrlPrefix = "/uploads/catalog/";
const maxImageBytes = 5 * 1024 * 1024;
const imageTypes = Object.freeze({
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif"
});
const managedFilePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp|gif)$/;
let deletedUploadsMutationQueue = Promise.resolve();

function normalizeUploadRelativePath(value) {
    if (typeof value !== "string" || !value) return "";
    const normalized = value.replaceAll("\\", "/");
    if (normalized.startsWith("/") || normalized.split("/").includes("..")) return "";
    return normalized;
}

async function readDeletedUploads() {
    let raw;
    try {
        raw = await fs.readFile(deletedUploadsManifestPath, "utf8");
    } catch (error) {
        if (error.code === "ENOENT") return new Set();
        throw error;
    }
    let entries;
    try {
        entries = JSON.parse(raw);
    } catch (error) {
        error.code = "INVALID_UPLOAD_DELETION_MANIFEST";
        throw error;
    }
    if (!Array.isArray(entries) || entries.some(function (entry) {
        return !normalizeUploadRelativePath(entry);
    })) {
        const error = new Error("Runtime upload deletion manifest is invalid.");
        error.code = "INVALID_UPLOAD_DELETION_MANIFEST";
        throw error;
    }
    return new Set(entries.map(normalizeUploadRelativePath));
}

async function writeDeletedUploads(entries) {
    await fs.mkdir(runtimeUploadsDirectory, { recursive: true });
    const temporaryPath = deletedUploadsManifestPath + "." + process.pid + "." + crypto.randomUUID() + ".tmp";
    try {
        await fs.writeFile(temporaryPath, JSON.stringify(Array.from(entries).sort(), null, 2) + "\n", "utf8");
        await fs.rename(temporaryPath, deletedUploadsManifestPath);
    } catch (error) {
        await fs.rm(temporaryPath, { force: true }).catch(function () {});
        throw error;
    }
}

function markOriginalUploadDeleted(relativePath) {
    const normalized = normalizeUploadRelativePath(relativePath);
    if (!normalized) {
        const error = new Error("Invalid runtime upload path.");
        error.code = "INVALID_UPLOAD_PATH";
        return Promise.reject(error);
    }
    const originalPath = path.resolve(originalUploadsDirectory, ...normalized.split("/"));
    if (path.relative(originalUploadsDirectory, originalPath).startsWith("..")) {
        const error = new Error("Runtime upload path escapes the uploads directory.");
        error.code = "INVALID_UPLOAD_PATH";
        return Promise.reject(error);
    }
    const mutation = deletedUploadsMutationQueue.then(async function () {
        try {
            await fs.access(originalPath);
        } catch (error) {
            if (error.code === "ENOENT") return;
            throw error;
        }
        const deletedUploads = await readDeletedUploads();
        if (deletedUploads.has(normalized)) return;
        deletedUploads.add(normalized);
        await writeDeletedUploads(deletedUploads);
    });
    deletedUploadsMutationQueue = mutation.then(function () {}, function () {});
    return mutation;
}

async function copyMissingUploads(sourceDirectory, targetDirectory, deletedUploads, relativeDirectory = "") {
    let entries;
    try {
        entries = await fs.readdir(sourceDirectory, { withFileTypes: true });
    } catch (error) {
        if (error.code === "ENOENT") {
            const missingError = new Error("Original uploads directory is missing: " + sourceDirectory);
            missingError.code = "ORIGINAL_UPLOADS_MISSING";
            missingError.cause = error;
            throw missingError;
        }
        throw error;
    }
    await fs.mkdir(targetDirectory, { recursive: true });
    for (const entry of entries) {
        const relativePath = normalizeUploadRelativePath(
            relativeDirectory ? relativeDirectory + "/" + entry.name : entry.name
        );
        if (!relativePath) {
            const error = new Error("Original uploads contain an invalid path.");
            error.code = "INVALID_UPLOAD_PATH";
            throw error;
        }
        const sourcePath = path.join(sourceDirectory, entry.name);
        const targetPath = path.join(targetDirectory, entry.name);
        if (entry.isDirectory()) {
            await copyMissingUploads(sourcePath, targetPath, deletedUploads, relativePath);
        } else if (entry.isFile() && !deletedUploads.has(relativePath)) {
            await fs.copyFile(sourcePath, targetPath, fsConstants.COPYFILE_EXCL)
                .catch(function (error) {
                    if (error.code !== "EEXIST") throw error;
                });
        } else if (!entry.isFile()) {
            const error = new Error("Original uploads may contain only files and directories.");
            error.code = "UNSUPPORTED_UPLOAD_ENTRY";
            throw error;
        }
    }
}

function normalizeMimeType(value) {
    return typeof value === "string" ? value.split(";", 1)[0].trim().toLowerCase() : "";
}

function hasImageSignature(buffer, mimeType) {
    if (!Buffer.isBuffer(buffer)) return false;
    if (mimeType === "image/jpeg") {
        return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (mimeType === "image/png") {
        return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
    if (mimeType === "image/gif") {
        if (buffer.length < 6) return false;
        const signature = buffer.subarray(0, 6).toString("ascii");
        return signature === "GIF87a" || signature === "GIF89a";
    }
    if (mimeType === "image/webp") {
        return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
            buffer.subarray(8, 12).toString("ascii") === "WEBP";
    }
    return false;
}

function getManagedImagePath(fileName) {
    if (typeof fileName !== "string" || !managedFilePattern.test(fileName) || path.basename(fileName) !== fileName) {
        throw new AppError(500, "INVALID_IMAGE_PATH", "Stored image metadata contains an invalid path.");
    }
    const filePath = path.resolve(imageDirectory, fileName);
    if (path.dirname(filePath) !== imageDirectory) {
        throw new AppError(500, "INVALID_IMAGE_PATH", "Stored image metadata contains an invalid path.");
    }
    return filePath;
}

async function initializeImageStorage() {
    await fs.mkdir(runtimeUploadsDirectory, { recursive: true });
    const deletedUploads = await readDeletedUploads();
    await copyMissingUploads(originalUploadsDirectory, runtimeUploadsDirectory, deletedUploads);
    await fs.mkdir(imageDirectory, { recursive: true });
}

async function removeManagedImage(fileName) {
    if (!fileName) return;
    await markOriginalUploadDeleted("catalog/" + fileName);
    await fs.rm(getManagedImagePath(fileName), { force: true });
}

function validateImageUpload(buffer, contentType) {
    const mimeType = normalizeMimeType(contentType);
    if (!Object.prototype.hasOwnProperty.call(imageTypes, mimeType)) {
        throw new AppError(415, "UNSUPPORTED_IMAGE_TYPE", "Upload a JPEG, PNG, WebP, or GIF image.");
    }
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new AppError(400, "EMPTY_IMAGE", "Choose a nonempty image file to upload.");
    }
    if (buffer.length > maxImageBytes) {
        throw new AppError(413, "IMAGE_TOO_LARGE", "Image files must be 5 MB or smaller.");
    }
    if (!hasImageSignature(buffer, mimeType)) {
        throw new AppError(415, "INVALID_IMAGE_CONTENT", "The file content does not match its image type.");
    }
    return mimeType;
}

async function saveCatalogImage(catalogProductId, buffer, contentType) {
    const mimeType = validateImageUpload(buffer, contentType);
    await initializeImageStorage();
    const fileName = crypto.randomUUID() + imageTypes[mimeType];
    const filePath = getManagedImagePath(fileName);
    await fs.writeFile(filePath, buffer, { flag: "wx" });

    let outcome;
    try {
        outcome = await mutateJsonStores(["catalogProducts", "products"], function (data) {
            const catalogIndex = data.catalogProducts.findIndex(function (catalogProduct) {
                return catalogProduct && catalogProduct.id === catalogProductId;
            });
            if (catalogIndex === -1) {
                throw new AppError(404, "CATALOG_PRODUCT_NOT_FOUND", "Catalog product not found.", {
                    id: catalogProductId
                });
            }

            const previous = data.catalogProducts[catalogIndex];
            const catalogProduct = {
                ...previous,
                imageUrl: imageUrlPrefix + fileName,
                imageFileName: fileName,
                imageMimeType: mimeType,
                imageSize: buffer.length
            };
            const catalogProducts = data.catalogProducts.slice();
            catalogProducts[catalogIndex] = catalogProduct;
            const products = data.products.map(function (product) {
                return product && product.catalogProductId === catalogProductId
                    ? { ...product, imageUrl: catalogProduct.imageUrl }
                    : product;
            });
            return {
                values: { catalogProducts: catalogProducts, products: products },
                result: {
                    catalogProduct: publicCatalogProduct(catalogProduct),
                    previousFileName: previous.imageFileName || "",
                    previousFileStillReferenced: catalogProducts.some(function (item) {
                        return item && item.id !== catalogProductId &&
                            item.imageFileName === previous.imageFileName;
                    })
                }
            };
        });
    } catch (error) {
        await removeManagedImage(fileName).catch(function () {});
        throw error;
    }

    if (outcome.previousFileName && outcome.previousFileName !== fileName &&
        !outcome.previousFileStillReferenced) {
        await removeManagedImage(outcome.previousFileName);
    }
    return outcome.catalogProduct;
}

module.exports = {
    imageDirectory,
    imageTypes,
    imageUrlPrefix,
    initializeImageStorage,
    maxImageBytes,
    removeManagedImage,
    saveCatalogImage,
    validateImageUpload
};
