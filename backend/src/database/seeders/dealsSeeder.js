import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.resolve(process.cwd(), 'storage/database/pos.db');
const db = new Database(dbPath);

console.log('--- Starting Deals Seeder ---');

// Helper to find category by name
const getCategory = (nameStr) => {
  return db.prepare("SELECT id, name FROM categories WHERE name LIKE ? LIMIT 1").get(`%${nameStr}%`);
};

// Helper to find product by name
const getProduct = (nameStr) => {
  return db.prepare("SELECT id, name FROM products WHERE name LIKE ? LIMIT 1").get(`%${nameStr}%`);
};

const pizzaCategory = getCategory('Pizza');
const burgerCategory = getCategory('Burger');
const shawarmaCategory = getCategory('Shawarma');
const drinkCategory = getCategory('Drinks');
const friesCategory = getCategory('Fries');
const pastaCategory = getCategory('Pasta');

if (!pizzaCategory) console.warn("WARNING: Pizza category not found");
if (!burgerCategory) console.warn("WARNING: Burger category not found");

// Get the specific pizza flavors for restriction
const allowedPizzaFlavors = [
  getProduct('Tikka'),
  getProduct('Fajita'),
  getProduct('Achari'),
  getProduct('Tandoori')
].filter(Boolean).map(p => p.id).join(',');

const zingerBurger = getProduct('Zinger Burger');
const chickenShawarma = getProduct('Chicken Shawarma');
const fries = getProduct('Fries'); // Assuming 'Fries' is the product and Small/Medium are variants
const hotWings = getProduct('Hot Wings') || getProduct('Wings');
const nuggets = getProduct('Nuggets');
const chickenCheesePasta = getProduct('Chicken Cheese Pasta');
const malaiBotiRoll = getProduct('Malai Boti Roll');
const turkishSandwich = getProduct('Turkish Sandwich');
const pizzaBurger = getProduct('Pizza Burger');
const towerBurger = getProduct('Tower Burger');
const chickenPattyBurger = getProduct('Chicken Patty Burger');
const chapliKebabBurger = getProduct('Chapli Kebab Burger');
const grilledBurger = getProduct('Grilled Burger');
const zingerParatha = getProduct('Zinger Paratha');
const kebabParatha = getProduct('Kebab Paratha');
const loadedFries = getProduct('Loaded Fries');
const italianRoll = getProduct('Italian Roll');
const turkishParatha = getProduct('Turkish Paratha');

