const FORGOT_PUNCH_SECONDS = 8 * 60 * 60; // simulates "end of a typical workday"

let scheduledId: string | null = null;

/**
 * expo-notifications registers a push-token listener as a module-level side
 * effect on import, which throws in Expo Go on Android (SDK 53+ dropped
 * remote-notification support there — see the console warning). Importing
 * it lazily, only when a reminder is actually scheduled/cancelled, keeps
 * that side effect from running (and crashing screen registration) just
 * because this file was imported.
 */
async function loadNotifications() {
  return import("expo-notifications");
}

/**
 * Schedules a local reminder for when a punch is left "open" (clocked in
 * with no matching clock-out yet) — mirrors the spec's "você não registrou
 * a saída" nudge. Silently no-ops on any failure (missing permission,
 * Expo Go limitations, etc.) — this is a courtesy nudge, never something
 * the punch flow depends on.
 */
export async function scheduleForgotPunchReminder(): Promise<void> {
  try {
    const Notifications = await loadNotifications();
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;

    await cancelForgotPunchReminder();
    scheduledId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Você não registrou a saída",
        body: "Não esqueça de bater o ponto de saída de hoje.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: FORGOT_PUNCH_SECONDS,
      },
    });
  } catch {
    // Best-effort nudge — never block or surface errors from the punch flow.
  }
}

export async function cancelForgotPunchReminder(): Promise<void> {
  if (!scheduledId) return;
  try {
    const Notifications = await loadNotifications();
    await Notifications.cancelScheduledNotificationAsync(scheduledId);
  } catch {
    // Best-effort — if this fails the stale schedule just fires once more.
  } finally {
    scheduledId = null;
  }
}
