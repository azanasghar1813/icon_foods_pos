export const syncService = new Proxy({}, { get: () => () => ({}) });
