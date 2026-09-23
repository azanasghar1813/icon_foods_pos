export const userService = new Proxy({}, { get: () => () => ({}) });
