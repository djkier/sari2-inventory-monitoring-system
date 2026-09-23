// Shared stock and calendar-date rules for inventory monitoring pages.
function getLowStockThreshold(product, settings) {
    return Number.isInteger(product.lowStockThreshold) && product.lowStockThreshold >= 0
        ? product.lowStockThreshold : settings.defaultLowStockThreshold;
}

function getStockStatus(product, settings) {
    if (product.quantity === 0) {
        return "Out of Stock";
    }
    return product.quantity <= getLowStockThreshold(product, settings) ? "Low Stock" : "In Stock";
}

