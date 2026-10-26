const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const { AppError } = require("./errors");
const { publicCatalogProduct } = require("./catalog-products");
const { mutateJsonStores } = require("./storage");

const imageDirectory = path.resolve(__dirname, "../uploads/catalog");
const imageUrlPrefix = "/uploads/catalog/";
const maxImageBytes = 5 * 1024 * 1024;
const imageTypes = Object.freeze({
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif"
});
const managedFilePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp|gif)$/;

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
