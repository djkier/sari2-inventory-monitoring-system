const path = require("node:path");

const backendDirectory = path.resolve(__dirname, "..");
const originalDataDirectory = path.join(backendDirectory, "data");
const runtimeDataDirectory = path.join(backendDirectory, "temp_data");
const originalUploadsDirectory = path.join(backendDirectory, "uploads");
const runtimeUploadsDirectory = path.join(runtimeDataDirectory, "uploads");
const originalCatalogImageDirectory = path.join(originalUploadsDirectory, "catalog");
const runtimeCatalogImageDirectory = path.join(runtimeUploadsDirectory, "catalog");
const deletedUploadsManifestPath = path.join(runtimeUploadsDirectory, ".deleted-files.json");

module.exports = Object.freeze({
    backendDirectory,
    deletedUploadsManifestPath,
    originalCatalogImageDirectory,
    originalDataDirectory,
    originalUploadsDirectory,
    runtimeCatalogImageDirectory,
    runtimeDataDirectory,
    runtimeUploadsDirectory
});
