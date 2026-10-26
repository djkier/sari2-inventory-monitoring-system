const settingsForm = document.getElementById("settings-form");
const settingsFields = Array.from(settingsForm.querySelectorAll("input"));
const settingsSubmit = settingsForm.querySelector("button[type='submit']");
let settingsLoadRequest = null;

function showStoreName(name) {
    const storeName = document.getElementById("store-name");
    if (storeName) storeName.textContent = name;
}

function loadSettingsForm() {
    if (!initializeApp()) return Promise.resolve();
    if (settingsLoadRequest) return settingsLoadRequest;

    document.getElementById("settings-feedback").textContent = "";
    settingsLoadRequest = Sari2Api.request("settings").then(function (settings) {
        settingsFields.forEach(function (field) {
            field.value = settings[field.name] ?? "";
            field.removeAttribute("aria-invalid");
            document.getElementById(field.id + "-error").textContent = "";
        });
        showStoreName(settings.storeName);
        document.getElementById("settings-error").textContent = "";
    }).catch(function (error) {
        document.getElementById("settings-error").textContent =
            error.message || "Unable to load store settings.";
    }).finally(function () {
        settingsLoadRequest = null;
    });

    return settingsLoadRequest;
}

settingsForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!initializeApp() || settingsSubmit.disabled) return;

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

    settingsSubmit.disabled = true;
    try {
        const saved = await Sari2Api.request("settings", {
            method: "PUT",
            body: settings
        });
        settingsFields.forEach(function (field) {
            field.value = saved[field.name] ?? "";
        });
        showStoreName(saved.storeName);
        document.getElementById("settings-success-dialog").showModal();
    } catch (error) {
        document.getElementById("settings-error").textContent =
            error.message || "Unable to save store settings.";
    } finally {
        settingsSubmit.disabled = false;
    }
});

loadSettingsForm();
window.addEventListener("pageshow", loadSettingsForm);
