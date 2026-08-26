const isAvailableAsync = jest.fn(async () => true);
const shareAsync = jest.fn(async () => {});

module.exports = { isAvailableAsync, shareAsync };
