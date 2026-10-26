const crypto = require("node:crypto");
const { AppError } = require("./errors");
const { normalizeStoreName, normalizeUsername } = require("./registration");
const { mutateJsonStores, readJson } = require("./storage");

const sessionCookieName = "sari2_session";
const sessionLifetimeMilliseconds = 8 * 60 * 60 * 1000;
const sessions = new Map();

const demoRecords = Object.freeze({
    store: {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Sari2 Demo Store",
        normalizedName: "sari2 demo store"
    },
    owner: {
        id: "00000000-0000-4000-8000-000000000101",
        name: "Juan Dela Cruz",
        username: "owner",
        password: "owner123",
        role: "Store Owner"
    },
    staff: {
        id: "00000000-0000-4000-8000-000000000102",
        name: "Maria Santos",
        username: "staff",
        password: "staff123",
        role: "Store Staff"
    }
});

function findAvailableStoreCode(stores) {
    const usedCodes = new Set(stores.map(function (store) { return store && store.code; }));
    for (let value = 0; value <= 999999; value += 1) {
        const code = String(value).padStart(6, "0");
        if (!usedCodes.has(code)) return code;
    }
    throw new AppError(503, "STORE_CODE_UNAVAILABLE", "Unable to initialize the demo store.");
}

function assertDemoUsernameAvailable(users, demoUser) {
    const conflictingUser = users.find(function (user) {
        return user && user.username === demoUser.username && user.id !== demoUser.id;
    });
    if (conflictingUser) {
        throw new AppError(
            409,
            "DEMO_USERNAME_CONFLICT",
            "The reserved demo username '" + demoUser.username + "' is already in use."
        );
    }
}

async function ensureDemoAuthData() {
    return mutateJsonStores(["stores", "users"], function (data) {
        assertDemoUsernameAvailable(data.users, demoRecords.owner);
        assertDemoUsernameAvailable(data.users, demoRecords.staff);

        const stores = data.stores.slice();
        let storeIndex = stores.findIndex(function (store) {
            return store && store.id === demoRecords.store.id;
        });
        let store;

        if (storeIndex === -1) {
            store = {
                ...demoRecords.store,
                code: findAvailableStoreCode(stores),
                ownerUserId: demoRecords.owner.id
            };
            stores.push(store);
            storeIndex = stores.length - 1;
        } else {
            store = {
                ...stores[storeIndex],
                ...demoRecords.store,
                normalizedName: normalizeStoreName(demoRecords.store.name),
                ownerUserId: demoRecords.owner.id
            };
            const duplicateCode = stores.some(function (item, index) {
                return index !== storeIndex && item && item.code === store.code;
            });
            if (!/^\d{6}$/.test(store.code || "") || duplicateCode) {
                store.code = findAvailableStoreCode(stores.filter(function (item, index) {
                    return index !== storeIndex;
                }));
            }
            stores[storeIndex] = store;
        }

        const users = data.users.slice();
        [demoRecords.owner, demoRecords.staff].forEach(function (demoUser) {
            const user = { ...demoUser, storeId: store.id };
            const userIndex = users.findIndex(function (item) {
                return item && item.id === demoUser.id;
            });
            if (userIndex === -1) users.push(user);
            else users[userIndex] = user;
        });

        return {
            values: { stores: stores, users: users },
            result: { storeId: store.id }
        };
    });
}

function validateLogin(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new AppError(400, "VALIDATION_ERROR", "Login data must be a JSON object.");
    }

    const username = normalizeUsername(input.username);
    const password = typeof input.password === "string" ? input.password : "";
    const errors = {};
    if (!username) errors.username = "Username is required.";
    if (!password) errors.password = "Password is required.";
    if (Object.keys(errors).length) {
        throw new AppError(400, "VALIDATION_ERROR", "Login validation failed.", errors);
    }
    return { username: username, password: password };
}

function safeIdentity(user, store) {
    return {
        user: {
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role,
            storeId: store.id
        },
        store: {
            id: store.id,
            name: store.name
        }
    };
}

async function authenticate(input) {
    const credentials = validateLogin(input);
    const users = await readJson("users");
    const user = users.find(function (item) {
        return item && item.username === credentials.username &&
            item.password === credentials.password;
    });
    if (!user) {
        throw new AppError(401, "INVALID_CREDENTIALS", "Invalid username or password.");
    }

    const stores = await readJson("stores");
    const store = stores.find(function (item) { return item && item.id === user.storeId; });
    if (!store) {
        throw new AppError(401, "ACCOUNT_STORE_UNAVAILABLE", "The account store is unavailable.");
    }
    return safeIdentity(user, store);
}

function readSessionToken(request) {
    const cookieHeader = request.headers.cookie;
    if (typeof cookieHeader !== "string") return "";

    for (const part of cookieHeader.split(";")) {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex === -1) continue;
        const name = part.slice(0, separatorIndex).trim();
        if (name !== sessionCookieName) continue;
        try {
            return decodeURIComponent(part.slice(separatorIndex + 1).trim());
        } catch (error) {
            return "";
        }
    }
    return "";
}

function createSession(response, identity) {
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, {
        identity: identity,
        expiresAt: Date.now() + sessionLifetimeMilliseconds
    });
    response.cookie(sessionCookieName, token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: sessionLifetimeMilliseconds,
        path: "/"
    });
}

function getSession(request) {
    const token = readSessionToken(request);
    const session = token ? sessions.get(token) : undefined;
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
        sessions.delete(token);
        return null;
    }
    return { token: token, identity: session.identity };
}

function requireAuthentication(request, response, next) {
    const session = getSession(request);
    if (!session) {
        next(new AppError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue."));
        return;
    }
    request.auth = session.identity;
    request.sessionToken = session.token;
    next();
}

function destroySession(request, response) {
    if (request.sessionToken) sessions.delete(request.sessionToken);
    response.clearCookie(sessionCookieName, {
        httpOnly: true,
        sameSite: "lax",
        path: "/"
    });
}

function updateSessionStoreIdentity(store) {
    for (const session of sessions.values()) {
        if (session.identity.store.id !== store.id) continue;
        session.identity = {
            ...session.identity,
            store: { id: store.id, name: store.name }
        };
    }
}

module.exports = {
    authenticate,
    createSession,
    demoRecords,
    destroySession,
    ensureDemoAuthData,
    requireAuthentication,
    safeIdentity,
    updateSessionStoreIdentity,
    validateLogin
};
