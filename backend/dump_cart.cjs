const db = require('better-sqlite3')('./storage/database/pos.db');

// The active cart is stored in memory by cartService. But wait, is it in memory or db?
// In cartService.js: "In a real app, this might be in Redis or DB. Here we use an in-memory Map."
// If it's in memory, I can't access it from a separate Node process!

// BUT I can fetch it via HTTP from the running server!
async function run() {
  try {
    const res = await fetch('http://localhost:5000/api/v1/cart', {
      headers: {
        'x-cashier-session-id': 'DEFAULT_SESSION',
        'x-user-id': 'DEFAULT_USER'
      }
    });
    const data = await res.json();
    console.log("CART DATA:", JSON.stringify(data, null, 2));

    // Also attempt checkout via HTTP to see what happens
    const checkoutRes = await fetch('http://localhost:5000/api/v1/cart/checkout', {
      method: 'POST',
      headers: {
        'x-cashier-session-id': 'DEFAULT_SESSION',
        'x-user-id': 'DEFAULT_USER',
        'Content-Type': 'application/json',
        'idempotency-key': 'test-1234'
      },
      body: JSON.stringify(data.data) // send cart as payload
    });
    const checkoutData = await checkoutRes.json();
    console.log("CHECKOUT RESPONSE:", JSON.stringify(checkoutData, null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
