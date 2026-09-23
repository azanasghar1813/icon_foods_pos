export const kitchenService = new Proxy({}, { get: () => () => ({}) });
