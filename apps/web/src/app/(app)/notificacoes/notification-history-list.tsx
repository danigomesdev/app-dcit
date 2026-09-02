"use client";

import {
  NotificationList,
  useNotificationInbox,
  type NotificationRecord,
} from "@/components/notification-list";

export function NotificationHistoryList({ notifications }: { notifications: NotificationRecord[] }) {
  const { items, handleClick } = useNotificationInbox(notifications);
  return <NotificationList notifications={items} onItemClick={handleClick} />;
}
