export const permissionRepository = new Proxy({}, { get: () => () => ({}) });
