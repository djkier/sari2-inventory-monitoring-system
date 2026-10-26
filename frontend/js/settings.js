const settingsForm = document.getElementById("settings-form");
const settingsFields = Array.from(settingsForm.querySelectorAll("input"));
const settingsFieldsets = Array.from(settingsForm.querySelectorAll("fieldset"));
const settingsSubmit = settingsForm.querySelector('button[type="submit"]');
let settingsContext = null;

function setSettingsPending(isPending, label) {
    settingsFieldsets.forEach(function (fieldset) { fieldset.disabled = isPending; });
    settingsSubmit.disabled = isPending;
    settingsSubmit.textContent = isPending ? label : "Save Settings";
    settingsForm.setAttribute("aria-busy", isPending ? "true" : "false");
}

function setFieldError(field, message) {
    field.setAttribute("aria-invalid", message ? "true" : "false");
    document.getElementById(field.id + "-error").textContent = message;
}

function renderSettingsForm(settings) {
    settingsFields.forEach(function (field) {
        field.value = settings[field.name];
        setFieldError(field, "");
    });
}

async function loadSettingsForm(forceRefresh = false) {
    if (settingsSaveRequest.isPending) return;
    setSettingsPending(true, "Loading...");
    document.getElementById("settings-error").textContent = "";
    document.getElementById("settings-feedback").textContent = "";
    try {
        settingsContext = forceRefresh ? await initializeApp(true) : await appReady;
        if (!settingsContext) {
            document.getElementById("settings-error").textContent =
                "Unable to load settings. Check the server and try again.";
            return;
        }
        renderSettingsForm(settingsContext.settings);
    } catch (error) {
        document.getElementById("settings-error").textContent =
            error.message || "Unable to load settings. Check the server and try again.";
    } finally {
        setSettingsPending(false, "");
    }
}

function applyServerFieldErrors(details) {
    if (!details || typeof details !== "object") return null;
    let firstInvalid = null;
    settingsFields.forEach(function (field) {
        const message = typeof details[field.name] === "string" ? details[field.name] : "";
        if (!message) return;
        setFieldError(field, message);
        if (!firstInvalid) firstInvalid = field;
    });
    return firstInvalid;
}

const settingsSaveRequest = Sari2Api.createRequestGuard(function (isPending) {
    setSettingsPending(isPending, "Saving...");
});

settingsForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (settingsSaveRequest.isPending || !settingsContext) return;
    const settings = {};
    let firstInvalid = null;
    document.getElementById("settings-error").textContent = "";
    document.getElementById("settings-feedback").textContent = "";
    settingsFields.forEach(function (field) {
        const value = field.value.trim();
        let error = "";
        if (field.type === "number") {
            const number = Number(value);
            if (!value || field.validity.badInput || !Number.isSafeInteger(number) || number < 0) {
                error = "Enter a whole number of zero or more.";
            }
            settings[field.name] = number;
        } else {
            if (field.required && !value) error = "Enter a store name.";
            settings[field.name] = value;
        }
        setFieldError(field, error);
        if (error && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) { firstInvalid.focus(); return; }

    try {
        const savedSettings = await settingsSaveRequest.run(function () {
            return Sari2Api.request("/settings", { method: "PUT", body: settings });
        });
        renderSettingsForm(savedSettings);
        settingsContext = { identity: settingsContext.identity, settings: savedSettings };
        applyConfirmedAppSettings(settingsContext.identity, savedSettings);
        document.getElementById("settings-success-dialog").showModal();
    } catch (error) {
        const firstServerField = applyServerFieldErrors(error.details);
        document.getElementById("settings-error").textContent =
            error.message || "Unable to save settings. Check the server and try again.";
        if (firstServerField) firstServerField.focus();
    }
});

loadSettingsForm();
window.addEventListener("pageshow", function (event) {
    if (event.persisted) loadSettingsForm(true);
});
