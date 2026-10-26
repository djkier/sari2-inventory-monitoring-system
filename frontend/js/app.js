// Shared authenticated shell. Load after storage.js and auth.js.
let appContext = null;
let appContextRequest = null;

function renderAuthenticatedContext(context) {
    document.getElementById("current-user-name").textContent = context.user.name;
    document.getElementById("current-user-role").textContent = context.user.role;

    const storeName = document.getElementById("store-name");
    if (storeName.tagName === "SPAN") storeName.textContent = context.store.name;
    else storeName.textContent = context.store.name;

    const storeIdentity = document.getElementById("store-identity");
    if (storeIdentity) storeIdentity.textContent = context.store.storeIdentity;
}

async function migrateLegacyDemoSettings(context) {
    if (!context.user.isDemo) return context;

    const current = await Sari2Api.request("settings");
    if (current.hasSavedSettings) return context;

    let legacyValue;
    try {
        legacyValue = localStorage.getItem("sari2_settings");
    } catch (error) {
        return context;
    }
    if (!legacyValue) return context;

    let legacy;
    try {
        legacy = JSON.parse(legacyValue);
    } catch (error) {
        return context;
    }
    if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) return context;

    const settings = {
        storeName: typeof legacy.storeName === "string" && legacy.storeName.trim()
            ? legacy.storeName.trim()
            : current.storeName,
        ownerName: typeof legacy.ownerName === "string" ? legacy.ownerName.trim() : "",
        defaultLowStockThreshold: Number.isSafeInteger(legacy.lowStockThreshold) && legacy.lowStockThreshold >= 0
            ? legacy.lowStockThreshold
            : current.defaultLowStockThreshold,
        expirationWarningDays: Number.isSafeInteger(legacy.expirationWarningDays) && legacy.expirationWarningDays >= 0
            ? legacy.expirationWarningDays
            : current.expirationWarningDays
    };
    const saved = await Sari2Api.request("settings", { method: "PUT", body: settings });
    context.store.name = saved.storeName;
    return context;
}

function initializeApp() {
    const shell = document.getElementById("app-shell");
    shell.hidden = true;
    const user = requireSession();
    if (!user) return null;

    if (appContext && appContext.user.username === user.username) {
        renderAuthenticatedContext(appContext);
        shell.hidden = false;
        return user;
    }
    if (appContextRequest) return user;

    appContextRequest = Sari2Api.request("auth/session").then(migrateLegacyDemoSettings).then(function (context) {
        const currentUser = getCurrentUser();
        if (!currentUser || currentUser.username !== context.user.username) {
            clearSession();
            window.location.replace("../frontfacing/login.html");
            return;
        }
        appContext = context;
        renderAuthenticatedContext(context);
        shell.hidden = false;
        document.getElementById("app-feedback").textContent = "";
    }).catch(function (error) {
        if (error.status === 401 || error.status === 403) {
            clearSession();
            window.location.replace("../frontfacing/login.html");
            return;
        }
        document.getElementById("app-feedback").textContent =
            error.message || "Unable to load your store account.";
    }).finally(function () {
        appContextRequest = null;
    });

    return user;
}

document.getElementById("logout-button").addEventListener("click", async function (event) {
    const button = event.currentTarget;
    button.disabled = true;
    try {
        await logout();
    } catch (error) {
        button.disabled = false;
        document.getElementById("app-feedback").textContent =
            error.message || "Unable to log out. Please try again.";
    }
});

// Recheck sessions on browser-back navigation and after logout in another tab.
window.addEventListener("pageshow", initializeApp);
window.addEventListener("storage", function (event) {
    if (event.key === "sari2_current_user" || event.key === null) {
        appContext = null;
        initializeApp();
    }
});
