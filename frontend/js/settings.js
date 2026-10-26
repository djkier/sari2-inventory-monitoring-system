const settingsForm = document.getElementById("settings-form");
const settingsFields = Array.from(settingsForm.querySelectorAll("input"));
const settingsFieldsets = Array.from(settingsForm.querySelectorAll("fieldset"));
const settingsSubmit = settingsForm.querySelector('button[type="submit"]');
const storeNameInput = document.getElementById("settings-store");
const ownerNameInput = document.getElementById("settings-owner");
const staffNameGroup = document.getElementById("settings-staff-group");
const staffNameInput = document.getElementById("settings-staff");
const thresholdInput = document.getElementById("settings-threshold");
const warningInput = document.getElementById("settings-warning");
const successMessage = document.getElementById("settings-success-message");
const categorySection = document.getElementById("category-settings");
const categoryList = document.getElementById("category-list");
const categoryFeedback = document.getElementById("category-feedback");
const addCategoryButton = document.getElementById("add-category");
const categoryDialog = document.getElementById("category-dialog");
const categoryForm = document.getElementById("category-form");
const categoryNameInput = document.getElementById("category-name");
const categoryNameError = document.getElementById("category-name-error");
const saveCategoryButton = document.getElementById("save-category");
let settingsContext = null;
let categories = [];
let categoriesLoaded = false;
let categoryRequestPending = false;
let editingCategoryId = null;
let categoryReturnFocus = null;

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
        field.value = settings[field.name] === undefined ? "" : settings[field.name];
        setFieldError(field, "");
    });
}

function applyRolePermissions(identity) {
    const isOwner = identity.user.role === "Store Owner";
    storeNameInput.readOnly = !isOwner;
    ownerNameInput.readOnly = !isOwner;
    thresholdInput.readOnly = !isOwner;
    warningInput.readOnly = !isOwner;
    staffNameGroup.hidden = isOwner;
    staffNameInput.disabled = isOwner;
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
        applyRolePermissions(settingsContext.identity);
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

const categoryRequest = Sari2Api.createRequestGuard(function (isPending) {
    categoryRequestPending = isPending;
    categorySection.setAttribute("aria-busy", isPending ? "true" : "false");
    addCategoryButton.disabled = isPending || !categoriesLoaded;
    categoryForm.querySelectorAll("input, button").forEach(function (control) {
        control.disabled = isPending;
    });
    renderCategoryList();
});

settingsForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (settingsSaveRequest.isPending || !settingsContext) return;
    const settings = {};
    let firstInvalid = null;
    document.getElementById("settings-error").textContent = "";
    document.getElementById("settings-feedback").textContent = "";
    settingsFields.forEach(function (field) { setFieldError(field, ""); });
    const isOwner = settingsContext.identity.user.role === "Store Owner";
    const editableFields = isOwner
        ? [storeNameInput, ownerNameInput, thresholdInput, warningInput]
        : [staffNameInput];
    editableFields.forEach(function (field) {
        const value = field.value.trim();
        let error = "";
        if (field.type === "number") {
            const number = Number(value);
            if (!value || field.validity.badInput || !Number.isSafeInteger(number) || number < 0) {
                error = "Enter a whole number of zero or more.";
            }
            settings[field.name] = number;
        } else {
            if (!value) {
                error = field === storeNameInput ? "Enter a store name." : "Enter an account name.";
            }
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
        const accountName = isOwner ? savedSettings.ownerName : savedSettings.staffName;
        const updatedIdentity = {
            ...settingsContext.identity,
            user: { ...settingsContext.identity.user, name: accountName },
            store: {
                ...settingsContext.identity.store,
                name: isOwner ? savedSettings.storeName : settingsContext.identity.store.name
            }
        };
        settingsContext = { identity: updatedIdentity, settings: savedSettings };
        applyConfirmedAppSettings(settingsContext.identity, savedSettings);
        successMessage.textContent = isOwner
            ? "Your store information and inventory preferences have been saved successfully."
            : "Your account name has been saved successfully.";
        document.getElementById("settings-success-dialog").showModal();
    } catch (error) {
        const firstServerField = applyServerFieldErrors(error.details);
        document.getElementById("settings-error").textContent =
            error.message || "Unable to save settings. Check the server and try again.";
        if (firstServerField) firstServerField.focus();
    }
});

function normalizeCategoryName(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function sortCategories() {
    categories.sort(function (first, second) {
        return first.name.localeCompare(second.name, "en", { sensitivity: "base" });
    });
}

function findCategory(categoryId) {
    return categories.find(function (category) { return category.id === categoryId; }) || null;
}

function setCategoryFeedback(message, isError) {
    categoryFeedback.textContent = message;
    categoryFeedback.classList.toggle("field-error", Boolean(isError));
}

function renderCategoryList() {
    categoryList.replaceChildren();
    if (!categoriesLoaded) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 2;
        cell.textContent = categoryRequestPending ? "Loading categories..." : "Categories are unavailable.";
        row.appendChild(cell);
        categoryList.appendChild(row);
        return;
    }
    if (!categories.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 2;
        cell.textContent = "No categories have been added yet.";
        row.appendChild(cell);
        categoryList.appendChild(row);
        return;
    }

    categories.forEach(function (category) {
        const row = document.createElement("tr");
        const nameCell = document.createElement("td");
        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");
        const editButton = document.createElement("button");
        const deleteButton = document.createElement("button");

        nameCell.textContent = category.name;
        actions.className = "category-settings-actions";
        editButton.type = "button";
        editButton.className = "btn-secondary";
        editButton.dataset.action = "edit";
        editButton.dataset.categoryId = category.id;
        editButton.textContent = "Edit";
        editButton.disabled = categoryRequestPending;
        deleteButton.type = "button";
        deleteButton.className = "btn-danger";
        deleteButton.dataset.action = "delete";
        deleteButton.dataset.categoryId = category.id;
        deleteButton.textContent = "Delete";
        deleteButton.disabled = categoryRequestPending;

        actions.append(editButton, deleteButton);
        actionsCell.appendChild(actions);
        row.append(nameCell, actionsCell);
        categoryList.appendChild(row);
    });
}

async function loadCategories() {
    if (categoryRequest.isPending) return;
    categoriesLoaded = false;
    setCategoryFeedback("", false);
    renderCategoryList();
    await categoryRequest.run(async function () {
        try {
            const context = await appReady;
            if (!context) throw new Sari2Api.ApiError("AUTHENTICATION_REQUIRED", "Unable to load categories.");
            const loadedCategories = await Sari2Api.request("/categories");
            if (!Array.isArray(loadedCategories) || loadedCategories.some(function (category) {
                return !category || typeof category.id !== "string" || !category.id ||
                    typeof category.name !== "string" || !category.name.trim();
            })) {
                throw new Sari2Api.ApiError("INVALID_RESPONSE", "The server returned invalid category data.");
            }
            categories = loadedCategories.slice();
            sortCategories();
            categoriesLoaded = true;
        } catch (error) {
            categories = [];
            categoriesLoaded = false;
            setCategoryFeedback(error && error.message ? error.message : "Unable to load categories. Try again.", true);
        }
    });
}

function openCategoryDialog(categoryId, trigger) {
    if (!categoriesLoaded || categoryRequestPending) return;
    const category = categoryId ? findCategory(categoryId) : null;
    if (categoryId && !category) {
        setCategoryFeedback("This category is no longer available. Reload Settings and try again.", true);
        return;
    }
    editingCategoryId = category ? category.id : null;
    categoryReturnFocus = trigger || addCategoryButton;
    document.getElementById("category-dialog-title").textContent = category ? "Edit Category" : "Add Category";
    saveCategoryButton.textContent = category ? "Save Category" : "Add Category";
    categoryNameInput.value = category ? category.name : "";
    categoryNameError.textContent = "";
    categoryNameInput.removeAttribute("aria-invalid");
    categoryDialog.showModal();
    categoryNameInput.focus();
}

categoryForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (categoryRequestPending || !categoriesLoaded) return;
    const name = normalizeCategoryName(categoryNameInput.value);
    const duplicate = categories.some(function (category) {
        return category.id !== editingCategoryId &&
            category.name.toLocaleLowerCase("en") === name.toLocaleLowerCase("en");
    });
    categoryNameError.textContent = !name ? "Enter a category name." :
        duplicate ? "A category with this name already exists." : "";
    categoryNameInput.setAttribute("aria-invalid", categoryNameError.textContent ? "true" : "false");
    if (categoryNameError.textContent) {
        categoryNameInput.focus();
        return;
    }

    await categoryRequest.run(async function () {
        try {
            const saved = await Sari2Api.request(
                editingCategoryId ? "/categories/" + encodeURIComponent(editingCategoryId) : "/categories",
                { method: editingCategoryId ? "PUT" : "POST", body: { name: name } }
            );
            if (editingCategoryId) {
                categories = categories.map(function (category) {
                    return category.id === saved.id ? saved : category;
                });
            } else {
                categories.push(saved);
            }
            sortCategories();
            categoryReturnFocus = addCategoryButton;
            categoryDialog.close();
            setCategoryFeedback(editingCategoryId ? "Category updated." : "Category added.", false);
            editingCategoryId = null;
        } catch (error) {
            const serverMessage = error && error.details && typeof error.details.name === "string"
                ? error.details.name
                : (error && error.message ? error.message : "Unable to save the category. Try again.");
            categoryNameError.textContent = serverMessage;
            categoryNameInput.setAttribute("aria-invalid", "true");
        }
    });
});

