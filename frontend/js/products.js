const productForm = document.getElementById("product-form");
const editor = document.getElementById("product-editor");
const productFields = Array.from(productForm.querySelectorAll("input, select"));
const productFeedback = document.getElementById("products-feedback");
const formError = document.getElementById("product-form-error");
const categoryDialog = document.getElementById("category-dialog");
const categoryForm = document.getElementById("category-form");
const categoryName = document.getElementById("category-name");
const categoryError = document.getElementById("category-name-error");
const addProductButton = document.getElementById("add-product");
const priceFormatter = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
let products = [];
let categories = [];
let productSettings;
let editingIndex = null;
let editorSnapshot = "";
let pendingCategories = [];
const productPageSize = 10;
let productPage = 1;

function productInput(name) {
    return document.getElementById("product-" + name);
}

function normalizeCategory(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function getProductCategories() {
    return categories.map(function (category) { return category.name; })
        .concat(pendingCategories)
        .sort(function (left, right) { return left.localeCompare(right, "en", { sensitivity: "base" }); });
}

function openCategoryDialog() {
    if (productInput("category").value !== "new") return;
    categoryForm.reset();
    categoryError.textContent = "";
    categoryName.removeAttribute("aria-invalid");
    categoryDialog.showModal();
    categoryName.focus();
}

function cancelCategoryDialog() {
    productInput("category").value = "";
    categoryDialog.close();
}

function populateCategoryOptions(selectedCategory = "") {
    const select = productInput("category");
    select.replaceChildren();
    const categoryNames = getProductCategories();
    [["", "Select Category"]].concat(categoryNames.map(function (category) {
        return ["category:" + category, category];
    }), [["new", "+ Add New Category"]]).forEach(function (entry) {
        const option = document.createElement("option");
        option.value = entry[0];
        option.textContent = entry[1];
        select.appendChild(option);
    });
    const existing = categoryNames.find(function (category) {
        return category.toLowerCase() === normalizeCategory(selectedCategory).toLowerCase();
    });
    select.value = existing ? "category:" + existing : "";
}

categoryForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const category = normalizeCategory(categoryName.value);
    const duplicate = getProductCategories().some(function (existing) { return existing.toLowerCase() === category.toLowerCase(); });
    categoryError.textContent = !category ? "Enter a category name." :
        duplicate ? "This category already exists. Select it from the Category dropdown." : "";
    categoryName.setAttribute("aria-invalid", categoryError.textContent ? "true" : "false");
    if (categoryError.textContent) { categoryName.focus(); return; }
    pendingCategories.push(category);
    populateCategoryOptions(category);
    productInput("category").removeAttribute("aria-invalid");
    document.getElementById("product-category-error").textContent = "";
    categoryDialog.close();
});
document.getElementById("cancel-category").addEventListener("click", cancelCategoryDialog);
categoryDialog.addEventListener("cancel", function (event) {
    event.preventDefault();
    cancelCategoryDialog();
});
categoryDialog.addEventListener("close", function () { productInput("category").focus(); });

function isProductImageUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch (error) {
        return false;
    }
}

function validateProductValues(values, isEditing) {
    const errors = {};
    ["name", "category"].forEach(function (key) {
        if (!values[key].trim()) errors[key] = "This field is required.";
    });
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
    return errors;
}

async function refreshProducts() {
    if (!initializeApp()) return;
    const warning = document.getElementById("products-warning");
    warning.textContent = "Loading products...";

    try {
        const results = await Promise.all([
            Sari2Api.request("monitoring"),
            Sari2Api.request("categories")
        ]);
        const monitoring = results[0];
        if (!monitoring || !Array.isArray(monitoring.products) ||
            !Number.isSafeInteger(monitoring.defaultLowStockThreshold) ||
            !Number.isSafeInteger(monitoring.expirationWarningDays) || !Array.isArray(results[1])) {
            throw new Sari2Api.ApiError("INVALID_RESPONSE", "The server returned invalid inventory data.");
        }
        products = monitoring.products;
        categories = results[1];
        productSettings = {
            defaultLowStockThreshold: monitoring.defaultLowStockThreshold,
            expirationWarningDays: monitoring.expirationWarningDays
        };
        warning.textContent = "";
    } catch (error) {
        products = [];
        categories = [];
        productSettings = { defaultLowStockThreshold: 0, expirationWarningDays: 0 };
        warning.textContent = error.message || "Unable to load products. Check the server and try again.";
    }

    renderProducts();
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
    const search = document.getElementById("product-search").value;
    const stock = document.getElementById("stock-filter").value;
    const expiration = document.getElementById("expiration-filter").value;
    // Sort the view while keeping original indexes for Edit and Delete.
    const displayedProducts = products.map(function (product, index) { return { product: product, index: index }; });
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
        const index = entry.index;
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
        const snapshot = JSON.stringify(products);
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
                if (action === "Edit") openProductEditor(index);
                else deleteProduct(index, snapshot);
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
}

function openProductEditor(index = null) {
    if (!initializeApp()) return;
    editingIndex = index;
    pendingCategories = [];
    editorSnapshot = JSON.stringify(products);
    productForm.reset();
    formError.textContent = "";
    productFeedback.textContent = "";
    productFields.forEach(function (field) {
        field.removeAttribute("aria-invalid");
        document.getElementById(field.id + "-error").textContent = "";
    });
    document.getElementById("editor-title").textContent = index === null ? "Add Product" : "Edit Product";
    productInput("quantity").disabled = index !== null;
    document.getElementById("quantity-group").hidden = index !== null;
    if (index === null) {
        productInput("quantity").value = 0;
        productInput("lowStockThreshold").value = productSettings.defaultLowStockThreshold;
    } else {
        productFields.forEach(function (field) { field.value = products[index][field.name] ?? ""; });
        productInput("lowStockThreshold").value = products[index].effectiveLowStockThreshold;
    }
    populateCategoryOptions(index === null ? "" : products[index].category);
    editor.hidden = false;
    addProductButton.disabled = true;
    addProductButton.textContent = index === null ? "Add Product" : "Editing Product";
    productInput("name").focus();
}

