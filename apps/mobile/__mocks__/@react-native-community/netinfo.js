function addEventListener() {
  // Tests don't simulate connectivity transitions — no-op unsubscribe.
  return () => {};
}

module.exports = {
  __esModule: true,
  default: { addEventListener },
  addEventListener,
};
