
const sampleProducts = [
    { 
        id: 1, 
        name: "Coca-Cola 1L", 
        category: "Beverages", 
        price: 65, 
        quantity: 18, 
        lowStockThreshold: 6, 
        expirationDate: "2027-01-20", 
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTaf2fj5hCNZqV4lYqMUy6-ZsT8DrgGSly9nR9KqQCANw&s=10" 
    },
    { 
        id: 2, 
        name: "Lucky Me Pancit Canton 80g", 
        category: "Instant Noodles", 
        price: 15, 
        quantity: 4, 
        lowStockThreshold: 8, 
        expirationDate: "2026-12-21", 
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSngR_dlnHpE9TZR0pfJECZdlssb4NLNAdrv42mCYIjBA&s=10" 
    },
    { 
        id: 3, 
        name: "Argentina Corned Beef 150g", 
        category: "Canned Goods", 
        price: 42.50, 
        quantity: 0, 
        lowStockThreshold: 4, 
        expirationDate: "2027-05-20", 
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT9rgHD5qoWtpB4MYc7H-ne39a2aqJCzs7uCVc6lgULPA&s=10" 
    },
    { 
        id: 4, 
        name: "Gardenia Classic Bread 400g", 
        category: "Bread", 
        price: 68, 
        quantity: 3, 
        lowStockThreshold: 3, 
        expirationDate: "2026-09-24", 
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQZiqZgFq9WNVjDfpvsrS5Yx1VJ9--RStSaIzFlrDdq_Q&s=10" 
    },
    { 
        id: 5, 
        name: "Nestle Fresh Milk 1L", 
        category: "Dairy", 
        price: 105, 
        quantity: 8, 
        lowStockThreshold: 3, 
        expirationDate: "2026-09-29", 
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS95D3oFjC8aroqlVvKO6Z4vlSCJChbA4yqBIqMJAFdoA&s=10" 
    },
    { 
        id: 6, 
        name: "Yakult 80ml", 
        category: "Dairy", 
        price: 10, 
        quantity: 0, 
        lowStockThreshold: 5, 
        expirationDate: "2026-09-25", 
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQavBTkfKbgjzXBU8LEjU8yFLN7Mv7JavfDc_OsG-tpMw&s=10" 
    },
    { 
        id: 7, 
        name: "Fudgee Barr Chocolate 40g", 
        category: "Snacks", 
        price: 8, 
        quantity: 2, 
        lowStockThreshold: 6, 
        expirationDate: "2026-09-20", 
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ5IBkWSzpQx6fIZmMDq5_DPn2EPDJnTKNAQJhlSEL-2Q&s=10" 
    },
    { 
        id: 8, 
        name: "Rebisco Crackers 32g", 
        category: "Snacks", 
        price: 7, 
        quantity: 20, 
        lowStockThreshold: 8, 
        expirationDate: "2026-09-21", 
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTXMOhYJ_C_Y-P0sLSaO4gXxvMwhSKsjz-wY5X8ZfBtVg&s=10" 
    },
    { 
        id: 9, 
        name: "Pandesal Pack of 6", 
        category: "Bread", 
        price: 24, 
        quantity: 6, 
        lowStockThreshold: 2, 
        expirationDate: "2026-09-22", 
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS6rbqq9X6MEnSaoq_SC0SuT5t23QnJp-yEyvRlks4GPA&s=10" 
    },
    { 
        id: 10, 
        name: "Nescafe 3-in-1 Original 27.5g", 
        category: "Coffee", 
        price: 12, 
        quantity: 30, 
        lowStockThreshold: 10, 
        expirationDate: "2027-03-21", 
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-RUMW9GDPtPCyhCwsQ1ByrXdS9pMwfLsjxLnxVz2OZw&s=10" 
    },
    { 
        id: 11, 
        name: "Plastic Sando Bags Pack of 100", 
        category: "Store Supplies", 
        price: 35, 
        quantity: 2, 
        lowStockThreshold: 2, 
        expirationDate: "", 
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT-bpXeLorHhisnrpVw2403o-etiMQHMMpSJR6nAhp33Q&s=10" 
    },
    { 
        id: 12, 
        name: "Scrubbing Sponge", 
        category: "Household Supplies", 
        price: 15, 
        quantity: 12, 
        lowStockThreshold: 4, 
        expirationDate: "", 
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSI0AgOQ6NSsWMsTdZod7UJYk_MP8u1ZUz9ZSWAu_oL9Q&s=10" 
    }
];

const sampleStockMovements = [
    { id: 1, productId: 1, productName: "Coca-Cola 1L", type: "stock-in", quantity: 24, date: "2026-09-17T09:00:00+08:00", resultingQuantity: 24 },
    { id: 2, productId: 1, productName: "Coca-Cola 1L", type: "stock-out", quantity: 6, date: "2026-09-21T16:00:00+08:00", resultingQuantity: 18 },
    { id: 3, productId: 2, productName: "Lucky Me Pancit Canton 80g", type: "stock-in", quantity: 24, date: "2026-09-17T09:05:00+08:00", resultingQuantity: 24 },
    { id: 4, productId: 2, productName: "Lucky Me Pancit Canton 80g", type: "stock-out", quantity: 20, date: "2026-09-21T16:05:00+08:00", resultingQuantity: 4 },
    { id: 5, productId: 3, productName: "Argentina Corned Beef 150g", type: "stock-in", quantity: 12, date: "2026-09-17T09:10:00+08:00", resultingQuantity: 12 },
    { id: 6, productId: 3, productName: "Argentina Corned Beef 150g", type: "stock-out", quantity: 12, date: "2026-09-21T16:10:00+08:00", resultingQuantity: 0 },
    { id: 7, productId: 4, productName: "Gardenia Classic Bread 400g", type: "stock-in", quantity: 10, date: "2026-09-17T09:15:00+08:00", resultingQuantity: 10 },
    { id: 8, productId: 4, productName: "Gardenia Classic Bread 400g", type: "stock-out", quantity: 7, date: "2026-09-21T16:15:00+08:00", resultingQuantity: 3 },
    { id: 9, productId: 6, productName: "Yakult 80ml", type: "stock-in", quantity: 20, date: "2026-09-17T09:20:00+08:00", resultingQuantity: 20 },
    { id: 10, productId: 6, productName: "Yakult 80ml", type: "stock-out", quantity: 20, date: "2026-09-21T16:20:00+08:00", resultingQuantity: 0 }
];
