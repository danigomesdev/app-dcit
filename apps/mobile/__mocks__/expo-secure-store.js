const store = new Map();

async function setItemAsync(key, value) {
  store.set(key, value);
}

async function getItemAsync(key) {
  return store.has(key) ? store.get(key) : null;
}

async function deleteItemAsync(key) {
  store.delete(key);
}

module.exports = { setItemAsync, getItemAsync, deleteItemAsync };