const createDeal = (code, name, price) => {
  const dealId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO deals (id, code, name, description, price, lifecycle_state, is_customizable)
    VALUES (?, ?, ?, '', ?, 'ACTIVE', 1)
  `).run(dealId, code, name, price);
  return dealId;
};

const addChoiceComponent = (dealId, name, quantity, categoryId, variantName, allowedIds) => {
  db.prepare(`
    INSERT INTO deal_components (id, deal_id, name, component_type, quantity, target_category_id, target_variant_name, allowed_product_ids)
    VALUES (?, ?, ?, 'CATEGORY_CHOICE', ?, ?, ?, ?)
  `).run(crypto.randomUUID(), dealId, name, quantity, categoryId, variantName, allowedIds);
};

const addFixedComponent = (dealId, name, quantity, productId, variantName) => {
  // We can treat fixed components as a CHOICE that is restricted to exactly ONE product
  // OR we can actually find the product ID and insert it.
  if (!productId) {
    console.warn(`Missing product for fixed component: ${name}`);
    return;
  }
  db.prepare(`
    INSERT INTO deal_components (id, deal_id, name, component_type, product_id, quantity, target_variant_name)
    VALUES (?, ?, ?, 'FIXED_PRODUCT', ?, ?, ?)
  `).run(crypto.randomUUID(), dealId, name, productId, quantity, variantName);
};

// Start Transaction
const runSeed = db.transaction(() => {
  // Wipe existing deals
  db.prepare("DELETE FROM deal_components").run();
  db.prepare("DELETE FROM deals").run();

  let dId;

  // Deal 1
  dId = createDeal('D1', 'Deal 1', 1250);
  addChoiceComponent(dId, 'Small Pizza', 2, pizzaCategory?.id, 'Small', allowedPizzaFlavors);
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 2
  dId = createDeal('D2', 'Deal 2', 2200);
  addChoiceComponent(dId, 'Medium Pizza', 2, pizzaCategory?.id, 'Medium', allowedPizzaFlavors);
  addChoiceComponent(dId, 'Drink 1.5L', 1, drinkCategory?.id, '1.5L', null);

  // Deal 3
  dId = createDeal('D3', 'Deal 3', 3000);
  addChoiceComponent(dId, 'Large Pizza', 2, pizzaCategory?.id, 'Large', allowedPizzaFlavors);
  addChoiceComponent(dId, 'Drink 1.5L', 1, drinkCategory?.id, '1.5L', null);

  // Deal 4
  dId = createDeal('D4', 'Deal 4', 3100);
  addChoiceComponent(dId, 'XL Pizza', 1, pizzaCategory?.id, 'XL', allowedPizzaFlavors);
  addChoiceComponent(dId, 'Medium Pizza', 1, pizzaCategory?.id, 'Medium', allowedPizzaFlavors);
  addChoiceComponent(dId, 'Drink 1.5L', 1, drinkCategory?.id, '1.5L', null);

  // Deal 5
  dId = createDeal('D5', 'Deal 5 (Birthday Deal)', 4750);
  addChoiceComponent(dId, 'Large Pizza', 2, pizzaCategory?.id, 'Large', allowedPizzaFlavors);
  addFixedComponent(dId, 'Zinger Burger', 3, zingerBurger?.id, null);
  addFixedComponent(dId, 'Chicken Shawarma', 3, chickenShawarma?.id, null); // Assuming no variant needed
  addChoiceComponent(dId, 'Drink 1.5L', 2, drinkCategory?.id, '1.5L', null);

  // Deal 6
  dId = createDeal('D6', 'Deal 6', 2000);
  addChoiceComponent(dId, 'Medium Pizza', 1, pizzaCategory?.id, 'Medium', allowedPizzaFlavors);
  addFixedComponent(dId, 'Zinger Burger', 2, zingerBurger?.id, null);
  addFixedComponent(dId, 'Small Fries', 1, fries?.id, 'Small');
  addChoiceComponent(dId, 'Drink 1.5L', 1, drinkCategory?.id, '1.5L', null);

  // Deal 7
  dId = createDeal('D7', 'Deal 7', 1500);
  addChoiceComponent(dId, 'Small Pizza', 1, pizzaCategory?.id, 'Small', allowedPizzaFlavors);
  addFixedComponent(dId, 'Zinger Burger', 2, zingerBurger?.id, null);
  addFixedComponent(dId, 'Large Shawarma', 1, chickenShawarma?.id, 'Large');
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null); // "1 Drink" usually implies 500ml in combos

  // Deal 8
  dId = createDeal('D8', 'Deal 8', 1850);
  addFixedComponent(dId, 'Zinger Burger', 5, zingerBurger?.id, null);
  addChoiceComponent(dId, 'Drink 1.5L', 1, drinkCategory?.id, '1.5L', null);

  // Deal 9
  dId = createDeal('D9', 'Deal 9', 1150);
  addFixedComponent(dId, 'Zinger Burger', 3, zingerBurger?.id, null);
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 10
  dId = createDeal('D10', 'Deal 10', 800);
  addFixedComponent(dId, 'Zinger Burger', 2, zingerBurger?.id, null);
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 11
  dId = createDeal('D11', 'Deal 11', 680);
  addFixedComponent(dId, 'Zinger Burger', 1, zingerBurger?.id, null);
  addFixedComponent(dId, 'Hot Wings', 5, hotWings?.id, null);

  // Deal 12
  dId = createDeal('D12', 'Deal 12', 680);
  addFixedComponent(dId, 'Chicken Nuggets', 10, nuggets?.id, null);
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 13
  dId = createDeal('D13', 'Deal 13', 1050);
  addChoiceComponent(dId, 'Chicken Burger', 5, burgerCategory?.id, null, null); // Assuming they pick from burgers
  addChoiceComponent(dId, 'Drink 1.5L', 1, drinkCategory?.id, '1.5L', null);

  // Deal 14
  dId = createDeal('D14', 'Deal 14', 950);
  addFixedComponent(dId, 'Large Chicken Shawarma', 5, chickenShawarma?.id, 'Large');
  addChoiceComponent(dId, 'Drink 1L', 1, drinkCategory?.id, '1L', null);

  // Deal 15
  dId = createDeal('D15', 'Deal 15', 1600);
  addFixedComponent(dId, 'Large Chicken Cheese Pasta', 2, chickenCheesePasta?.id, 'Large');
  addChoiceComponent(dId, 'Drink 1L', 1, drinkCategory?.id, '1L', null);

  // Deal 16
  dId = createDeal('D16', 'Deal 16', 1000);
  addFixedComponent(dId, 'Small Chicken Cheese Pasta', 2, chickenCheesePasta?.id, 'Small');
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 17
  dId = createDeal('D17', 'Deal 17', 780);
  addFixedComponent(dId, 'Malai Boti Roll', 1, malaiBotiRoll?.id, null);
  addFixedComponent(dId, 'Small Fries', 1, fries?.id, 'Small');
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 18
  dId = createDeal('D18', 'Deal 18', 1350);
  addFixedComponent(dId, 'Turkish Sandwich', 3, turkishSandwich?.id, null);
  addFixedComponent(dId, 'Zinger Burger', 1, zingerBurger?.id, null);
  addChoiceComponent(dId, 'Drink 1L', 1, drinkCategory?.id, '1L', null);

  // Deal 19
  dId = createDeal('D19', 'Deal 19', 750);
  addFixedComponent(dId, 'Pizza Burger', 1, pizzaBurger?.id, null);
  addFixedComponent(dId, 'Small Fries', 1, fries?.id, 'Small');
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 20
  dId = createDeal('D20', 'Deal 20', 900);
  addFixedComponent(dId, 'Tower Burger', 1, towerBurger?.id, null);
  addFixedComponent(dId, 'Hot Wings', 4, hotWings?.id, null);
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 21
  dId = createDeal('D21', 'Deal 21', 600);
  addFixedComponent(dId, 'Chicken Patty Burger', 1, chickenPattyBurger?.id, null);
  addFixedComponent(dId, 'Medium Fries', 1, fries?.id, 'Medium');
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 22
  dId = createDeal('D22', 'Deal 22', 500);
  addFixedComponent(dId, 'Chapli Kebab Burger', 1, chapliKebabBurger?.id, null);
  addFixedComponent(dId, 'Small Fries', 1, fries?.id, 'Small');
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 23
  dId = createDeal('D23', 'Deal 23', 600);
  addFixedComponent(dId, 'Grilled Burger', 1, grilledBurger?.id, null);
  addFixedComponent(dId, 'Small Fries', 1, fries?.id, 'Small');
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 24
  dId = createDeal('D24', 'Deal 24', 700);
  addFixedComponent(dId, 'Zinger Paratha', 2, zingerParatha?.id, null);
  addFixedComponent(dId, 'Small Fries', 1, fries?.id, 'Small');

  // Deal 25
  dId = createDeal('D25', 'Deal 25', 630);
  addFixedComponent(dId, 'Kebab Paratha', 1, kebabParatha?.id, null);
  addFixedComponent(dId, 'Medium Fries', 1, fries?.id, 'Medium');
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 26
  dId = createDeal('D26', 'Deal 26', 780);
  addFixedComponent(dId, 'Hot Wings', 10, hotWings?.id, null);
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 27
  dId = createDeal('D27', 'Deal 27', 1100);
  addFixedComponent(dId, 'Loaded Fries', 1, loadedFries?.id, null);
  addFixedComponent(dId, 'Hot Wings', 4, hotWings?.id, null);
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 28
  dId = createDeal('D28', 'Deal 28', 1500);
  addFixedComponent(dId, 'Hot Wings', 20, hotWings?.id, null);
  addChoiceComponent(dId, 'Drink 1L', 1, drinkCategory?.id, '1L', null);

  // Deal 29
  dId = createDeal('D29', 'Deal 29', 1300);
  addFixedComponent(dId, 'Nuggets', 20, nuggets?.id, null);
  addChoiceComponent(dId, 'Drink 1L', 1, drinkCategory?.id, '1L', null);

  // Deal 30
  dId = createDeal('D30', 'Deal 30', 730);
  addFixedComponent(dId, 'Italian Roll', 1, italianRoll?.id, null);
  addFixedComponent(dId, 'Small Fries', 1, fries?.id, 'Small');
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 31
  dId = createDeal('D31', 'Deal 31', 680);
  addFixedComponent(dId, 'Turkish Paratha', 2, turkishParatha?.id, null);
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 32
  dId = createDeal('D32', 'Deal 32', 850);
  addFixedComponent(dId, 'Small Chicken Cheese Pasta', 1, chickenCheesePasta?.id, 'Small');
  addFixedComponent(dId, 'Hot Wings', 4, hotWings?.id, null);
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 33
  dId = createDeal('D33', 'Deal 33', 900);
  addFixedComponent(dId, 'Malai Boti Roll', 1, malaiBotiRoll?.id, null);
  addFixedComponent(dId, 'Hot Wings', 4, hotWings?.id, null);
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 34
  dId = createDeal('D34', 'Deal 34', 980);
  addFixedComponent(dId, 'Zinger Burger', 1, zingerBurger?.id, null);
  addFixedComponent(dId, 'Turkish Paratha', 1, turkishParatha?.id, null);
  addFixedComponent(dId, 'Medium Fries', 1, fries?.id, 'Medium');
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 35
  dId = createDeal('D35', 'Deal 35', 1320);
  addFixedComponent(dId, 'Large Chicken Cheese Pasta', 1, chickenCheesePasta?.id, 'Large');
  addFixedComponent(dId, 'Nuggets', 6, nuggets?.id, null);
  addFixedComponent(dId, 'Small Fries', 1, fries?.id, 'Small');
  addChoiceComponent(dId, 'Drink 500ml', 1, drinkCategory?.id, '500ml', null);

  // Deal 36
  dId = createDeal('D36', 'Deal 36', 1800);
  addFixedComponent(dId, 'Large Chicken Shawarma', 10, chickenShawarma?.id, 'Large');
  addChoiceComponent(dId, 'Drink 1L', 1, drinkCategory?.id, '1L', null);

  console.log('Seed completed successfully. 36 Deals created.');
});

try {
  runSeed();
} catch (e) {
  console.error("Error running seeder:", e);
}
