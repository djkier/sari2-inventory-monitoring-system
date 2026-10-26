const path = require("node:path");
const express = require("express");
const cors = require("cors");
const { initializeStorage } = require("./src/storage");
const {
    createProduct,
    deleteProduct,
    getProduct,
    listProducts,
    updateProduct
} = require("./src/products");
const { createStockMovement, listStockMovements } = require("./src/stock");
const { registerUser } = require("./src/registration");
const { migrateLegacyInventory } = require("./src/inventory-migration");
const { seedDemoInventory } = require("./src/demo-seed");
const { migrateLegacyCategories } = require("./src/category-migration");
const { migrateLegacyCatalogProducts } = require("./src/catalog-migration");
const { getCatalogProduct, listCatalogProducts } = require("./src/catalog-products");
const {
    imageDirectory,
    imageTypes,
    initializeImageStorage,
    maxImageBytes,
    saveCatalogImage
} = require("./src/catalog-images");
const {
    createCategory,
    deleteCategory,
    getCategory,
    listCategories,
    updateCategory
} = require("./src/categories");
const { getSettings, migrateLegacySettings, updateSettings } = require("./src/settings");
const { assertNoStoreScope, getDashboardData, getMonitoringData } = require("./src/monitoring");
const { createContactMessage } = require("./src/contact-messages");
const {
    authenticate,
    createSession,
    demoRecords,
    destroySession,
    ensureDemoAuthData,
    requireAuthentication,
    updateSessionStoreIdentity,
    updateSessionUserIdentity
} = require("./src/authentication");

const app = express();
const frontendDirectory = path.resolve(__dirname, "../frontend");
const configuredPort = Number(process.env.PORT);
const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 3000;

app.disable("x-powered-by");
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", function (request, response) {
    response.json({
        success: true,
        data: { status: "ok" }
    });
});

app.post("/api/contact", async function (request, response) {
    const contactMessage = await createContactMessage(request.body);
    response.status(201).json({
        success: true,
        data: { id: contactMessage.id, createdAt: contactMessage.createdAt }
    });
});

app.post("/api/auth/register", async function (request, response) {
    const result = await registerUser(request.body);
    response.status(201).json({ success: true, data: result });
});

app.post("/api/auth/login", async function (request, response) {
    const identity = await authenticate(request.body);
    createSession(response, identity);
    response.json({ success: true, data: identity });
});

app.get("/api/auth/me", requireAuthentication, function (request, response) {
    response.json({ success: true, data: request.auth });
});

app.post("/api/auth/logout", requireAuthentication, function (request, response) {
    destroySession(request, response);
    response.json({ success: true, data: { loggedOut: true } });
});

app.use([
    "/api/products",
    "/api/catalog-products",
    "/api/categories",
    "/api/stock-movements",
    "/api/settings",
    "/api/dashboard",
    "/api/monitoring"
], requireAuthentication);

app.get("/api/dashboard", async function (request, response) {
    assertNoStoreScope(request.query);
    response.json({ success: true, data: await getDashboardData(request.auth.store.id) });
});

app.get("/api/monitoring", async function (request, response) {
    assertNoStoreScope(request.query);
    response.json({ success: true, data: await getMonitoringData(request.auth.store.id) });
});

app.get("/api/settings", async function (request, response) {
    const settings = await getSettings(request.auth.store.id, request.auth.user);
    response.json({ success: true, data: settings });
});

app.put("/api/settings", async function (request, response) {
    const result = await updateSettings(request.body, request.auth.store.id, request.auth.user);
    if (result.store) updateSessionStoreIdentity(result.store);
    updateSessionUserIdentity(result.user);
    response.json({ success: true, data: result.settings });
});

app.get("/api/catalog-products", async function (request, response) {
    assertNoStoreScope(request.query);
    response.json({ success: true, data: await listCatalogProducts() });
});

app.get("/api/catalog-products/:id", async function (request, response) {
    assertNoStoreScope(request.query);
    response.json({ success: true, data: await getCatalogProduct(request.params.id) });
});

