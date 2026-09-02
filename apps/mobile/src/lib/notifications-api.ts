import { API_URL } from "@/constants/api";

export type NotificationRecord = {
  id: string;
  type: string;
  category: string | null;
  message: string;
  link: string | null;
  createdAt: string;
  readAt: string | null;
};

/**
 * Returns null on any failure (no session, network down, bad response) so
 * the caller can fall back to whatever local state it already has — this
 * hydrates the inbox, it never blocks any other screen.
 */
export async function fetchNotifications(token: string): Promise<NotificationRecord[] | null> {
  try {
    const response = await fetch(`${API_URL}/notifications/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as NotificationRecord[]) : null;
  } catch {
    return null;
  }
}

/**
 * Best-effort: marking read is a side effect of a tap, not the user's
 * primary intent — a failure here never blocks navigation or shows an
 * error. Worst case the notification reads unread again next fetch.
 */
export async function markNotificationRead(token: string, id: string): Promise<void> {
  try {
    await fetch(`${API_URL}/notifications/${id}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Best-effort — see doc comment above.
  }
}
