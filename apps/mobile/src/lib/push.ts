import { registerPushToken, unregisterPushToken } from "@/lib/push-api";

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

/**
 * Best-effort: fetches this device's current Expo push token and
 * unregisters it from the backend on logout, so a shared device re-logging
 * in as a different user doesn't keep receiving the previous user's
 * status-change notifications until they happen to log back in.
 */
export async function unregisterPushNotifications(sessionToken: string): Promise<void> {
  try {
    const Notifications = loadNotifications();
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
    if (!expoPushToken) return;

    await unregisterPushToken(sessionToken, expoPushToken);
  } catch {
    // Best-effort — worst case the token stays registered until the next
    // login on this device reassigns it via upsert.
  }
}
