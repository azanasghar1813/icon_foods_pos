const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const db = new Database(path.join(__dirname, 'storage', 'database', 'pos.db'));

function uuid() {
  return crypto.randomUUID().replace(/-/g, '').substring(0, 20); // Just needs to be unique string
}

console.log("Clearing old menu data...");
// Delete order items that depend on these variants
db.prepare('DELETE FROM order_items').run();
db.prepare('DELETE FROM product_variants').run();
db.prepare('DELETE FROM products').run();
db.prepare('DELETE FROM categories').run();

// Categories
const categories = [
  'Signature Pizza', 'Traditional Pizza', 'Special Pizza', 'Square Pizza', 
  'Sandwiches', 'Burgers', 'Appetizers', 'Dip Sauces', 'Wraps', 
  'Injected Broast', 'Pasta', 'Spin Roll', 'Shawarma', 'Paratha Roll', 
  'Platters', 'Meal Deals', 'Deals', 'Family & Special Deals'
];

const catMap = {};
let catOrder = 1;
for (const cat of categories) {
  const id = uuid();
  catMap[cat] = id;
  db.prepare(`
    INSERT INTO categories (id, name, display_order, lifecycle_state, visibility)
    VALUES (?, ?, ?, 'ACTIVE', 'VISIBLE')
  `).run(id, cat, catOrder++);
}

// Helper to insert product
let prodOrder = 1;
function addProduct(catName, name, price, variants = []) {
  const catId = catMap[catName];
  const prodId = uuid();
  const code = (prodOrder++).toString().padStart(4, '0');
  
  // If variants exist, base price is usually min price or 0
  let basePrice = price;
  if (variants.length > 0 && !basePrice) {
    basePrice = Math.min(...variants.map(v => v.price));
  }

  db.prepare(`
    INSERT INTO products (id, category_id, product_code, name, price, lifecycle_state, visibility, status)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE', 'VISIBLE', 'AVAILABLE')
  `).run(prodId, catId, code, name, basePrice || 0);

  let varOrder = 1;
  for (const v of variants) {
    const varId = uuid();
    const sku = `${code}-${varOrder}`;
    db.prepare(`
      INSERT INTO product_variants (id, product_id, name, product_code, sku, price, lifecycle_state, display_order)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
    `).run(varId, prodId, v.name, sku, sku, v.price, varOrder++);
  }
}

console.log("Seeding new menu data...");

// 1. Signature Pizza
const sigPizzas = [
  { name: 'Color Pizza', prices: [800, 1200, 1600, 2200] },
  { name: 'Pasta Pizza', prices: [800, 1200, 1600, 2200] },
  { name: 'Euro Pizza', prices: [800, 1200, 1600, 2200] },
  { name: 'Crunchy Pizza', prices: [800, 1200, 1700, 2200] },
  { name: 'Paproni Pizza', prices: [800, 1200, 1600, 2200] },
  { name: 'Deep Dish Pizza', prices: [null, 1200, 1700, 2400] },
  { name: 'Cheese Stuffer', prices: [null, 1200, 1700, 2200] },
  { name: 'Kabab Stuffer', prices: [null, 1200, 1700, 2200] },
  { name: 'Chicken Cheese Stuffer', prices: [null, 1200, 1700, 2200] },
  { name: 'Royal Crust', prices: [null, 1200, 1700, 2200] },
  { name: 'Love Star Pizza', prices: [null, 1300, 1800, 2300] },
  { name: 'Crown Crust Pizza', prices: [null, 1200, 1700, 2200] },
  { name: 'Behari Kabab Pizza', prices: [null, 1200, 1700, 2200] },
  { name: 'Gold Pizza', prices: [null, 1200, 1600, 2200] },
  { name: 'Steam Pizza', prices: [null, 1300, 2000, 2500] }
];

