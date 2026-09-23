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
