const productForm = document.getElementById("product-form");
const editor = document.getElementById("product-editor");
const productFields = Array.from(productForm.querySelectorAll("input, select"));
const productFeedback = document.getElementById("products-feedback");
const formError = document.getElementById("product-form-error");
const categoryDialog = document.getElementById("category-dialog");
const categoryForm = document.getElementById("category-form");
const categoryRecord = document.getElementById("category-record");
const categoryName = document.getElementById("category-name");
const categoryError = document.getElementById("category-name-error");
const deleteCategoryButton = document.getElementById("delete-category");
const saveCategoryButton = document.getElementById("save-category");
const manageCategoriesButton = document.getElementById("manage-categories");
const addProductButton = document.getElementById("add-product");
const catalogSelect = document.getElementById("product-catalogProductId");
const imageFileInput = document.getElementById("product-imageFile");
const imageStatus = document.getElementById("product-image-status");
const priceFormatter = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const supportedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const maxImageBytes = 5 * 1024 * 1024;
let products = [];
let categories = [];
let catalogProducts = [];
let productSettings;
let editingId = null;
let productsLoaded = false;
let productsLoading = false;
let productsLoadError = "";
let productMutationPending = false;
let categoryMutationPending = false;
const productPageSize = 10;
let productPage = 1;
const productLoadGuard = Sari2Api.createRequestGuard(function (pending) {
    productsLoading = pending;
    renderProducts();
});
const productMutationGuard = Sari2Api.createRequestGuard(function (pending) {
    productMutationPending = pending;
    updateInteractionState();
});
const categoryMutationGuard = Sari2Api.createRequestGuard(function (pending) {
    categoryMutationPending = pending;
    updateInteractionState();
});

function productInput(name) {
    if (name === "categoryId") return document.getElementById("product-category");
    return document.getElementById("product-" + name);
}

function productFieldError(name) {
    if (name === "categoryId") return document.getElementById("product-category-error");
    return document.getElementById("product-" + name + "-error");
}

function normalizeCategory(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function findCategory(categoryId) {
    return categories.find(function (category) { return category.id === categoryId; }) || null;
}

function findCatalogProduct(catalogProductId) {
    return catalogProducts.find(function (catalogProduct) {
        return catalogProduct.id === catalogProductId;
    }) || null;
}

function getEditingProduct() {
    return editingId === null ? null : products.find(function (product) { return product.id === editingId; }) || null;
}

function populateCatalogOptions(selectedCatalogId = "", allowNewCatalog = true) {
    catalogSelect.replaceChildren();
    if (allowNewCatalog) {
        const createOption = document.createElement("option");
        createOption.value = "";
        createOption.textContent = "Create a new catalog product";
        catalogSelect.appendChild(createOption);
    }
    catalogProducts.forEach(function (catalogProduct) {
        const option = document.createElement("option");
        option.value = catalogProduct.id;
        option.textContent = catalogProduct.name;
        catalogSelect.appendChild(option);
    });
    if (findCatalogProduct(selectedCatalogId)) catalogSelect.value = selectedCatalogId;
    else if (!allowNewCatalog && catalogSelect.options.length) catalogSelect.selectedIndex = 0;
}

function syncCatalogFields() {
    const selectedCatalog = findCatalogProduct(catalogSelect.value);
    const editingProduct = getEditingProduct();
    const editsCurrentCatalog = Boolean(editingProduct && selectedCatalog &&
        editingProduct.catalogProductId === selectedCatalog.id);
    const fieldsAreSharedReadOnly = Boolean(selectedCatalog && !editsCurrentCatalog);
    const imageIsManaged = Boolean(selectedCatalog && selectedCatalog.imageFileName);

    if (selectedCatalog) {
        productInput("name").value = selectedCatalog.name;
        productInput("imageUrl").value = selectedCatalog.imageUrl || "";
    } else if (!editingProduct) {
        productInput("name").readOnly = false;
        productInput("imageUrl").readOnly = false;
    }
    productInput("name").readOnly = fieldsAreSharedReadOnly;
    productInput("imageUrl").readOnly = fieldsAreSharedReadOnly || imageIsManaged;
    const pendingImage = imageFileInput.files[0];
    imageStatus.textContent = pendingImage ? "Selected for upload: " + pendingImage.name :
        (selectedCatalog && selectedCatalog.imageUrl
            ? (imageIsManaged ? "A backend-hosted image is currently saved for this catalog product." :
                "An image URL is currently saved for this catalog product.")
            : "No catalog image is currently saved.");
}

function populateCategoryOptions(selectedCategoryId = "") {
    const select = productInput("category");
    select.replaceChildren();
    [["", "Select Category"]].concat(categories.map(function (category) {
        return [category.id, category.name];
    }), [["new", "+ Add New Category"]]).forEach(function (entry) {
        const option = document.createElement("option");
        option.value = entry[0];
        option.textContent = entry[1];
        select.appendChild(option);
    });
    select.value = findCategory(selectedCategoryId) ? selectedCategoryId : "";
}

function populateCategoryManager(selectedCategoryId = "") {
    categoryRecord.replaceChildren();
    const createOption = document.createElement("option");
    createOption.value = "";
    createOption.textContent = "+ Add New Category";
    categoryRecord.appendChild(createOption);
    categories.forEach(function (category) {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.name;
        categoryRecord.appendChild(option);
    });
    categoryRecord.value = findCategory(selectedCategoryId) ? selectedCategoryId : "";
    const selected = findCategory(categoryRecord.value);
    categoryName.value = selected ? selected.name : "";
    document.getElementById("category-dialog-title").textContent = selected ? "Edit Category" : "Add New Category";
    saveCategoryButton.textContent = selected ? "Save Category" : "Add Category";
    deleteCategoryButton.hidden = !selected;
}

function openCategoryDialog(selectedCategoryId = "") {
    if (!productsLoaded || productsLoading || productMutationPending || categoryMutationPending) return;
    categoryError.textContent = "";
    categoryName.removeAttribute("aria-invalid");
    populateCategoryManager(selectedCategoryId);
    categoryDialog.showModal();
    categoryName.focus();
}

function cancelCategoryDialog() {
    if (productInput("category").value === "new") productInput("category").value = "";
    categoryDialog.close();
}

categoryForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (productsLoading || productMutationPending || categoryMutationPending) return;
    const name = normalizeCategory(categoryName.value);
    const selectedId = categoryRecord.value;
    const duplicate = categories.some(function (category) {
        return category.id !== selectedId && category.name.toLowerCase() === name.toLowerCase();
    });
    categoryError.textContent = !name ? "Enter a category name." :
        duplicate ? "This category already exists. Select it from the Category dropdown." : "";
    categoryName.setAttribute("aria-invalid", categoryError.textContent ? "true" : "false");
    if (categoryError.textContent) { categoryName.focus(); return; }

    await categoryMutationGuard.run(async function () {
        try {
            const saved = await Sari2Api.request(
                selectedId ? "categories/" + encodeURIComponent(selectedId) : "categories",
                { method: selectedId ? "PUT" : "POST", body: { name: name } }
            );
            const reloaded = await refreshProducts();
            if (reloaded && findCategory(saved.id)) productInput("category").value = saved.id;
            productInput("category").removeAttribute("aria-invalid");
            document.getElementById("product-category-error").textContent = "";
            categoryDialog.close();
            productFeedback.textContent = reloaded
                ? (selectedId ? "Category updated." : "Category added.")
                : "Category saved, but the updated category list could not be loaded.";
        } catch (error) {
            categoryError.textContent = getApiErrorMessage(error, "Unable to save the category. Try again.");
            categoryName.setAttribute("aria-invalid", "true");
        }
    });
});
categoryRecord.addEventListener("change", function () {
    populateCategoryManager(categoryRecord.value);
    categoryError.textContent = "";
    categoryName.removeAttribute("aria-invalid");
    categoryName.focus();
});
deleteCategoryButton.addEventListener("click", async function () {
    if (productsLoading || productMutationPending || categoryMutationPending) return;
    const category = findCategory(categoryRecord.value);
    if (!category || !window.confirm('Delete category "' + category.name + '"?')) return;

    await categoryMutationGuard.run(async function () {
        try {
            await Sari2Api.request("categories/" + encodeURIComponent(category.id), { method: "DELETE" });
            const reloaded = await refreshProducts();
            if (productInput("category").value === category.id) productInput("category").value = "";
            categoryDialog.close();
            productFeedback.textContent = reloaded
                ? "Category deleted."
                : "Category deleted, but the updated category list could not be loaded.";
        } catch (error) {
            categoryError.textContent = getApiErrorMessage(error, "Unable to delete the category. Try again.");
        }
    });
});
document.getElementById("cancel-category").addEventListener("click", cancelCategoryDialog);
categoryDialog.addEventListener("cancel", function (event) {
    event.preventDefault();
    cancelCategoryDialog();
});
categoryDialog.addEventListener("close", function () { productInput("category").focus(); });

