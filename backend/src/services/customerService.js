import { customerRepository } from '../repositories/customerRepository.js';

export const customerService = {
  createCustomer: (data) => {
    if (!data.first_name) {
      throw new Error('First name is required');
    }
    return customerRepository.create(data);
  },

  updateCustomer: (id, data) => {
    const existing = customerRepository.findById(id);
    if (!existing) {
      throw new Error('Customer not found');
    }
    if (!data.first_name) {
      throw new Error('First name is required');
    }
    return customerRepository.update(id, data);
  },

  deleteCustomer: (id) => {
    const existing = customerRepository.findById(id);
    if (!existing) {
      throw new Error('Customer not found');
    }
    return customerRepository.delete(id);
  },

  deleteAllCustomers: () => {
    return customerRepository.deleteAll();
  },

  getCustomerById: (id) => {
    const customer = customerRepository.findById(id);
    if (!customer) {
      throw new Error('Customer not found');
    }
    return customer;
  },

  getAllCustomers: () => {
    return customerRepository.findAll();
  },

  searchCustomers: (query) => {
    if (!query) return customerRepository.findAll();
    return customerRepository.search(query);
  }
};