async function deleteCategory(category, trigger) {
    if (!category || categoryRequestPending ||
        !window.confirm('Delete category "' + category.name + '"?')) return;
    await categoryRequest.run(async function () {
        try {
            await Sari2Api.request("/categories/" + encodeURIComponent(category.id), { method: "DELETE" });
            categories = categories.filter(function (item) { return item.id !== category.id; });
            setCategoryFeedback("Category deleted.", false);
            addCategoryButton.focus();
        } catch (error) {
            setCategoryFeedback(error && error.message ? error.message : "Unable to delete the category. Try again.", true);
            if (trigger && trigger.isConnected) trigger.focus();
        }
    });
}

addCategoryButton.addEventListener("click", function () {
    openCategoryDialog(null, addCategoryButton);
});
categoryList.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const category = findCategory(button.dataset.categoryId);
    if (button.dataset.action === "edit") openCategoryDialog(button.dataset.categoryId, button);
    else if (button.dataset.action === "delete") deleteCategory(category, button);
});
document.getElementById("cancel-category").addEventListener("click", function () {
    categoryDialog.close();
});
categoryNameInput.addEventListener("input", function () {
    categoryNameError.textContent = "";
    categoryNameInput.removeAttribute("aria-invalid");
});
categoryDialog.addEventListener("cancel", function (event) {
    if (categoryRequestPending) event.preventDefault();
});
categoryDialog.addEventListener("close", function () {
    if (categoryReturnFocus && categoryReturnFocus.isConnected) categoryReturnFocus.focus();
    else addCategoryButton.focus();
    categoryReturnFocus = null;
});

loadSettingsForm();
loadCategories();
window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
        loadSettingsForm(true);
        loadCategories();
    }
});
