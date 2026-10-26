const stockForm = document.getElementById("stock-form");
const stockFields = document.getElementById("stock-fields");
const stockProduct = document.getElementById("stock-product");
const stockType = document.getElementById("stock-type");
const stockQuantity = document.getElementById("stock-quantity");
const stockError = document.getElementById("stock-error");
const stockFeedback = document.getElementById("stock-feedback");
let stockProducts = [];
let stockMovements = [];
let stockLoaded = false;
let stockLoading = false;
let stockLoadError = "";
let stockMutationPending = false;
const historyPageSize = 10;
let historyPage = 1;

const stockLoadGuard = Sari2Api.createRequestGuard(function (pending) {
    stockLoading = pending;
    renderStockPage();
});

const stockMutationGuard = Sari2Api.createRequestGuard(function (pending) {
    stockMutationPending = pending;
    updateStockInteractionState();
});

function getStockApiErrorMessage(error, fallback) {
    return error instanceof Sari2Api.ApiError ? error.message : fallback;
}

function updateStockInteractionState() {
    stockFields.disabled = stockLoading || stockMutationPending || !stockLoaded || Boolean(stockLoadError) || !stockProducts.length;
    stockForm.setAttribute("aria-busy", stockMutationPending ? "true" : "false");
    document.getElementById("stock-previous").disabled = stockLoading || stockMutationPending || historyPage === 1;
    const pageCount = Math.max(1, Math.ceil(stockMovements.length / historyPageSize));
    document.getElementById("stock-next").disabled = stockLoading || stockMutationPending || historyPage === pageCount;
}

function populateStockProducts() {
    const selectedId = stockProduct.value;
    stockProduct.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a product";
    stockProduct.appendChild(placeholder);
    stockProducts.forEach(function (product) {
        const option = document.createElement("option");
        option.value = product.id;
        option.textContent = product.name + " — " + product.quantity + " in stock";
        stockProduct.appendChild(option);
    });
    stockProduct.value = stockProducts.some(function (product) { return product.id === selectedId; }) ? selectedId : "";
}

function getSelectedStockProduct() {
    return stockProducts.find(function (product) { return product.id === stockProduct.value; }) || null;
}

function showAvailableStock() {
    const product = getSelectedStockProduct();
    document.getElementById("stock-available").textContent = product
        ? "Current stock: " + product.quantity
        : "Select a product to see its current stock.";
}

function renderStockHistory() {
    const body = document.getElementById("stock-history");
    body.replaceChildren();

    if (stockLoading || stockLoadError) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 5;
        cell.className = "empty-state";
        cell.textContent = stockLoading ? "Loading stock movement history..." : "Stock movement history could not be loaded.";
        row.appendChild(cell);
        body.appendChild(row);
        document.getElementById("stock-pagination").hidden = true;
        return;
    }

    const sortedMovements = stockMovements.slice().sort(function (first, second) {
        return new Date(second.date) - new Date(first.date);
    });
    const pageCount = Math.max(1, Math.ceil(sortedMovements.length / historyPageSize));
    historyPage = Math.max(1, Math.min(historyPage, pageCount));
    document.getElementById("stock-pagination").hidden = sortedMovements.length <= historyPageSize;
    document.getElementById("stock-page-info").textContent = "Page " + historyPage + " of " + pageCount;

    if (!sortedMovements.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 5;
        cell.className = "empty-state";
        cell.textContent = "No stock movements recorded.";
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }

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
            } else {
                cell.textContent = value;
            }
            row.appendChild(cell);
        });
        body.appendChild(row);
    });
}

function renderStockPage() {
    populateStockProducts();
    document.getElementById("stock-empty").hidden = !stockLoaded || stockProducts.length !== 0;
    showAvailableStock();
    renderStockHistory();
    updateStockInteractionState();
}

async function requestStockData() {
    const results = await Promise.all([
        Sari2Api.request("products"),
        Sari2Api.request("stock-movements")
    ]);
    if (!Array.isArray(results[0]) || !Array.isArray(results[1])) {
        throw new Sari2Api.ApiError("INVALID_RESPONSE", "The server returned invalid inventory data.");
    }
    return { products: results[0], movements: results[1] };
}

async function refreshStock() {
    if (!initializeApp()) return false;
    stockLoadError = "";
    document.getElementById("stock-warning").textContent = "Loading inventory and movement history...";

    return stockLoadGuard.run(async function () {
        try {
            const data = await requestStockData();
            stockProducts = data.products;
            stockMovements = data.movements;
            stockLoaded = true;
            stockLoadError = "";
            document.getElementById("stock-warning").textContent = "";
            return true;
        } catch (error) {
            stockProducts = [];
            stockMovements = [];
            stockLoaded = false;
            stockLoadError = getStockApiErrorMessage(error, "Unable to load inventory and movement history.");
            document.getElementById("stock-warning").textContent = stockLoadError;
            return false;
        }
    });
}

stockForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!initializeApp() || stockMutationPending || !stockLoaded) return;
    stockError.textContent = "";
    stockFeedback.textContent = "";
    const product = getSelectedStockProduct();
    const type = stockType.value;
    const quantity = Number(stockQuantity.value);

    if (!product) {
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

    await stockMutationGuard.run(async function () {
        try {
            const result = await Sari2Api.request("stock-movements", {
                method: "POST",
                body: { productId: product.id, type: type, quantity: quantity }
            });
            if (!result || !result.product || !result.movement) {
                throw new Sari2Api.ApiError("INVALID_RESPONSE", "The server returned an invalid stock transaction result.");
            }

            stockProducts = stockProducts.map(function (item) {
                return item.id === result.product.id ? result.product : item;
            });
            stockMovements = [result.movement].concat(stockMovements.filter(function (movement) {
                return movement.id !== result.movement.id;
            }));
            stockForm.reset();
            historyPage = 1;
            try {
                const data = await requestStockData();
                stockProducts = data.products;
                stockMovements = data.movements;
            } catch (reloadError) {
                document.getElementById("stock-warning").textContent =
                    "The movement was recorded, but the latest inventory could not be reloaded. " +
                    getStockApiErrorMessage(reloadError, "Refresh the page to try again.");
            }
            renderStockPage();
            stockFeedback.textContent = (result.movement.type === "stock-in" ? "Stock In" : "Stock Out") +
                " recorded for " + result.movement.productName + ". Current stock: " + result.movement.resultingQuantity + ".";
        } catch (error) {
            stockError.textContent = getStockApiErrorMessage(error, "Unable to record the stock movement. Try again.");
        }
    });
});

stockProduct.addEventListener("change", showAvailableStock);
document.getElementById("stock-previous").addEventListener("click", function () {
    historyPage -= 1;
    renderStockHistory();
    updateStockInteractionState();
});
document.getElementById("stock-next").addEventListener("click", function () {
    historyPage += 1;
    renderStockHistory();
    updateStockInteractionState();
});
stockForm.addEventListener("input", function () {
    stockError.textContent = "";
    stockFeedback.textContent = "";
});

refreshStock();
window.addEventListener("pageshow", refreshStock);
