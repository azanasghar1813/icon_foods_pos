export const roleService = new Proxy({}, { get: () => () => ({}) });
