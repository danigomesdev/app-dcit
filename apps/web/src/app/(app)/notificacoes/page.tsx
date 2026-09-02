import { NotificationHistoryList } from "./notification-history-list";
import styles from "./notificacoes.module.css";

export default function NotificacoesPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Notificações</h1>
      <NotificationHistoryList />
    </div>
  );
}
