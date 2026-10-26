// Shared authenticated shell. Load after api.js and auth.js.
let currentAppSettings = null;
let appSettingsRequest = null;

function getAppSettings(forceRefresh = false) {
    if (currentAppSettings && !forceRefresh) return Promise.resolve(currentAppSettings);
    if (appSettingsRequest) return appSettingsRequest;

    appSettingsRequest = Sari2Api.request("/settings")
        .then(function (settings) {
            currentAppSettings = settings;
            return settings;
        })
        .finally(function () {
            appSettingsRequest = null;
        });
    return appSettingsRequest;
}

function renderAppContext(identity, settings) {
    const settingsAccountName = identity.user.role === "Store Owner" ? settings.ownerName : settings.staffName;
    document.getElementById("current-user-name").textContent = settingsAccountName || identity.user.name;
    document.getElementById("current-user-role").textContent = identity.user.role;
    const storeName = settings.storeName || identity.store.name;
    const storeCode = identity.user.role === "Store Owner" && /^\d{6}$/.test(settings.storeCode || "")
        ? " (Store Code: " + settings.storeCode + ")"
        : "";
    document.getElementById("store-name").textContent = storeName + storeCode;
}

function applyConfirmedAppSettings(identity, settings) {
    currentAppSettings = settings;
    renderAppContext(identity, settings);
}

function initializeApp(forceRefresh = false) {
    const shell = document.getElementById("app-shell");
    const feedback = document.getElementById("app-feedback");
    shell.hidden = true;
    shell.setAttribute("aria-busy", "true");
    feedback.textContent = "";

    return requireSession(forceRefresh)
        .then(async function (identity) {
            if (!identity) return null;
            const settings = await getAppSettings(forceRefresh);
            renderAppContext(identity, settings);
            shell.hidden = false;
            return { identity: identity, settings: settings };
        })
        .catch(function (error) {
            feedback.textContent = error.message || "Unable to verify your login. Check the server and try again.";
            shell.hidden = false;
            return null;
        })
        .finally(function () {
            shell.removeAttribute("aria-busy");
        });
}

const logoutButton = document.getElementById("logout-button");
let logoutPending = false;
logoutButton.addEventListener("click", async function () {
    if (logoutPending) return;
    logoutPending = true;
    logoutButton.disabled = true;
    document.getElementById("app-feedback").textContent = "";
    try {
        await logout();
        currentAppSettings = null;
        document.getElementById("app-shell").hidden = true;
    } catch (error) {
        document.getElementById("app-feedback").textContent =
            error.message || "Unable to log out. Check the server and try again.";
        logoutButton.disabled = false;
        logoutPending = false;
    }
});

const appReady = initializeApp(true);

// Revalidate bfcache restores and tabs revisited after logout elsewhere.
window.addEventListener("pageshow", function (event) {
    if (event.persisted) initializeApp(true);
});
window.addEventListener("focus", function () {
    initializeApp(true);
});
