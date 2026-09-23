export const userRepository = new Proxy({}, { get: () => () => ({}) });
