const { AppError } = require("./errors");
const { validateProductInput } = require("./products");
const { mutateJson } = require("./storage");

const seedSource = "sari2-demo-v1";
const demoSeedProducts = [
    {
        id: "10000000-0000-4000-8000-000000000001",
        seedKey: "coca-cola-1l",
        name: "Coca-Cola 1L",
        category: "Beverages",
        price: 65,
        quantity: 18,
        lowStockThreshold: 6,
        expirationDate: "2027-01-20",
        imageUrl: ""
    },
    {
        id: "10000000-0000-4000-8000-000000000002",
        seedKey: "lucky-me-pancit-canton-80g",
        name: "Lucky Me Pancit Canton 80g",
        category: "Instant Noodles",
        price: 15,
        quantity: 4,
        lowStockThreshold: 8,
        expirationDate: "2026-12-21",
        imageUrl: ""
    },
    {
        id: "10000000-0000-4000-8000-000000000003",
        seedKey: "argentina-corned-beef-150g",
        name: "Argentina Corned Beef 150g",
        category: "Canned Goods",
        price: 42.5,
        quantity: 0,
        lowStockThreshold: 4,
        expirationDate: "2027-05-20",
        imageUrl: ""
    },
    {
        id: "10000000-0000-4000-8000-000000000004",
        seedKey: "gardenia-classic-bread-400g",
        name: "Gardenia Classic Bread 400g",
        category: "Bread",
        price: 68,
        quantity: 3,
        lowStockThreshold: 3,
        expirationDate: "2026-10-23",
        imageUrl: ""
    },
    {
        id: "10000000-0000-4000-8000-000000000005",
        seedKey: "nestle-fresh-milk-1l",
        name: "Nestle Fresh Milk 1L",
        category: "Dairy",
        price: 105,
        quantity: 8,
        lowStockThreshold: 3,
        expirationDate: "2026-10-27",
        imageUrl: ""
    },
    {
        id: "10000000-0000-4000-8000-000000000006",
        seedKey: "yakult-80ml",
        name: "Yakult 80ml",
        category: "Dairy",
        price: 10,
        quantity: 0,
        lowStockThreshold: 5,
        expirationDate: "2026-10-24",
        imageUrl: ""
    },
    {
        id: "10000000-0000-4000-8000-000000000007",
        seedKey: "fudgee-barr-chocolate-40g",
        name: "Fudgee Barr Chocolate 40g",
        category: "Snacks",
        price: 8,
        quantity: 2,
        lowStockThreshold: 6,
        expirationDate: "2026-10-20",
        imageUrl: ""
    },
    {
        id: "10000000-0000-4000-8000-000000000008",
        seedKey: "rebisco-crackers-32g",
        name: "Rebisco Crackers 32g",
        category: "Snacks",
        price: 7,
        quantity: 20,
        lowStockThreshold: 8,
        expirationDate: "2027-02-21",
        imageUrl: ""
    },
    {
        id: "10000000-0000-4000-8000-000000000009",
        seedKey: "pandesal-pack-of-6",
        name: "Pandesal Pack of 6",
        category: "Bread",
        price: 24,
        quantity: 6,
        lowStockThreshold: 2,
        expirationDate: "2026-10-29",
        imageUrl: ""
    },
    {
        id: "10000000-0000-4000-8000-000000000010",
        seedKey: "nescafe-3-in-1-original",
        name: "Nescafe 3-in-1 Original 27.5g",
        category: "Coffee",
        price: 12,
        quantity: 30,
        lowStockThreshold: 10,
        expirationDate: "2027-03-21",
        imageUrl: ""
    },
    {
        id: "10000000-0000-4000-8000-000000000011",
        seedKey: "plastic-sando-bags-100",
        name: "Plastic Sando Bags Pack of 100",
        category: "Store Supplies",
        price: 35,
        quantity: 2,
        lowStockThreshold: 2,
        expirationDate: "",
        imageUrl: ""
    },
    {
        id: "10000000-0000-4000-8000-000000000012",
        seedKey: "scrubbing-sponge",
        name: "Scrubbing Sponge",
        category: "Household Supplies",
        price: 15,
        quantity: 12,
        lowStockThreshold: 4,
        expirationDate: "",
        imageUrl: ""
    }
].map(function (product) {
    return Object.freeze({ ...product, seedSource: seedSource });
});

function seedConflict(message, details) {
    return new AppError(500, "DEMO_SEED_CONFLICT", message, details);
}

function validateSeedDefinitions(demoStoreId) {
    const ids = new Set();
    const keys = new Set();
    demoSeedProducts.forEach(function (product) {
        if (ids.has(product.id) || keys.has(product.seedKey)) {
            throw seedConflict("Demo seed definitions contain duplicate identities.", {
                id: product.id,
                seedKey: product.seedKey
            });
        }
        ids.add(product.id);
        keys.add(product.seedKey);
        validateProductInput({ ...product, storeId: demoStoreId }, {
            requireQuantity: true,
            allowStoreId: true
        });
    });
}