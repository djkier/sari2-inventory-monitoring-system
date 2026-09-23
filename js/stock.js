const stockForm = document.getElementById("stock-form");
const stockProduct = document.getElementById("stock-product");
const stockType = document.getElementById("stock-type");
const stockQuantity = document.getElementById("stock-quantity");
const stockError = document.getElementById("stock-error");
const stockFeedback = document.getElementById("stock-feedback");
let stockProducts = [];
let stockSnapshot = "";
const historyPageSize = 10;
let historyPage = 1;

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

function showAvailableStock() {
    const product = stockProduct.value === "" ? null : stockProducts[Number(stockProduct.value)];
    document.getElementById("stock-available").textContent = product ? "Current stock: " + product.quantity : "Select a product to see its current stock.";
}

function renderStockHistory(movements) {
    const body = document.getElementById("stock-history");
    body.replaceChildren();
    const pageCount = Math.max(1, Math.ceil(movements.length / historyPageSize));
    historyPage = Math.max(1, Math.min(historyPage, pageCount));
    document.getElementById("stock-pagination").hidden = movements.length <= historyPageSize;
    document.getElementById("stock-page-info").textContent = "Page " + historyPage + " of " + pageCount;
    document.getElementById("stock-previous").disabled = historyPage === 1;
    document.getElementById("stock-next").disabled = historyPage === pageCount;
    if (!movements.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 5;
        cell.className = "empty-state";
        cell.textContent = "No stock movements recorded.";
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }
    // Sort and paginate a copy; all stored movement records remain untouched.
    const sortedMovements = movements.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    const start = (historyPage - 1) * historyPageSize;
    sortedMovements.slice(start, start + historyPageSize).forEach(function (movement) {
        const row = document.createElement("tr");
        const stockIn = movement.type === "stock-in";
        const values = [new Date(movement.date).toLocaleString("en-PH"), movement.productName,
            stockIn ? "Stock In" : "Stock Out", (stockIn ? "+" : "−") + movement.quantity,
            Number.isSafeInteger(movement.resultingQuantity) ? movement.resultingQuantity : "N/A"];
        values.forEach(function (value, index) {
            const cell = document.createElement("td");
            if (index === 2) {
                const badge = document.createElement("span");
                badge.className = "status-badge " + (stockIn ? "status-in-stock" : "status-low-stock");
                badge.textContent = value;
                cell.appendChild(badge);
            } else cell.textContent = value;
            row.appendChild(cell);
        });
        body.appendChild(row);
    });
}

stockForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!initializeApp()) return;
    stockError.textContent = "";
    stockFeedback.textContent = "";
    const index = Number(stockProduct.value);
    const type = stockType.value;
    const quantity = Number(stockQuantity.value);
    if (stockProduct.value === "" || !Number.isInteger(index) || !stockProducts[index]) {
        stockError.textContent = "Please select a product.";
        stockProduct.focus();
        return;
    }
    if (!["stock-in", "stock-out"].includes(type)) {
        stockError.textContent = "Please select Stock In or Stock Out.";
        stockType.focus();
        return;
    }
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || stockQuantity.validity.badInput) {
        stockError.textContent = "Enter a whole-number quantity greater than zero.";
        stockQuantity.focus();
        return;
    }
    storageWarnings.length = 0;
    const products = getProducts();
    const movements = getStockMovements();
    if (storageWarnings.length) {
        stockError.textContent = "Cannot record a movement while saved data is unreadable. " + storageWarnings.join(" ");
        return;
    }
    if (JSON.stringify(products) !== stockSnapshot) {
        refreshStock();
        stockError.textContent = "Inventory changed. Select the product again and check its current stock.";
        return;
    }
    const product = products[index];
    if (type === "stock-out" && quantity > product.quantity) {
        stockError.textContent = "Insufficient stock.";
        stockQuantity.focus();
        return;
    }
    const resultingQuantity = product.quantity + (type === "stock-in" ? quantity : -quantity);
    if (!Number.isSafeInteger(resultingQuantity)) {
        stockError.textContent = "The resulting stock quantity is too large.";
        return;
    }
    products[index] = { ...product, quantity: resultingQuantity };
    movements.push({ ...(product.id ? { productId: product.id } : {}),
        productName: product.name, type: type, quantity: quantity,
        date: new Date().toISOString(), resultingQuantity: resultingQuantity });
    if (!saveStockTransaction(products, movements)) {
        stockError.textContent = "Unable to save the stock movement. Check browser storage and try again. " + storageWarnings.join(" ");
        return;
    }
    stockForm.reset();
    historyPage = 1;
    refreshStock();
    stockFeedback.textContent = (type === "stock-in" ? "Stock In" : "Stock Out") + " recorded for " + product.name + ". Current stock: " + resultingQuantity + ".";
});

stockProduct.addEventListener("change", showAvailableStock);
document.getElementById("stock-previous").addEventListener("click", function () {
    historyPage -= 1;
    refreshStock();
});
document.getElementById("stock-next").addEventListener("click", function () {
    historyPage += 1;
    refreshStock();
});
stockForm.addEventListener("input", function () { stockError.textContent = ""; stockFeedback.textContent = ""; });
refreshStock();
window.addEventListener("pageshow", refreshStock);
window.addEventListener("storage", function (event) {
    if (["sari2_products", "sari2_stock_movements", "sari2_settings", null].includes(event.key)) refreshStock();
});
