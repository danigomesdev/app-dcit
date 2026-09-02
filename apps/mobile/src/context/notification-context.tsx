import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { useRouter, type Href } from "expo-router";

import { getSessionToken } from "@/lib/session";
import {
  fetchNotifications,
  markNotificationRead,
  type NotificationRecord,
} from "@/lib/notifications-api";

export type { NotificationRecord };

type NotificationContextValue = {
  items: NotificationRecord[];
  unreadCount: number;
  refresh: () => Promise<NotificationRecord[]>;
  handlePress: (notification: NotificationRecord) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const router = useRouter();

  const refresh = useCallback(async (): Promise<NotificationRecord[]> => {
    const token = await getSessionToken();
    if (!token) return [];
    const fetched = await fetchNotifications(token);
    if (!fetched) return [];
    setItems(fetched);
    return fetched;
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const handlePress = useCallback(
    (notification: NotificationRecord) => {
      if (notification.readAt === null) {
        const readAt = new Date().toISOString();
        setItems((current) =>
          current.map((n) => (n.id === notification.id ? { ...n, readAt } : n)),
        );
        getSessionToken().then((token) => {
          if (token) markNotificationRead(token, notification.id).catch(() => {});
        });
      }
      if (notification.link) {
        router.push(notification.link as Href);
      }
    },
    [router],
  );

  const unreadCount = items.filter((n) => n.readAt === null).length;

  return (
    <NotificationContext.Provider value={{ items, unreadCount, refresh, handlePress }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const value = useContext(NotificationContext);
  if (!value) {
    throw new Error("useNotificationContext must be used within a NotificationProvider");
  }
  return value;
}
