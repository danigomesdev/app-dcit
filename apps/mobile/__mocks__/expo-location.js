async function requestForegroundPermissionsAsync() {
  return { granted: false };
}

async function getCurrentPositionAsync() {
  return { coords: { latitude: 0, longitude: 0 } };
}

async function reverseGeocodeAsync() {
  return [];
}

const Accuracy = {
  Balanced: 3,
};

module.exports = {
  requestForegroundPermissionsAsync,
  getCurrentPositionAsync,
  reverseGeocodeAsync,
  Accuracy,
};
