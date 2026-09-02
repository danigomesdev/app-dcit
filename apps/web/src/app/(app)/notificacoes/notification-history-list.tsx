"use client";

import { NotificationList } from "@/components/notification-list";
import { useNotificationContext } from "@/components/notification-context";

export function NotificationHistoryList() {
  const { items, handleClick } = useNotificationContext();
  return <NotificationList notifications={items} onItemClick={handleClick} />;
}
