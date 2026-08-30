import { registerForPushNotifications, unregisterPushNotifications } from "@/lib/push";

jest.mock("expo-notifications", () => {
  throw new Error(
    "expo-notifications: Android Push notifications (remote notifications) functionality " +
      "provided by expo-notifications was removed from Expo Go with the release of SDK 53.",
  );
});

describe("push notifications — Expo Go SDK 53+ (native module removed)", () => {
  it("unregisterPushNotifications resolves instead of throwing when requiring expo-notifications throws", async () => {
    await expect(unregisterPushNotifications("token-123")).resolves.toBeUndefined();
  });

  it("registerForPushNotifications resolves instead of throwing when requiring expo-notifications throws", async () => {
    await expect(registerForPushNotifications("token-123")).resolves.toBeUndefined();
  });
});
