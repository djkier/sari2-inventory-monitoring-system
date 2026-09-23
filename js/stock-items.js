
const sampleProducts = [
    { id: "sample-coke", name: "Coca-Cola 1L", category: "Beverages", price: 65, quantity: 18, lowStockThreshold: 6, expirationDate: "2027-01-20", imageUrl: "" },
    { id: "sample-noodles", name: "Lucky Me Pancit Canton 80g", category: "Instant Noodles", price: 15, quantity: 4, lowStockThreshold: 8, expirationDate: "2026-12-21", imageUrl: "" },
    { id: "sample-corned-beef", name: "Argentina Corned Beef 150g", category: "Canned Goods", price: 42.50, quantity: 0, lowStockThreshold: 4, expirationDate: "2027-05-20", imageUrl: "" },
    { id: "sample-bread", name: "Gardenia Classic Bread 400g", category: "Bread", price: 68, quantity: 3, lowStockThreshold: 3, expirationDate: "2026-09-24", imageUrl: "" },
    { id: "sample-milk", name: "Nestle Fresh Milk 1L", category: "Dairy", price: 105, quantity: 8, lowStockThreshold: 3, expirationDate: "2026-09-29", imageUrl: "" },
    { id: "sample-yakult", name: "Yakult 80ml", category: "Dairy", price: 10, quantity: 0, lowStockThreshold: 5, expirationDate: "2026-09-25", imageUrl: "" },
    { id: "sample-cake", name: "Fudgee Barr Chocolate 40g", category: "Snacks", price: 8, quantity: 2, lowStockThreshold: 6, expirationDate: "2026-09-20", imageUrl: "" },
    { id: "sample-crackers", name: "Rebisco Crackers 32g", category: "Snacks", price: 7, quantity: 20, lowStockThreshold: 8, expirationDate: "2026-09-21", imageUrl: "" },
    { id: "sample-pandesal", name: "Pandesal Pack of 6", category: "Bread", price: 24, quantity: 6, lowStockThreshold: 2, expirationDate: "2026-09-22", imageUrl: "" },
    { id: "sample-coffee", name: "Nescafe 3-in-1 Original 27.5g", category: "Coffee", price: 12, quantity: 30, lowStockThreshold: 10, expirationDate: "2027-03-21", imageUrl: "" },
    { id: "sample-bags", name: "Plastic Sando Bags Pack of 100", category: "Store Supplies", price: 35, quantity: 2, lowStockThreshold: 2, expirationDate: "", imageUrl: "" },
    { id: "sample-sponge", name: "Scrubbing Sponge", category: "Household Supplies", price: 15, quantity: 12, lowStockThreshold: 4, expirationDate: "", imageUrl: "" }
];

const sampleStockMovements = [
    { id: "sample-move-01", productId: "sample-coke", productName: "Coca-Cola 1L", type: "stock-in", quantity: 24, date: "2026-09-17T09:00:00+08:00", resultingQuantity: 24 },
    { id: "sample-move-02", productId: "sample-coke", productName: "Coca-Cola 1L", type: "stock-out", quantity: 6, date: "2026-09-21T16:00:00+08:00", resultingQuantity: 18 },
    { id: "sample-move-03", productId: "sample-noodles", productName: "Lucky Me Pancit Canton 80g", type: "stock-in", quantity: 24, date: "2026-09-17T09:05:00+08:00", resultingQuantity: 24 },
    { id: "sample-move-04", productId: "sample-noodles", productName: "Lucky Me Pancit Canton 80g", type: "stock-out", quantity: 20, date: "2026-09-21T16:05:00+08:00", resultingQuantity: 4 },
    { id: "sample-move-05", productId: "sample-corned-beef", productName: "Argentina Corned Beef 150g", type: "stock-in", quantity: 12, date: "2026-09-17T09:10:00+08:00", resultingQuantity: 12 },
    { id: "sample-move-06", productId: "sample-corned-beef", productName: "Argentina Corned Beef 150g", type: "stock-out", quantity: 12, date: "2026-09-21T16:10:00+08:00", resultingQuantity: 0 },
    { id: "sample-move-07", productId: "sample-bread", productName: "Gardenia Classic Bread 400g", type: "stock-in", quantity: 10, date: "2026-09-17T09:15:00+08:00", resultingQuantity: 10 },
    { id: "sample-move-08", productId: "sample-bread", productName: "Gardenia Classic Bread 400g", type: "stock-out", quantity: 7, date: "2026-09-21T16:15:00+08:00", resultingQuantity: 3 },
    { id: "sample-move-09", productId: "sample-yakult", productName: "Yakult 80ml", type: "stock-in", quantity: 20, date: "2026-09-17T09:20:00+08:00", resultingQuantity: 20 },
    { id: "sample-move-10", productId: "sample-yakult", productName: "Yakult 80ml", type: "stock-out", quantity: 20, date: "2026-09-21T16:20:00+08:00", resultingQuantity: 0 }
];
