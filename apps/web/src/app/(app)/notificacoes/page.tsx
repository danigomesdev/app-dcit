import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";
import type { NotificationRecord } from "@/components/notification-list";

import { NotificationHistoryList } from "./notification-history-list";
import styles from "./notificacoes.module.css";

export default async function NotificacoesPage() {
  const session = await getSession();
  const notifications = session
    ? await apiFetchJson<NotificationRecord[]>("/notifications/mine").catch(() => [] as NotificationRecord[])
    : [];

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Notificações</h1>
      <NotificationHistoryList notifications={notifications} />
    </div>
  );
}