function closeProductEditor() {
    editor.hidden = true;
    productForm.reset();
    editingIndex = null;
    pendingCategories = [];
    addProductButton.disabled = false;
    addProductButton.textContent = "Add Product";
    addProductButton.focus();
}

// Compare against the displayed version to avoid overwriting another tab's edits.
async function readProductsForChange(snapshot, feedback) {
    if (!initializeApp()) return null;
    let monitoring;
    try {
        monitoring = await Sari2Api.request("monitoring");
    } catch (error) {
        feedback.textContent = error.message || "Unable to verify the latest inventory. Refresh and try again.";
        return null;
    }
    const latest = monitoring && Array.isArray(monitoring.products) ? monitoring.products : null;
    if (!latest) {
        feedback.textContent = "The server returned invalid inventory data. Refresh and try again.";
        return null;
    }
    if (JSON.stringify(latest) !== snapshot) {
        feedback.textContent = "Inventory changed in another session. Cancel and reopen the form, or refresh before trying again.";
        await refreshProducts();
        return null;
    }
    return latest;
}

productForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    formError.textContent = "";
    const values = {};
    productFields.forEach(function (field) { values[field.name] = field.value.trim(); });
    values.category = values.category.startsWith("category:") ? values.category.slice(9) : "";
    const errors = validateProductValues(values, editingIndex !== null);
    productFields.forEach(function (field) {
        if (field.validity.badInput && !field.disabled) errors[field.name] = "Enter a valid value.";
        document.getElementById(field.id + "-error").textContent = errors[field.name] || "";
        field.setAttribute("aria-invalid", errors[field.name] ? "true" : "false");
    });
    const firstInvalid = productFields.find(function (field) { return errors[field.name]; });
    if (firstInvalid) { firstInvalid.focus(); return; }
    const latest = await readProductsForChange(editorSnapshot, formError);
    if (!latest) return;
    let category = categories.find(function (item) {
        return item.name.toLowerCase() === values.category.toLowerCase();
    });
    try {
        if (!category) {
            category = await Sari2Api.request("categories", {
                method: "POST",
                body: { name: values.category }
            });
            categories.push(category);
            pendingCategories = pendingCategories.filter(function (name) {
                return name.toLowerCase() !== category.name.toLowerCase();
            });
        }

        const product = {
            name: values.name,
            categoryId: category.id,
            price: Number(values.price),
            ...(editingIndex === null ? { quantity: Number(values.quantity) } : {}),
            lowStockThreshold: Number(values.lowStockThreshold),
            expirationDate: values.expirationDate,
            imageUrl: values.imageUrl
        };
        const existing = editingIndex === null ? null : latest[editingIndex];
        await Sari2Api.request(
            existing ? "products/" + encodeURIComponent(existing.id) : "products",
            { method: existing ? "PUT" : "POST", body: product }
        );
        closeProductEditor();
        await refreshProducts();
        productFeedback.textContent = "Product saved.";
    } catch (error) {
        formError.textContent = error.message || "Unable to save the product. Try again.";
    }
});

async function deleteProduct(index, snapshot) {
    const latest = await readProductsForChange(snapshot, productFeedback);
    if (!latest || !window.confirm('Delete "' + latest[index].name + '"? Stock movement history will be kept.')) return;
    try {
        await Sari2Api.request("products/" + encodeURIComponent(latest[index].id), { method: "DELETE" });
        closeProductEditor();
        await refreshProducts();
        productFeedback.textContent = "Product deleted.";
    } catch (error) {
        productFeedback.textContent = error.message || "Unable to delete the product. Try again.";
        return;
    }
}

document.getElementById("add-product").addEventListener("click", function () { openProductEditor(); });
productInput("category").addEventListener("change", openCategoryDialog);
document.getElementById("cancel-product").addEventListener("click", closeProductEditor);
document.getElementById("product-search").addEventListener("input", function () {
    productPage = 1;
    renderProducts();
});
["stock-filter", "expiration-filter"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", function () {
        productPage = 1;
        renderProducts();
    });
});
document.getElementById("products-previous").addEventListener("click", function () {
    productPage -= 1;
    renderProducts();
});
document.getElementById("products-next").addEventListener("click", function () {
    productPage += 1;
    renderProducts();
});
// Initialize the existing controls once; later manual changes and refreshes keep their values.
function initializeProductFiltersFromUrl() {
    const parameters = new URLSearchParams(window.location.search);
    [["stockStatus", "stock-filter"], ["expirationStatus", "expiration-filter"]].forEach(function (entry) {
        const filter = document.getElementById(entry[1]);
        const requested = parameters.get(entry[0]);
        const option = Array.from(filter.options).find(function (item) {
            return item.value && item.value.toLowerCase().replaceAll(" ", "-") === requested;
        });
        if (option) filter.value = option.value;
    });
}

initializeProductFiltersFromUrl();
refreshProducts();
window.addEventListener("pageshow", function (event) {
    if (event.persisted) refreshProducts();
});
window.addEventListener("focus", refreshProducts);
window.addEventListener("storage", function (event) {
    if (event.key === "sari2_settings" || event.key === null) refreshProducts();
});
