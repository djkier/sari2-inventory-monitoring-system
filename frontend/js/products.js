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
