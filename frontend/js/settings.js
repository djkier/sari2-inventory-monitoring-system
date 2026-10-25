const settingsForm = document.getElementById("settings-form");
const settingsFields = Array.from(settingsForm.querySelectorAll("input"));

function loadSettingsForm() {
    if (!initializeApp()) return;
    storageWarnings.length = 0;
    const settings = getSettings();
    settingsFields.forEach(function (field) {
        field.value = settings[field.name];
        field.removeAttribute("aria-invalid");
        document.getElementById(field.id + "-error").textContent = "";
    });
    document.getElementById("store-name").textContent = settings.storeName;
    document.getElementById("settings-error").textContent = storageWarnings.join(" ");
    document.getElementById("settings-feedback").textContent = "";
}

settingsForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!initializeApp()) return;
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
        field.setAttribute("aria-invalid", error ? "true" : "false");
        document.getElementById(field.id + "-error").textContent = error;
        if (error && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) { firstInvalid.focus(); return; }
    if (!saveSettings(settings)) {
        document.getElementById("settings-error").textContent = "Unable to save settings. Check browser storage and try again.";
        return;
    }
    loadSettingsForm();
    document.getElementById("settings-success-dialog").showModal();
});

loadSettingsForm();
window.addEventListener("pageshow", loadSettingsForm);
window.addEventListener("storage", function (event) {
    if (event.key === "sari2_settings" || event.key === null) {
        // Preserve unsaved input; make the external change visible instead of replacing it.
        if (!initializeApp()) return;
        document.getElementById("store-name").textContent = getSettings().storeName;
        document.getElementById("settings-feedback").textContent = "Settings changed in another page. Reload to view them, or save to use the values in this form.";
    }
});
