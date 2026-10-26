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

async function refreshProducts(forceRefresh = false) {
    productsLoadError = "";
    document.getElementById("products-warning").textContent = "Loading products...";

    return productLoadGuard.run(async function () {
        try {
            const context = forceRefresh ? await initializeApp(true) : await appReady;
            if (!context) {
                throw new Sari2Api.ApiError("AUTHENTICATION_REQUIRED", "Unable to load products.");
            }
            const selectedCategoryId = productInput("category").value;
            const results = await Promise.all([
                Sari2Api.request("/monitoring"),
                Sari2Api.request("/categories"),
                Sari2Api.request("/catalog-products")
            ]);
            const monitoring = results[0];
            const loadedCategories = results[1];
            const loadedCatalogProducts = results[2];
            if (!monitoring || !Array.isArray(monitoring.products) ||
                !Array.isArray(loadedCategories) ||
                !Array.isArray(loadedCatalogProducts) ||
                !Number.isSafeInteger(monitoring.defaultLowStockThreshold) ||
                !Number.isSafeInteger(monitoring.expirationWarningDays) || !monitoring.counts ||
                !Number.isSafeInteger(monitoring.counts.invalidDate) ||
                monitoring.products.some(function (product) {
                    return !product || typeof product.name !== "string" ||
                        typeof product.categoryId !== "string" || !product.categoryId ||
                        !Number.isSafeInteger(product.effectiveLowStockThreshold) ||
                        !["In Stock", "Low Stock", "Out of Stock"].includes(product.stockStatus) ||
                        !["Safe", "Expiring Soon", "Expired", "No Expiration", "Invalid Date"].includes(product.expirationStatus);
                }) || loadedCategories.some(function (category) {
                    return !category || typeof category.id !== "string" || !category.id ||
                        typeof category.name !== "string" || !category.name.trim();
                }) || loadedCatalogProducts.some(function (catalogProduct) {
                    return !catalogProduct || typeof catalogProduct.id !== "string" || !catalogProduct.id ||
                        typeof catalogProduct.name !== "string" || !catalogProduct.name.trim() ||
                        typeof catalogProduct.imageUrl !== "string";
                })) {
                throw new Sari2Api.ApiError("INVALID_RESPONSE", "The server returned invalid monitoring data.");
            }
            products = monitoring.products;
            categories = loadedCategories.slice().sort(function (first, second) {
                return first.name.localeCompare(second.name, "en", { sensitivity: "base" });
            });
            catalogProducts = loadedCatalogProducts.slice().sort(function (first, second) {
                return first.name.localeCompare(second.name, "en", { sensitivity: "base" });
            });
            if (products.some(function (product) { return !findCategory(product.categoryId); })) {
                throw new Sari2Api.ApiError("INVALID_RESPONSE", "The server returned an invalid product category.");
            }
            if (products.some(function (product) { return !findCatalogProduct(product.catalogProductId); })) {
                throw new Sari2Api.ApiError("INVALID_RESPONSE", "The server returned an invalid shared catalog product.");
            }
            populateCategoryOptions(selectedCategoryId);
            productSettings = {
                defaultLowStockThreshold: monitoring.defaultLowStockThreshold,
                expirationWarningDays: monitoring.expirationWarningDays
            };
            productsLoaded = true;
            productsLoadError = "";
            document.getElementById("products-warning").textContent = monitoring.counts.invalidDate > 0
                ? "Some products have invalid expiration dates and are excluded from expiration monitoring."
                : "";
            return true;
        } catch (error) {
            products = [];
            categories = [];
            catalogProducts = [];
            populateCategoryOptions();
            productSettings = null;
            productsLoaded = false;
            productsLoadError = getApiErrorMessage(error, "Unable to load products.");
            document.getElementById("products-warning").textContent = productsLoadError;
            return false;
        }
    });
}

function matchesProductFilters(product, search, stock, expiration) {
    return product.name.toLowerCase().includes(search.toLowerCase().trim()) &&
        (!stock || product.stockStatus === stock) &&
        (!expiration || product.expirationStatus === expiration);
}

function createProductImage(product) {
    const wrapper = document.createElement("span");
    function showFallback() {
        wrapper.replaceChildren();
        wrapper.className = "product-image-fallback";
        wrapper.textContent = "No image";
    }
    if (!isProductImageUrl(product.imageUrl)) {
        showFallback();
        return wrapper;
    }
    const image = document.createElement("img");
    image.className = "product-image";
    image.alt = product.name;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", showFallback, { once: true });
    image.src = product.imageUrl;
    wrapper.appendChild(image);
    return wrapper;
}

