const crypto = require("node:crypto");
const { promisify } = require("node:util");
const { AppError } = require("./errors");
const { mutateJsonStores, readJson } = require("./storage");

const scrypt = promisify(crypto.scrypt);
const passwordHashLength = 64;
const storeIdentityPattern = /^\d{6}$/;
const storeIdentityAttempts = 10000;
const allowedRoles = new Set(["Store Owner", "Store Staff"]);
const reservedUsernames = new Set(["owner", "staff"]);
const DEMO_STORE_ID = "00000000-0000-4000-8000-000000000001";
const demoAccounts = Object.freeze([
    Object.freeze({
        userId: "00000000-0000-4000-8000-000000000002",
        username: "owner",
        password: "owner123",
        name: "Juan Dela Cruz",
        role: "Store Owner",
        storeId: DEMO_STORE_ID,
        isDemo: true
    }),
    Object.freeze({
        userId: "00000000-0000-4000-8000-000000000003",
        username: "staff",
        password: "staff123",
        name: "Maria Santos",
        role: "Store Staff",
        storeId: DEMO_STORE_ID,
        isDemo: true
    })
]);
const sessions = new Map();
const sessionLifetimeMs = 8 * 60 * 60 * 1000;

function publicAccount(account) {
    return {
        userId: account.userId || account.id,
        username: account.username,
        name: account.name,
        role: account.role,
        storeId: account.storeId,
        isDemo: Boolean(account.isDemo)
    };
}

function publicStore(store) {
    return {
        id: store.id,
        name: store.name,
        storeIdentity: store.storeIdentity
    };
}

function generateStoreIdentity(stores) {
    for (let attempt = 0; attempt < storeIdentityAttempts; attempt += 1) {
        const identity = String(crypto.randomInt(100000, 1000000));
        if (!stores.some(function (store) { return store.storeIdentity === identity; })) {
            return identity;
        }
    }
    throw new AppError(503, "STORE_IDENTITY_UNAVAILABLE", "A unique Store Identity could not be generated. Try again.");
}

function generateInternalId(records) {
    for (let attempt = 0; attempt < storeIdentityAttempts; attempt += 1) {
        const id = crypto.randomUUID();
        if (!records.some(function (record) { return record.id === id; })) return id;
    }
    throw new AppError(503, "IDENTITY_UNAVAILABLE", "A unique account or store identity could not be generated.");
}

function createStore(stores, ownerUserId, name, id) {
    const store = {
        id: id || generateInternalId(stores),
        name,
        storeIdentity: generateStoreIdentity(stores),
        ownerUserId
    };
    stores.push(store);
    return store;
}

function legacyDemoStoreName(settings) {
    if (!Array.isArray(settings)) return "Sari2 Demo Store";
    const saved = settings.find(function (item) {
        return item && item.storeId === DEMO_STORE_ID &&
            typeof item.storeName === "string" && item.storeName.trim();
    });
    return saved ? saved.storeName.trim() : "Sari2 Demo Store";
}

async function initializeAccountData() {
    const settings = await readJson("settings");
    return mutateJsonStores(["users", "stores"], function (collections) {
        if (!Array.isArray(collections.users) || !Array.isArray(collections.stores)) {
            throw new Error("User and store data must be arrays.");
        }

        const users = collections.users.map(function (user) { return { ...user }; });
        const stores = collections.stores.map(function (store) { return { ...store }; });
        let demoStore = stores.find(function (store) { return store.id === DEMO_STORE_ID; });

        if (!demoStore) {
            demoStore = createStore(
                stores,
                demoAccounts[0].userId,
                legacyDemoStoreName(settings),
                DEMO_STORE_ID
            );
        } else {
            if (typeof demoStore.name !== "string" || !demoStore.name.trim()) {
                demoStore.name = legacyDemoStoreName(settings);
            }
            if (!storeIdentityPattern.test(demoStore.storeIdentity || "") ||
                stores.some(function (store) {
                    return store !== demoStore && store.storeIdentity === demoStore.storeIdentity;
                })) {
                demoStore.storeIdentity = generateStoreIdentity(stores.filter(function (store) {
                    return store !== demoStore;
                }));
            }
            demoStore.ownerUserId = demoAccounts[0].userId;
        }

        for (const user of users) {
            if (user.role !== "Store Owner") continue;

            const ownedStore = stores.find(function (store) {
                return store.id === user.storeId && store.ownerUserId === user.id;
            });
            if (ownedStore) continue;

            const storeName = typeof user.name === "string" && user.name.trim()
                ? user.name.trim() + "'s Store"
                : "New Store";
            const store = createStore(stores, user.id, storeName);
            user.storeId = store.id;
        }

        const duplicateIdentities = new Set();
        for (const store of stores) {
            if (!storeIdentityPattern.test(store.storeIdentity || "") ||
                duplicateIdentities.has(store.storeIdentity)) {
                store.storeIdentity = generateStoreIdentity(stores.filter(function (item) {
                    return item !== store;
                }));
            }
            duplicateIdentities.add(store.storeIdentity);
        }

        return {
            values: { users, stores },
            result: { migratedUsers: users.length }
        };
    });
}

