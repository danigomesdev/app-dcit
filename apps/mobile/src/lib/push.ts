import { registerPushToken } from "@/lib/push-api";

/**
 * See reminders.ts for why expo-notifications is imported lazily: it
 * registers a push-token listener as a module-level side effect that
 * throws in Expo Go on Android (SDK 53+ dropped remote-notification
 * support there). Requiring it only when actually registering keeps that
 * crash from happening just because this file was imported. A plain
 * require() (rather than a dynamic import()) so the lazy load also works
 * under Jest without --experimental-vm-modules.
 */
function loadNotifications(): typeof import("expo-notifications") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-notifications");
}

/**
 * Best-effort: requests permission, fetches the device's Expo push token,
 * and registers it with the backend so status-change notifications
 * (atestado, férias) can reach this device. Silently no-ops on any
 * failure — never something the login flow depends on.
 */
export async function registerForPushNotifications(sessionToken: string): Promise<void> {
  try {
    const Notifications = loadNotifications();
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
    if (!expoPushToken) return;

    await registerPushToken(sessionToken, expoPushToken);
  } catch {
    // Best-effort — no push for this device until the next successful login.
  }
}