function renderProducts() {
    const body = document.getElementById("products-list");
    body.replaceChildren();
    if (productsLoading || productsLoadError) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 10;
        cell.className = "empty-state";
        cell.textContent = productsLoading ? "Loading products..." : "Products could not be loaded.";
        row.appendChild(cell);
        body.appendChild(row);
        document.getElementById("products-pagination").hidden = true;
        updateInteractionState();
        return;
    }
    const search = document.getElementById("product-search").value;
    const stock = document.getElementById("stock-filter").value;
    const expiration = document.getElementById("expiration-filter").value;
    const displayedProducts = products.map(function (product) { return { product: product }; });
    displayedProducts.sort(function (a, b) { return a.product.name.localeCompare(b.product.name, "en", { sensitivity: "base" }); });
    const matchingProducts = displayedProducts.filter(function (entry) {
        const product = entry.product;
        return matchesProductFilters(product, search, stock, expiration);
    });
    const pageCount = Math.max(1, Math.ceil(matchingProducts.length / productPageSize));
    productPage = Math.max(1, Math.min(productPage, pageCount));
    document.getElementById("products-pagination").hidden = matchingProducts.length <= productPageSize;
    document.getElementById("products-page-info").textContent = "Page " + productPage + " of " + pageCount;
    document.getElementById("products-previous").disabled = productPage === 1;
    document.getElementById("products-next").disabled = productPage === pageCount;
    const start = (productPage - 1) * productPageSize;
    matchingProducts.slice(start, start + productPageSize).forEach(function (entry) {
        const product = entry.product;
        const row = document.createElement("tr");
        const imageCell = document.createElement("td");
        imageCell.appendChild(createProductImage(product));
        row.appendChild(imageCell);
        [product.name, product.category || "N/A",
            typeof product.price === "number" && Number.isFinite(product.price) ? priceFormatter.format(product.price) : "N/A",
            product.quantity, product.effectiveLowStockThreshold,
            formatExpirationDate(product.expirationDate)].forEach(function (value) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });
        [product.stockStatus, product.expirationStatus].forEach(function (status) {
            const cell = document.createElement("td");
            const badge = document.createElement("span");
            badge.className = "status-badge status-" + status.toLowerCase().replaceAll(" ", "-");
            badge.textContent = status;
            cell.appendChild(badge);
            row.appendChild(cell);
        });
        const actions = document.createElement("td");
        const group = document.createElement("div");
        group.className = "product-actions";
        ["Edit", "Delete"].forEach(function (action) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = (action === "Edit" ? "btn-secondary" : "btn-danger") + " product-icon-button";
            button.title = action;
            const icon = document.createElement("img");
            icon.src = "../../assets/icons/" + (action === "Edit" ? "pen-to-square-solid-full.svg" : "trash-can-solid-full.svg");
            icon.alt = "";
            icon.setAttribute("aria-hidden", "true");
            button.appendChild(icon);
            button.setAttribute("aria-label", action + " " + product.name);
            button.addEventListener("click", function () {
                if (action === "Edit") openProductEditor(product.id);
                else deleteProduct(product.id);
            });
            group.appendChild(button);
        });
        actions.appendChild(group);
        row.appendChild(actions);
        body.appendChild(row);
    });
    if (!matchingProducts.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 10;
        cell.className = "empty-state";
        cell.textContent = products.length ? "No matching products found." : "No products found.";
        row.appendChild(cell);
        body.appendChild(row);
    }
    updateInteractionState();
}

function openProductEditor(productId = null) {
    if (!initializeApp() || !productsLoaded || productMutationPending || categoryMutationPending) return;
    const product = productId === null ? null : products.find(function (item) { return item.id === productId; });
    if (productId !== null && !product) {
        productFeedback.textContent = "This product is no longer available. Refresh and try again.";
        return;
    }
    editingId = productId;
    productForm.reset();
    formError.textContent = "";
    productFeedback.textContent = "";
    productFields.forEach(function (field) {
        field.removeAttribute("aria-invalid");
        document.getElementById(field.id + "-error").textContent = "";
    });
    document.getElementById("editor-title").textContent = productId === null ? "Add Product" : "Edit Product";
    productInput("quantity").disabled = productId !== null;
    document.getElementById("quantity-group").hidden = productId !== null;
    if (productId === null) {
        productInput("quantity").value = 0;
        productInput("lowStockThreshold").value = productSettings.defaultLowStockThreshold;
    } else {
        productFields.forEach(function (field) {
            field.value = field.type === "file" ? "" : (product[field.name] ?? "");
        });
        productInput("lowStockThreshold").value = product.effectiveLowStockThreshold;
    }
    populateCategoryOptions(productId === null ? "" : product.categoryId);
    populateCatalogOptions(productId === null ? "" : product.catalogProductId, productId === null);
    syncCatalogFields();
    editor.hidden = false;
    addProductButton.textContent = productId === null ? "Add Product" : "Editing Product";
    updateInteractionState();
    (productInput("name").readOnly ? catalogSelect : productInput("name")).focus();
}