function validateRegistration(input) {
    const values = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const name = typeof values.name === "string" ? values.name.trim() : "";
    const username = typeof values.username === "string" ? values.username : "";
    const password = typeof values.password === "string" ? values.password : "";
    const role = typeof values.role === "string" ? values.role : "";

    if (!name || !username || !password || !role) {
        throw new AppError(400, "INVALID_ACCOUNT", "Complete all required account fields.");
    }
    if (name.length > 120 || username !== username.trim() || username.length > 64) {
        throw new AppError(400, "INVALID_ACCOUNT", "Check the name and username fields.");
    }
    if (password.length < 8 || password.length > 1024) {
        throw new AppError(400, "INVALID_PASSWORD", "Password must be at least 8 characters.");
    }
    if (!allowedRoles.has(role)) {
        throw new AppError(400, "INVALID_ROLE", "Choose Store Owner or Store Staff.");
    }
    if (reservedUsernames.has(username)) {
        throw new AppError(409, "USERNAME_UNAVAILABLE", "That username is reserved. Choose another username.");
    }

    if (role === "Store Owner") {
        const storeName = typeof values.storeName === "string" ? values.storeName.trim() : "";
        if (!storeName || storeName.length > 120) {
            throw new AppError(400, "INVALID_STORE_NAME", "Enter a store name of 120 characters or fewer.");
        }
        return { name, username, password, role, storeName };
    }

    const storeIdentity = typeof values.storeIdentity === "string" ? values.storeIdentity : "";
    if (!storeIdentityPattern.test(storeIdentity)) {
        throw new AppError(400, "INVALID_STORE_IDENTITY", "Enter a six-digit Store Identity.");
    }
    return { name, username, password, role, storeIdentity };
}

async function createAccount(input) {
    const account = validateRegistration(input);
    const salt = crypto.randomBytes(16).toString("base64url");
    const passwordHash = await scrypt(account.password, salt, passwordHashLength);
    const userFields = {
        username: account.username,
        name: account.name,
        role: account.role,
        passwordSalt: salt,
        passwordHash: passwordHash.toString("base64url")
    };

    return mutateJsonStores(["users", "stores"], function (collections) {
        if (!Array.isArray(collections.users) || !Array.isArray(collections.stores)) {
            throw new Error("User and store data must be arrays.");
        }
        if (collections.users.some(function (saved) { return saved.username === account.username; })) {
            throw new AppError(409, "USERNAME_TAKEN", "That username is already in use.");
        }

        const user = {
            id: generateInternalId(collections.users.concat(demoAccounts.map(function (demo) {
                return { id: demo.userId };
            }))),
            ...userFields
        };

        let store;
        if (account.role === "Store Owner") {
            store = createStore(collections.stores, user.id, account.storeName);
        } else {
            store = collections.stores.find(function (saved) {
                return saved.storeIdentity === account.storeIdentity;
            });
            if (!store) {
                throw new AppError(400, "STORE_IDENTITY_NOT_FOUND", "That Store Identity does not exist.");
            }
        }

        user.storeId = store.id;
        const users = collections.users.concat(user);

        return {
            values: { users, stores: collections.stores },
            result: {
                user: publicAccount(user),
                store: publicStore(store)
            }
        };
    });
}

async function authenticateAccount(input) {
    const username = input && typeof input.username === "string" ? input.username : "";
    const password = input && typeof input.password === "string" ? input.password : "";
    const role = input && typeof input.role === "string" ? input.role : "";

    const demo = demoAccounts.find(function (account) {
        return account.username === username && account.password === password && account.role === role;
    });
    if (demo) return publicAccount(demo);

    const users = await readJson("users");
    const account = Array.isArray(users)
        ? users.find(function (user) { return user.username === username; })
        : null;

    if (!account || typeof account.passwordSalt !== "string" ||
        typeof account.passwordHash !== "string" || !password) {
        throw new AppError(401, "INVALID_CREDENTIALS", "Invalid username or password.");
    }

    const expectedHash = Buffer.from(account.passwordHash, "base64url");
    const actualHash = await scrypt(password, account.passwordSalt, passwordHashLength);
    if (expectedHash.length !== actualHash.length ||
        !crypto.timingSafeEqual(expectedHash, actualHash) || account.role !== role) {
        throw new AppError(401, "INVALID_CREDENTIALS", "Invalid username or password.");
    }
    if (!account.storeId) {
        throw new AppError(403, "STORE_ASSOCIATION_REQUIRED", "This account is not linked to a store.");
    }

    const stores = await readJson("stores");
    const store = Array.isArray(stores)
        ? stores.find(function (item) { return item.id === account.storeId; })
        : null;
    if (!store) {
        throw new AppError(403, "STORE_ASSOCIATION_REQUIRED", "This account is not linked to a store.");
    }
    if (account.role === "Store Owner" && store.ownerUserId !== account.id) {
        throw new AppError(403, "STORE_OWNERSHIP_INVALID", "This Owner account is not linked to its own store.");
    }

    return publicAccount(account);
}

function createSession(account) {
    const sessionId = crypto.randomBytes(32).toString("base64url");
    sessions.set(sessionId, {
        ...account,
        expiresAt: Date.now() + sessionLifetimeMs
    });
    return { id: sessionId, maxAge: sessionLifetimeMs };
}

function getSession(sessionId) {
    if (!sessionId) return null;
    const session = sessions.get(sessionId);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
        sessions.delete(sessionId);
        return null;
    }
    return { ...session };
}

function destroySession(sessionId) {
    if (!sessionId) return false;
    return sessions.delete(sessionId);
}

async function getStoreById(storeId) {
    const stores = await readJson("stores");
    return Array.isArray(stores)
        ? stores.find(function (store) { return store.id === storeId; }) || null
        : null;
}

module.exports = {
    DEMO_STORE_ID,
    authenticateAccount,
    createAccount,
    createSession,
    destroySession,
    getSession,
    getStoreById,
    initializeAccountData,
    publicAccount,
    publicStore
};
