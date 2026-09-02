"use client";

import { createContext, useContext } from "react";

import { useNotificationInbox, type NotificationRecord } from "./notification-list";

type NotificationInboxValue = ReturnType<typeof useNotificationInbox>;

const NotificationInboxContext = createContext<NotificationInboxValue | null>(null);

export function NotificationProvider({
  notifications,
  children,
}: {
  notifications: NotificationRecord[];
  children: React.ReactNode;
}) {
  const inbox = useNotificationInbox(notifications);
  return (
    <NotificationInboxContext.Provider value={inbox}>{children}</NotificationInboxContext.Provider>
  );
}

export function useNotificationContext() {
  const value = useContext(NotificationInboxContext);
  if (!value) {
    throw new Error("useNotificationContext must be used within a NotificationProvider");
  }
  return value;
}
