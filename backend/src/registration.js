const crypto = require("node:crypto");
const { AppError } = require("./errors");
const { mutateJsonStores } = require("./storage");

const roles = ["Store Owner", "Store Staff"];

function normalizeText(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeUsername(value) {
    return normalizeText(value).toLowerCase();
}

function normalizeStoreName(value) {
    return normalizeText(value).toLowerCase();
}

function validateRegistration(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new AppError(400, "VALIDATION_ERROR", "Registration data must be a JSON object.");
    }

    const values = {
        name: normalizeText(input.name),
        username: normalizeUsername(input.username),
        password: typeof input.password === "string" ? input.password : "",
        confirmation: typeof input.confirmation === "string" ? input.confirmation : "",
        role: typeof input.role === "string" ? input.role.trim() : "",
        storeName: normalizeText(input.storeName),
        storeCode: typeof input.storeCode === "string" ? input.storeCode.trim() : ""
    };
    const errors = {};

    if (!values.name) errors.name = "Full name is required.";
    if (!values.username) errors.username = "Username is required.";
    if (!values.password) errors.password = "Password is required.";
    if (!values.confirmation) errors.confirmation = "Password confirmation is required.";
    else if (values.password !== values.confirmation) errors.confirmation = "Passwords must match.";
    if (!roles.includes(values.role)) errors.role = "Role must be Store Owner or Store Staff.";
    if (!values.storeName) errors.storeName = "Store name is required.";
    if (values.role === "Store Staff" && !/^\d{6}$/.test(values.storeCode)) {
        errors.storeCode = "Store code must contain exactly six digits.";
    }

    if (Object.keys(errors).length) {
        throw new AppError(400, "VALIDATION_ERROR", "Registration validation failed.", errors);
    }

    return values;
}

function generateStoreCode(stores, randomInteger = crypto.randomInt) {
    const existingCodes = new Set(stores.map(function (store) { return store && store.code; }));
    for (let attempt = 0; attempt < 100; attempt += 1) {
        const code = String(randomInteger(0, 1000000)).padStart(6, "0");
        if (!existingCodes.has(code)) return code;
    }
    throw new AppError(503, "STORE_CODE_UNAVAILABLE", "Unable to generate a unique store code. Try again.");
}

function safeUser(user) {
    return {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        storeId: user.storeId
    };
}

function usernameExists(users, username) {
    return users.some(function (user) {
        return user && normalizeUsername(user.username) === username;
    });
}

async function registerUser(input) {
    const values = validateRegistration(input);

    return mutateJsonStores(["stores", "users"], function (data) {
        if (usernameExists(data.users, values.username)) {
            throw new AppError(409, "USERNAME_TAKEN", "This username is already registered.", {
                username: "Choose a different username."
            });
        }

        if (values.role === "Store Owner") {
            const userId = crypto.randomUUID();
            const store = {
                id: crypto.randomUUID(),
                name: values.storeName,
                normalizedName: normalizeStoreName(values.storeName),
                code: generateStoreCode(data.stores),
                ownerUserId: userId
            };
            const user = {
                id: userId,
                name: values.name,
                username: values.username,
                password: values.password,
                role: values.role,
                storeId: store.id
            };

            return {
                values: {
                    stores: data.stores.concat(store),
                    users: data.users.concat(user)
                },
                result: {
                    user: safeUser(user),
                    store: { id: store.id, name: store.name, code: store.code }
                }
            };
        }

        const normalizedStoreName = normalizeStoreName(values.storeName);
        const store = data.stores.find(function (item) {
            return item && item.code === values.storeCode &&
                normalizeStoreName(item.normalizedName || item.name) === normalizedStoreName;
        });
        if (!store) {
            throw new AppError(404, "STORE_NOT_FOUND", "Store name and code do not match an existing store.", {
                storeCode: "Check the store name and six-digit code with the Store Owner."
            });
        }

        const user = {
            id: crypto.randomUUID(),
            name: values.name,
            username: values.username,
            password: values.password,
            role: values.role,
            storeId: store.id
        };
        return {
            values: {
                stores: data.stores,
                users: data.users.concat(user)
            },
            result: {
                user: safeUser(user),
                store: { id: store.id, name: store.name }
            }
        };
    });
}

module.exports = {
    generateStoreCode,
    normalizeStoreName,
    normalizeUsername,
    registerUser,
    validateRegistration
};
