async function requestPermissionsAsync() {
  return { granted: true };
}

async function getExpoPushTokenAsync() {
  return { data: "ExponentPushToken[mock]" };
}

async function scheduleNotificationAsync() {
  return "mock-notification-id";
}

async function cancelScheduledNotificationAsync() {}

async function cancelAllScheduledNotificationsAsync() {}

const SchedulableTriggerInputTypes = {
  TIME_INTERVAL: "timeInterval",
};

module.exports = {
  requestPermissionsAsync,
  getExpoPushTokenAsync,
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
  cancelAllScheduledNotificationsAsync,
  SchedulableTriggerInputTypes,
};
