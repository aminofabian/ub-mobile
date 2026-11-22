export const Linking = {
  getInitialURL: async () => null,
  addEventListener: () => ({ remove() {} }),
};
export const Platform = { OS: 'android' };
export default { Linking, Platform };
