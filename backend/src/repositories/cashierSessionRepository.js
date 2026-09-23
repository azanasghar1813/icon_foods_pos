export const cashierSessionRepository = new Proxy({}, { get: () => () => ({}) });
