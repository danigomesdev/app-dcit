let notificationsModuleWasRequired = false;

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { appOwnership: "expo" },
}));

jest.mock("expo-notifications", () => {
  notificationsModuleWasRequired = true;
  throw new Error(
    "expo-notifications: Android Push notifications (remote notifications) functionality " +
      "provided by expo-notifications was removed from Expo Go with the release of SDK 53.",
  );
});

import {
  configureNotificationHandler,
  addNotificationTapListener,
  registerForPushNotifications,
  unregisterPushNotifications,
} from "@/lib/push";

describe("push notifications — running in Expo Go (appOwnership === 'expo')", () => {
  beforeEach(() => {
    notificationsModuleWasRequired = false;
  });

  it("configureNotificationHandler never requires expo-notifications", () => {
    configureNotificationHandler();
    expect(notificationsModuleWasRequired).toBe(false);
  });

  it("addNotificationTapListener never requires expo-notifications", () => {
    addNotificationTapListener(jest.fn());
    expect(notificationsModuleWasRequired).toBe(false);
  });

  it("registerForPushNotifications never requires expo-notifications", async () => {
    await registerForPushNotifications("token-123");
    expect(notificationsModuleWasRequired).toBe(false);
  });

  it("unregisterPushNotifications never requires expo-notifications", async () => {
    await unregisterPushNotifications("token-123");
    expect(notificationsModuleWasRequired).toBe(false);
  });
});
