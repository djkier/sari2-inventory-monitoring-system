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


refreshStock();
window.addEventListener("pageshow", refreshStock);