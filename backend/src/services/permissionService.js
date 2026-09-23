export const permissionService = new Proxy({}, { get: () => () => ({}) });
