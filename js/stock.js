const stockForm = document.getElementById("stock-form");
const stockProduct = document.getElementById("stock-product");
const stockType = document.getElementById("stock-type");
const stockQuantity = document.getElementById("stock-quantity");
const stockError = document.getElementById("stock-error");
const stockFeedback = document.getElementById("stock-feedback");


function refreshStock() {
    if (!initializeApp()) return;
    storageWarnings.length = 0;
    const products = getProducts();
    const movements = getStockMovements();
    const snapshot = JSON.stringify(products);
    const selected = snapshot === stockSnapshot ? stockProduct.value : "";
    stockProducts = products;
    stockSnapshot = snapshot;
    stockProduct.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a product";
    stockProduct.appendChild(placeholder);
    products.forEach(function (product, index) {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = product.name + " — " + product.quantity + " in stock";
        stockProduct.appendChild(option);
    });
    stockProduct.value = selected;
    document.getElementById("stock-fields").disabled = !products.length || storageWarnings.length > 0;
    document.getElementById("stock-empty").hidden = products.length !== 0;
    document.getElementById("store-name").textContent = getSettings().storeName;
    document.getElementById("stock-warning").textContent = storageWarnings.join(" ");
    showAvailableStock();
    renderStockHistory(movements);
}
