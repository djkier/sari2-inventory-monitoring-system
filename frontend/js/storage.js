
const SESSION_KEY = "sari2_current_user";
const SETTINGS_KEY = "sari2_settings";

const DEFAULT_SETTINGS = {
    storeName: "Sari2 Store",
    lowStockThreshold: 10,
    expirationWarningDays: 30
};

function getSession() {
    try {
        const value = localStorage.getItem(SESSION_KEY);
        if (!value) return null;

        const saved = JSON.parse(value);
        if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;

        const session = {
            username: saved.username,
            name: saved.name,
            role: saved.role
        };
        if (Object.values(session).some(function (field) {
            return typeof field !== "string" || !field;
        })) return null;

        const sanitizedValue = JSON.stringify(session);
        if (value !== sanitizedValue) {
            localStorage.setItem(SESSION_KEY, sanitizedValue);
        }
        return session;
    } catch (error) {
        return null;
    }
}

function saveSession(account) {
    try {
        const session = {
            username: account.username,
            name: account.name,
            role: account.role
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return true;
    } catch (error) {
        return false;
    }
}

function clearSession() {
    try {
        localStorage.removeItem(SESSION_KEY);
        return true;
    } catch (error) {
        return false;
    }
}

function getSettings() {
    try {
        const value = localStorage.getItem(SETTINGS_KEY);
        const saved = value ? JSON.parse(value) : {};
        return {
            ...DEFAULT_SETTINGS,
            ...(saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {})
        };
    } catch (error) {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings(settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        return true;
    } catch (error) {
        return false;
    }
}

const storageWarnings = [];
