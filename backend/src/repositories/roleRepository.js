export const roleRepository = new Proxy({}, { get: () => () => ({}) });