const sizesSMLXL = ['S', 'M', 'L', 'XL'];
for (const p of sigPizzas) {
  const vars = [];
  for(let i=0; i<4; i++) {
    if(p.prices[i]) vars.push({ name: sizesSMLXL[i], price: p.prices[i] });
  }
  addProduct('Signature Pizza', p.name, null, vars);
}
addProduct('Signature Pizza', 'Train Family Pizza', 2999, [{name: 'XL', price: 2999}]);
addProduct('Signature Pizza', "Donor's Pizza", null, [{name: 'M', price: 1300}, {name: 'L', price: 1800}]);
addProduct('Signature Pizza', '1 Meter Pizza', 3499);

// 2. Traditional Pizza
const tradPizzas = ['Chicken Tikka', 'Chicken Fajita', 'Chicken Supreme', 'Chicken Tandoori'];
for (const p of tradPizzas) {
  addProduct('Traditional Pizza', p, null, [
    {name: 'S', price: 550}, {name: 'M', price: 900}, {name: 'L', price: 1300}, {name: 'XL', price: 1700}
  ]);
}

// 3. Special Pizza
const specPizzas = ['Icon Special', 'Malai Boti', 'Cheese Lover', 'Veggie Lover', 'Peri Peri', 'Pepproni', 'Achari Pizza'];
for (const p of specPizzas) {
  addProduct('Special Pizza', p, null, [
    {name: 'S', price: 600}, {name: 'M', price: 1000}, {name: 'L', price: 1450}, {name: 'XL', price: 2000}
  ]);
}

// 4. Square Pizza
const squarePizzas = ['Kabab Stuff Square', 'Cheese Stuff Square', 'Chicken Cheese Stuff', 'Special Square Pizza', 'Square Flower'];
for (const p of squarePizzas) {
  addProduct('Square Pizza', p, null, [
    {name: 'S', price: 800}, {name: 'M', price: 1400}, {name: 'L', price: 1750}
  ]);
}

// 5. Sandwiches
const sandwiches = {
  'Icon Special': 650, 'Tikka Sandwich': 400, 'Cheese Sandwich': 400, 'Special Sandwich': 600,
  'Lava Sandwich': 650, 'Malai Boti Sandwich': 600, 'Calla Zone Sandwich': 1000,
  'Crunchy Sandwich': 700, 'Cheese Stick': 900, 'Steaker': 700, '3rd Floor Sandwich': 1000
};
for (const [k,v] of Object.entries(sandwiches)) addProduct('Sandwiches', k, v);

// 6. Burgers
const burgers = {
  'Dhamaka Best Burger': 400, 'Chapli Burger': 300, 'Zinger Burger': 350, 'Petty Burger': 300,
  'Fillet Burger': 350, 'Max Burger': 400, 'Tower Burger': 600, 'Pizza Burger': 300,
  'Chicken Grill Burger': 500, 'Icon Grill Burger': 600, 'Mighty Zinger Burger': 600
};
for (const [k,v] of Object.entries(burgers)) addProduct('Burgers', k, v);

// 7. Appetizers
addProduct('Appetizers', 'Popcorn Chicken (15 pcs)', 550);
const wingApps = ['Hot Wings', 'Nuggets', 'Oven Baked Wings', 'Peri Peri Wings', 'Honey Wings', 'B.B.Q Wings', 'Peri Peri Bites'];
for (const p of wingApps) {
  addProduct('Appetizers', p, null, [{name: '5 pcs', price: 300}, {name: '10 pcs', price: 600}]);
}
addProduct('Appetizers', 'Plain Fries', null, [{name: 'Reg', price: 250}, {name: 'Large', price: 350}]);
addProduct('Appetizers', 'Loaded Fries', null, [{name: 'Reg', price: 300}, {name: 'Large', price: 550}]);
addProduct('Appetizers', 'Garlic Mayo Fries', 500);
addProduct('Appetizers', 'Masala Fries', 300);

