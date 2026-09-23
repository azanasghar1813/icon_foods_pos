import { orderLifecycleService } from './orderLifecycleService.js';
import { productRepository } from '../repositories/productRepository.js';
import { dealRepository } from '../repositories/dealRepository.js';

class OrderValidationService {
  validateOrderCreation(orderData) {
    if (!orderData.shift_id) {
      throw new Error('Cashier shift ID is required to open an order.');
    }
    if (!orderData.cashier_user_id) {
      throw new Error('Cashier user ID is required to open an order.');
    }
  }

  validateItemAddition(order, itemInput) {
    if (!order) {
      throw new Error('Order not found.');
    }
    if (!orderLifecycleService.isOrderEditable(order)) {
      throw new Error(`Order ${order.order_number} is in state ${order.lifecycle_state} and cannot be modified.`);
    }
    if (!itemInput.product_id) {
      throw new Error('Product ID is required to add an item.');
    }
    const quantity = Number(itemInput.quantity) || 1;
    if (quantity <= 0) {
      throw new Error('Item quantity must be greater than zero.');
    }

    let product = productRepository.findById(itemInput.product_id);
    if (!product) {
      product = dealRepository.findById(itemInput.product_id);
    }
    if (!product) {
      throw new Error(`Item ${itemInput.product_id} was not found in active menu catalog.`);
    }
  }

  validateItemModification(order, itemId) {
    if (!order) {
      throw new Error('Order not found.');
    }
    if (!orderLifecycleService.isOrderEditable(order)) {
      throw new Error(`Order ${order.order_number} is in state ${order.lifecycle_state} and cannot be modified.`);
    }
  }

  validatePaymentAddition(order, paymentInput) {
    if (!order) {
      throw new Error('Order not found.');
    }
    if (!paymentInput.payment_method) {
      throw new Error('Payment method is required.');
    }
    const amount = Number(paymentInput.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }
  }
}

export const orderValidationService = new OrderValidationService();
