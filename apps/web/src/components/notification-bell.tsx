"use client";

import Link from "next/link";
import { useState } from "react";

import { NotificationList, useNotificationInbox, type NotificationRecord } from "./notification-list";
import styles from "./notification-bell.module.css";

export function NotificationBell({ notifications }: { notifications: NotificationRecord[] }) {
  const [open, setOpen] = useState(false);
  const { items, unreadCount, handleClick } = useNotificationInbox(notifications);

  return (
    <div className={styles.bell}>
      <button
        type="button"
        className={styles.bellButton}
        onClick={() => setOpen((current) => !current)}
        aria-label="Notificações"
        aria-expanded={open}
      >
        <svg className={styles.bellIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.73 21a2 2 0 01-3.46 0"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 ? (
          <span className={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
        ) : null}
      </button>
      {open ? (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>Notificações</div>
          <NotificationList
            notifications={items.slice(0, 10)}
            onItemClick={(notification) => {
              handleClick(notification);
              setOpen(false);
            }}
          />
          <Link href="/notificacoes" className={styles.viewAll} onClick={() => setOpen(false)}>
            Ver todas
          </Link>
        </div>
      ) : null}
    </div>
  );
}