// 8. Dip Sauces
const sauces = ['Chef Special Sauce', 'Garlic Mayo Sauce', 'Malai Boti Sauce', 'B.B.Q Sauce', 'Thousand Sauce'];
for (const s of sauces) addProduct('Dip Sauces', s, 100);

// 9. Wraps
const wraps = {'Icon Sp Wrap': 650, 'Special Wrap': 600, 'Crunchy Wrap': 550, 'Grilled Chicken Wrap': 650};
for (const [k,v] of Object.entries(wraps)) addProduct('Wraps', k, v);

// 10. Injected Broast
addProduct('Injected Broast', 'Injected Broast', null, [
  {name: '2 Pcs', price: 599}, {name: '4 Pcs', price: 1099}, {name: '6 Pcs', price: 1999}
]);
addProduct('Injected Broast', 'Crunchy Piece', 300);

// 11. Pasta
const pastas = {
  'Icon Special Pasta': [350, 700], 'Special Pasta': [300, 600], 'Lava Pasta': [350, 650],
  'Crunchy Pasta': [350, 700], 'Macaroni Pasta': [300, 550]
};
for (const [k,v] of Object.entries(pastas)) {
  addProduct('Pasta', k, null, [{name: 'Half', price: v[0]}, {name: 'Full', price: v[1]}]);
}

// 12. Spin Roll
const spinRolls = {'Icon Spin Roll': 550, 'Malai Boti Roll': 550, 'Behari Roll': 600, 'Crunchy Roll': 700};
for (const [k,v] of Object.entries(spinRolls)) addProduct('Spin Roll', k, v);

// 13. Shawarma
const shawarmas = {'Arabic Shawarma': 350, 'Chicken Shawarma': 250, 'Zinger Shawarma': 350, 'Kababish Shawarma': 300, 'Malai Boti Shawarma': 250, 'Zaitoon Shawarma': 250};
for (const [k,v] of Object.entries(shawarmas)) addProduct('Shawarma', k, v);

// 14. Paratha Roll
const parathas = {'KMC Pratha Roll': 400, 'Kababish Pratha Roll': 350, 'Zinger Pratha Roll': 350, 'Malai Boti Pratha': 300};
for (const [k,v] of Object.entries(parathas)) addProduct('Paratha Roll', k, v);

// 15. Platters
const platters = {'Basic Platter': 899, 'B.B.Q Platter': 1099, 'Golden Platter': 849, 'Chat Pata Platter': 1099};
for (const [k,v] of Object.entries(platters)) addProduct('Platters', k, v);

// 16. Meal Deals
const mealDeals = {'Meal-1': 1949, 'Meal-2': 4199, 'Meal-3': 2390, 'Meal-4': 5199};
for (const [k,v] of Object.entries(mealDeals)) addProduct('Meal Deals', k, v);

// 17. Deals
const standardDeals = {'Deal 1': 549, 'Deal 2': 549, 'Deal 3': 649, 'Deal 4': 699, 'Deal 5': 899, 'Deal 6': 1699, 'Deal 7': 1999, 'Best Deal': 2899};
for (const [k,v] of Object.entries(standardDeals)) addProduct('Deals', k, v);

// 18. Family & Special Deals
const famDeals = {'Family Deal 1': 4999, 'Family Deal 2': 3399, 'Kids Deal': 1099, 'Birthday Deal': 7999};
for (const [k,v] of Object.entries(famDeals)) addProduct('Family & Special Deals', k, v);


// Update Business Settings
db.prepare("INSERT OR REPLACE INTO business_settings (key, value, category) VALUES ('business_name', 'Icon Food Pizza Hut & Cafe', 'General')").run();
db.prepare("INSERT OR REPLACE INTO business_settings (key, value, category) VALUES ('business_phone', '0329-9792223 / 0315-9792247', 'General')").run();
db.prepare("INSERT OR REPLACE INTO business_settings (key, value, category) VALUES ('business_address', 'Jhang Road Sabzi Mandi, Near Shell Pump, Chiniot', 'General')").run();

console.log("Menu seeded successfully!");