function isProductImageUrl(value) {
    try {
        if (typeof value !== "string" || !value.trim()) return false;
        const url = new URL(value, window.location.origin);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch (error) {
        return false;
    }
}

function validateProductValues(values, isEditing) {
    const errors = {};
    if (!values.name.trim() && !findCatalogProduct(values.catalogProductId)) {
        errors.name = "This field is required when creating a new catalog product.";
    }
    if (!values.categoryId.trim()) errors.categoryId = "This field is required.";
    ["price", "lowStockThreshold"].concat(isEditing ? [] : ["quantity"]).forEach(function (key) {
        const number = Number(values[key]);
        if (!values[key].trim() || !Number.isFinite(number) || number < 0) {
            errors[key] = "Enter a valid number of zero or more.";
        } else if (key !== "price" && !Number.isSafeInteger(number)) {
            errors[key] = "Enter a whole number of zero or more.";
        }
    });
    if (values.expirationDate && !parseCalendarDate(values.expirationDate)) {
        errors.expirationDate = "Enter a valid expiration date.";
    }
    const imageFile = imageFileInput.files[0];
    if (imageFile && !supportedImageTypes.includes(imageFile.type)) {
        errors.imageFile = "Choose a JPEG, PNG, WebP, or GIF image.";
    } else if (imageFile && imageFile.size > maxImageBytes) {
        errors.imageFile = "Choose an image that is 5 MB or smaller.";
    }
    return errors;
}

function getApiErrorMessage(error, fallback) {
    return error instanceof Sari2Api.ApiError ? error.message : fallback;
}

function updateInteractionState() {
    const mutationPending = productMutationPending || categoryMutationPending;
    addProductButton.disabled = productsLoading || mutationPending || !productsLoaded || !editor.hidden;
    productForm.querySelectorAll("button").forEach(function (button) {
        button.disabled = mutationPending || productsLoading;
    });
    document.querySelectorAll("#products-list button").forEach(function (button) {
        button.disabled = mutationPending || productsLoading;
    });
    categoryForm.querySelectorAll("input, select, button").forEach(function (field) {
        field.disabled = mutationPending || productsLoading;
    });
    productForm.setAttribute("aria-busy", mutationPending ? "true" : "false");
    categoryForm.setAttribute("aria-busy", categoryMutationPending ? "true" : "false");
}