function closeProductEditor() {
    editor.hidden = true;
    productForm.reset();
    productInput("name").readOnly = false;
    productInput("imageUrl").readOnly = false;
    imageStatus.textContent = "";
    editingId = null;
    addProductButton.textContent = "Add Product";
    updateInteractionState();
    addProductButton.focus();
}

productForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (productsLoading || productMutationPending || categoryMutationPending) return;
    formError.textContent = "";
    const values = {};
    productFields.forEach(function (field) {
        values[field.name] = field.type === "file" ? "" : field.value.trim();
    });
    if (values.categoryId === "new") values.categoryId = "";
    const imageFile = imageFileInput.files[0] || null;
    const errors = validateProductValues(values, editingId !== null);
    productFields.forEach(function (field) {
        if (field.validity.badInput && !field.disabled) errors[field.name] = "Enter a valid value.";
        document.getElementById(field.id + "-error").textContent = errors[field.name] || "";
        field.setAttribute("aria-invalid", errors[field.name] ? "true" : "false");
    });
    const firstInvalid = productFields.find(function (field) { return errors[field.name]; });
    if (firstInvalid) { firstInvalid.focus(); return; }
    const selectedCatalog = findCatalogProduct(values.catalogProductId);
    const editingProduct = getEditingProduct();
    const productData = {
        categoryId: values.categoryId, price: Number(values.price),
        lowStockThreshold: Number(values.lowStockThreshold),
        expirationDate: values.expirationDate
    };
    if (selectedCatalog) productData.catalogProductId = selectedCatalog.id;
    if (!selectedCatalog || (editingProduct && editingProduct.catalogProductId === selectedCatalog.id)) {
        productData.name = values.name;
        productData.imageUrl = values.imageUrl;
    }
    if (editingId === null) productData.quantity = Number(values.quantity);

    await productMutationGuard.run(async function () {
        try {
            const savedProduct = await Sari2Api.request(
                editingId === null ? "products" : "products/" + encodeURIComponent(editingId),
                { method: editingId === null ? "POST" : "PUT", body: productData }
            );
            let imageError = null;
            if (imageFile) {
                try {
                    await Sari2Api.request(
                        "catalog-products/" + encodeURIComponent(savedProduct.catalogProductId) + "/image",
                        { method: "PUT", headers: { "Content-Type": imageFile.type }, body: imageFile }
                    );
                } catch (error) {
                    imageError = error;
                }
            }
            closeProductEditor();
            const reloaded = await refreshProducts();
            if (imageError) {
                productFeedback.textContent = "Product saved, but the image upload failed: " +
                    getApiErrorMessage(imageError, "try editing the product and uploading again.");
                return;
            }
            productFeedback.textContent = reloaded
                ? (imageFile ? "Product and shared catalog image saved." : "Product saved.")
                : "Product saved, but the updated monitoring data could not be loaded.";
        } catch (error) {
            if (error instanceof Sari2Api.ApiError && error.details && typeof error.details === "object") {
                Object.keys(error.details).forEach(function (fieldName) {
                    const field = productInput(fieldName);
                    const fieldError = productFieldError(fieldName);
                    if (field && fieldError) {
                        fieldError.textContent = error.details[fieldName];
                        field.setAttribute("aria-invalid", "true");
                    }
                });
            }
            formError.textContent = getApiErrorMessage(error, "Unable to save the product. Try again.");
        }
    });
});

async function deleteProduct(productId) {
    if (productsLoading || productMutationPending || categoryMutationPending) return;
    const product = products.find(function (item) { return item.id === productId; });
    if (!product) {
        productFeedback.textContent = "This product is no longer available. Refresh and try again.";
        return;
    }
    if (!window.confirm('Delete "' + product.name + '"? Stock movement history will be kept.')) return;

    await productMutationGuard.run(async function () {
        try {
            await Sari2Api.request("products/" + encodeURIComponent(productId), { method: "DELETE" });
            if (editingId === productId) closeProductEditor();
            const reloaded = await refreshProducts();
            productFeedback.textContent = reloaded
                ? "Product deleted."
                : "Product deleted, but the updated monitoring data could not be loaded.";
        } catch (error) {
            productFeedback.textContent = getApiErrorMessage(error, "Unable to delete the product. Try again.");
        }
    });
}
