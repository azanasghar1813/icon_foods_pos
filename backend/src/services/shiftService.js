export const shiftService = new Proxy({}, { get: () => () => ({}) });