app.put(
    "/api/catalog-products/:id/image",
    express.raw({ type: Object.keys(imageTypes), limit: maxImageBytes }),
    async function (request, response) {
        const catalogProduct = await saveCatalogImage(
            request.params.id,
            request.body,
            request.headers["content-type"]
        );
        response.json({ success: true, data: catalogProduct });
    }
);

app.get("/api/categories", async function (request, response) {
    assertNoStoreScope(request.query);
    response.json({ success: true, data: await listCategories(request.auth.store.id) });
});

app.get("/api/categories/:id", async function (request, response) {
    assertNoStoreScope(request.query);
    response.json({ success: true, data: await getCategory(request.params.id, request.auth.store.id) });
});

app.post("/api/categories", async function (request, response) {
    const category = await createCategory(request.body, request.auth.store.id);
    response.status(201).json({ success: true, data: category });
});

app.put("/api/categories/:id", async function (request, response) {
    response.json({
        success: true,
        data: await updateCategory(request.params.id, request.body, request.auth.store.id)
    });
});

app.delete("/api/categories/:id", async function (request, response) {
    response.json({ success: true, data: await deleteCategory(request.params.id, request.auth.store.id) });
});

app.get("/api/products", async function (request, response) {
    response.json({ success: true, data: await listProducts(request.auth.store.id) });
});

app.get("/api/products/:id", async function (request, response) {
    response.json({ success: true, data: await getProduct(request.params.id, request.auth.store.id) });
});

app.post("/api/products", async function (request, response) {
    const product = await createProduct(request.body, request.auth.store.id);
    response.status(201).json({ success: true, data: product });
});

app.put("/api/products/:id", async function (request, response) {
    response.json({ success: true, data: await updateProduct(request.params.id, request.body, request.auth.store.id) });
});

app.delete("/api/products/:id", async function (request, response) {
    response.json({ success: true, data: await deleteProduct(request.params.id, request.auth.store.id) });
});

app.get("/api/stock-movements", async function (request, response) {
    response.json({ success: true, data: await listStockMovements(request.auth.store.id) });
});

app.post("/api/stock-movements", async function (request, response) {
    const result = await createStockMovement(request.body, request.auth.store.id);
    response.status(201).json({ success: true, data: result });
});

app.use("/uploads/catalog", express.static(imageDirectory, {
    dotfiles: "deny",
    fallthrough: true,
    index: false,
    maxAge: 0
}));

app.use("/uploads/catalog", function (request, response) {
    response.status(404).end();
});

app.use(express.static(frontendDirectory));

app.use("/api", function (request, response) {
    response.status(404).json({
        success: false,
        error: {
            code: "NOT_FOUND",
            message: "API route not found."
        }
    });
});

app.use(function (error, request, response, next) {
    if (response.headersSent) {
        next(error);
        return;
    }

    const imageTooLarge = error && error.type === "entity.too.large";
    const status = imageTooLarge ? 413 : (error.status || 500);
    if (status >= 500) console.error(error);
    response.status(status).json({
        success: false,
        error: {
            code: imageTooLarge ? "IMAGE_TOO_LARGE" :
                (error.code || (status === 400 ? "INVALID_JSON" : "INTERNAL_SERVER_ERROR")),
            message: imageTooLarge ? "Image files must be 5 MB or smaller." :
                (status < 500 ? error.message : "An unexpected server error occurred."),
            ...(error.details === undefined ? {} : { details: error.details })
        }
    });
});

async function startServer() {
    await initializeStorage();
    await initializeImageStorage();
    await ensureDemoAuthData();
    await migrateLegacySettings(demoRecords.store.id);
    await migrateLegacyInventory(demoRecords.store.id);
    await seedDemoInventory(demoRecords.store.id);
    await migrateLegacyCategories();
    await migrateLegacyCatalogProducts();
    return app.listen(port, function () {
        console.log("Sari2 is running at http://localhost:" + port);
    });
}

if (require.main === module) {
    startServer().catch(function (error) {
        console.error("Unable to start Sari2.", error);
        process.exitCode = 1;
    });
}

module.exports = { app, startServer };
