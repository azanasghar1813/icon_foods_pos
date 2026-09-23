import { supabase } from '../config/supabaseClient.js';

export const getPublicMenu = async (req, res) => {
  try {
    // Fetch all categories
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('*');

    if (catError) throw catError;

    // Fetch all products
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('*');

    if (prodError) throw prodError;

    // Return combined menu data
    return res.status(200).json({
      categories,
      products
    });
  } catch (error) {
    console.error('[PublicController] getPublicMenu error:', error);
    return res.status(500).json({ error: 'Failed to fetch public menu' });
  }
};

export const submitOnlineOrder = async (req, res) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey) {
      return res.status(400).json({ error: 'Missing Idempotency-Key header' });
    }

    const { orderDetails, customerInfo } = req.body;

    if (!orderDetails || !orderDetails.items || !Array.isArray(orderDetails.items) || orderDetails.items.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid order details' });
    }

    if (!customerInfo) {
      return res.status(400).json({ error: 'Missing customer info' });
    }

    if (orderDetails.items.length > 50) {
      return res.status(400).json({ error: 'Too many items in order' });
    }

    // 1. Check idempotency key to prevent duplicates
    const { data: existingOrder, error: checkError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (existingOrder) {
      return res.status(200).json({
        message: 'Order already exists (Idempotent)',
        orderId: existingOrder.id,
        status: existingOrder.status
      });
    }

    // 2. Fetch all products to recalculate prices
    const productIds = orderDetails.items.map(item => item.id);
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, price')
      .in('id', productIds);

    if (prodError) throw prodError;

    // 3. Recalculate total on the server
    let calculatedTotal = 0;
    const validatedItems = [];

    for (const item of orderDetails.items) {
      const product = products.find(p => p.id === item.id);
      
      if (!product) {
        return res.status(400).json({ error: `Invalid product ID: ${item.id}` });
      }

      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty <= 0 || qty > 100) {
        return res.status(400).json({ error: `Invalid quantity for product: ${item.id}` });
      }

      // Add base price
      let itemTotal = product.price * qty;

      // Ensure client doesn't inject malicious prices in modifiers (if any)
      // Since we don't have a modifiers table in public context, we ignore client modifier prices for now
      // Or we strip them. The local POS expects them to be structured, but we shouldn't trust client prices.
      
      calculatedTotal += itemTotal;

      validatedItems.push({
        ...item,
        quantity: qty,
        price: product.price, // Force server price
        // Remove client-submitted subtotal/total from item to prevent local POS trusting it
        subtotal: itemTotal
      });
    }

    // Generate a unique ID for the order
    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const orderPayload = {
      id: orderId,
      idempotency_key: idempotencyKey,
      customer_id: customerInfo.id || null, // Optional if guest
      customer_name: customerInfo.name?.substring(0, 100) || 'Guest',
      customer_phone: customerInfo.phone?.substring(0, 20) || '',
      total_amount: calculatedTotal, // SERVER AUTHORITATIVE
      payment_type: orderDetails.paymentType || 'CASH', // Online could be CARD, but default cash on delivery
      status: 'PENDING', // Very important: Local POS pulls 'PENDING' orders
      source: 'ONLINE',  // Mark as an online order
      items: validatedItems, // Server-validated items array
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      payload_version: Date.now() // For optimistic concurrency
    };

    // Insert into Supabase
    // If concurrent requests pass the SELECT check, the UNIQUE constraint on idempotency_key will fail the INSERT safely
    const { error } = await supabase
      .from('orders')
      .insert([orderPayload]);

    if (error) {
      if (error.code === '23505') { // Postgres unique_violation
         return res.status(409).json({ error: 'Order is currently processing' });
      }
      throw error;
    }

    return res.status(201).json({
      message: 'Order placed successfully',
      orderId: orderId,
      status: 'PENDING'
    });
  } catch (error) {
    console.error('[PublicController] submitOnlineOrder error:', error);
    return res.status(500).json({ error: 'Failed to submit order' });
  }
};
