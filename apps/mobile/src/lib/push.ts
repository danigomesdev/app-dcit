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

/**
 * Best-effort: without an explicit handler, the current Expo SDK's default
 * behavior is to NOT show a banner for a notification that arrives while
 * the app is in the foreground — this makes that behavior explicit so a
 * push received with the app open is actually visible.
 */
export function configureNotificationHandler(): void {
  try {
    const Notifications = loadNotifications();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Best-effort — without this, foreground pushes just don't show a
    // banner; tapping one from outside the app still works normally.
  }
}

/**
 * Best-effort: covers both a tap while the app is backgrounded (the
 * response listener fires) and a cold start where the tap is what
 * launched the app (getLastNotificationResponse catches that case, which
 * the listener alone would miss). The sticky native value is cleared right
 * after being consumed so a later app launch doesn't re-fire the same tap.
 * Returns a no-op cleanup on any setup failure so callers can always call
 * the returned function.
 */
export function addNotificationTapListener(onTap: (data: unknown) => void): () => void {
  try {
    const Notifications = loadNotifications();
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      onTap(response.notification.request.content.data);
    });
    const response = Notifications.getLastNotificationResponse();
    if (response) {
      onTap(response.notification.request.content.data);
      Notifications.clearLastNotificationResponse();
    }
    return () => subscription.remove();
  } catch {
    return () => {};
  }
}
