const express = require("express");
const cors = require("cors");
const path = require("node:path");
const { AppError } = require("./src/errors");
const {
    authenticateAccount,
    createAccount,
    createSession,
    destroySession,
    getSession,
    getStoreById,
    initializeAccountData,
    publicStore
} = require("./src/accounts");
const { createCategory, listCategories } = require("./src/categories");
const { getDashboardData, getMonitoringData } = require("./src/monitoring");
const { createProduct, deleteProduct, listProducts, updateProduct } = require("./src/products");
const { createStockMovement, listStockMovements } = require("./src/stock");
const { getSettings, saveSettings } = require("./src/settings");

const app = express();
const PORT = process.env.PORT || 3000;
const frontendDirectory = path.resolve(__dirname, "../frontend");
const sessionCookieName = "sari2_session";
const sessionMaxAgeSeconds = 8 * 60 * 60;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function getCookieValue(req, name) {
    const cookieHeader = req.headers.cookie || "";
    const item = cookieHeader.split(";").map(function (part) { return part.trim(); })
        .find(function (part) { return part.startsWith(name + "="); });
    if (!item) return "";
    try {
        return decodeURIComponent(item.slice(name.length + 1));
    } catch (error) {
        return "";
    }
}

function setSessionCookie(req, res, sessionId) {
    const secure = req.secure ? "; Secure" : "";
    res.setHeader("Set-Cookie", sessionCookieName + "=" + encodeURIComponent(sessionId) +
        "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" + sessionMaxAgeSeconds + secure);
}

function clearSessionCookie(req, res) {
    const secure = req.secure ? "; Secure" : "";
    res.setHeader("Set-Cookie", sessionCookieName + "=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" + secure);
}

function requireAuthentication(req, res, next) {
    const session = getSession(getCookieValue(req, sessionCookieName));
    if (!session) {
        next(new AppError(401, "AUTHENTICATION_REQUIRED", "Log in to access this resource."));
        return;
    }
    req.auth = session;
    next();
}

app.post("/api/auth/register", async function (req, res, next) {
    try {
        res.status(201).json(await createAccount(req.body));
    } catch (error) {
        next(error);
    }
});

app.post("/api/auth/login", async function (req, res, next) {
    try {
        const account = await authenticateAccount(req.body);
        const session = createSession(account);
        setSessionCookie(req, res, session.id);
        res.json({
            username: account.username,
            name: account.name,
            role: account.role
        });
    } catch (error) {
        next(error);
    }
});

app.get("/api/auth/session", requireAuthentication, async function (req, res, next) {
    try {
        const store = await getStoreById(req.auth.storeId);
        if (!store) {
            destroySession(getCookieValue(req, sessionCookieName));
            throw new AppError(401, "STORE_ASSOCIATION_REQUIRED", "This account is not linked to a store.");
        }
        if (req.auth.role === "Store Owner" && store.ownerUserId !== req.auth.userId) {
            destroySession(getCookieValue(req, sessionCookieName));
            throw new AppError(403, "STORE_OWNERSHIP_INVALID", "This Owner account is not linked to its own store.");
        }
        res.json({
            user: {
                userId: req.auth.userId,
                username: req.auth.username,
                name: req.auth.name,
                role: req.auth.role,
                isDemo: req.auth.isDemo
            },
            store: publicStore(store)
        });
    } catch (error) {
        next(error);
    }
});

app.post("/api/auth/logout", function (req, res) {
    destroySession(getCookieValue(req, sessionCookieName));
    clearSessionCookie(req, res);
    res.status(204).end();
});

app.get("/api/health", function (req, res) {
    res.json({
        status: "ok",
        message: "Sari2 backend is running."
    });
});

app.use("/api", requireAuthentication);

app.get("/api/dashboard", async function (req, res, next) {
    try {
        const data = await getDashboardData(req.auth.storeId);
        res.json(data);
    } catch (error) {
        next(error);
    }
});

app.get("/api/monitoring", async function (req, res, next) {
    try {
        res.json(await getMonitoringData(req.auth.storeId));
    } catch (error) {
        next(error);
    }
});

app.get("/api/products", async function (req, res, next) {
    try {
        res.json(await listProducts(req.auth.storeId));
    } catch (error) {
        next(error);
    }
});

app.post("/api/products", async function (req, res, next) {
    try {
        res.status(201).json(await createProduct(req.body, req.auth.storeId));
    } catch (error) {
        next(error);
    }
});

app.put("/api/products/:id", async function (req, res, next) {
    try {
        res.json(await updateProduct(req.params.id, req.body, req.auth.storeId));
    } catch (error) {
        next(error);
    }
});

app.delete("/api/products/:id", async function (req, res, next) {
    try {
        await deleteProduct(req.params.id, req.auth.storeId);
        res.status(204).end();
    } catch (error) {
        next(error);
    }
});

app.get("/api/categories", async function (req, res, next) {
    try {
        res.json(await listCategories(req.auth.storeId));
    } catch (error) {
        next(error);
    }
});

app.post("/api/categories", async function (req, res, next) {
    try {
        res.status(201).json(await createCategory(req.body, req.auth.storeId));
    } catch (error) {
        next(error);
    }
});

app.get("/api/stock-movements", async function (req, res, next) {
    try {
        res.json(await listStockMovements(req.auth.storeId));
    } catch (error) {
        next(error);
    }
});

app.post("/api/stock-movements", async function (req, res, next) {
    try {
        res.status(201).json(await createStockMovement(req.body, req.auth.storeId));
    } catch (error) {
        next(error);
    }
});

app.get("/api/settings", async function (req, res, next) {
    try {
        res.json(await getSettings(req.auth.storeId));
    } catch (error) {
        next(error);
    }
});

app.put("/api/settings", async function (req, res, next) {
    try {
        res.json(await saveSettings(req.auth.storeId, req.body));
    } catch (error) {
        next(error);
    }
});

app.use(express.static(frontendDirectory));

app.use(function (req, res, next) {
    next(new AppError(404, "NOT_FOUND", "Resource not found."));
});

app.use(function (err, req, res, next) {
    if (res.headersSent) return next(err);

    const status = Number.isInteger(err.status) &&
        err.status >= 400 && err.status <= 599
        ? err.status
        : err.type === "entity.parse.failed" ? 400 : 500;

    const code = err.code ||
        (err.type === "entity.parse.failed" ? "INVALID_JSON" : "INTERNAL_ERROR");

    const message = status === 500
        ? "An unexpected server error occurred."
        : err.message || "Request failed.";

    const error = { code, message };

    if (err.details !== undefined) {
        error.details = err.details;
    }

    res.status(status).json({ error });
});

initializeAccountData().then(function () {
    app.listen(PORT, function () {
        console.log("Sari2 backend running at http://localhost:" + PORT);
    });
}).catch(function (error) {
    console.error("Unable to initialize Sari2 account data:", error.message);
    process.exitCode = 1;
});
