import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import styles from "./alertas.module.css";

type JornadaAlert = {
  id: string;
  userId: string;
  userName: string;
  type: "intrajornada" | "interjornada";
  date: string;
  minutesShort: number;
};

const TYPE_LABELS: Record<JornadaAlert["type"], string> = {
  intrajornada: "Intervalo de almoço",
  interjornada: "Intervalo entre turnos",
};

// Date-only values are stored as UTC midnight — format in UTC so the
// displayed day never shifts by one due to the server's local timezone
// (same reasoning as apps/web/src/app/(app)/escala/page.tsx's formatDateBR).
function formatDateBR(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function AlertasPage() {
  const session = await getSession();
  if (!session || session.role === "colaborador") {
    return (
      <EmptyState title="Sem permissão" description="Esta página é restrita a gestores e RH." />
    );
  }

  const alerts = await apiFetchJson<JornadaAlert[]>("/alertas");

  if (alerts.length === 0) {
    return <EmptyState title="Alertas" description="Nenhum alerta de intervalo registrado." />;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Alertas</h1>
      <ul className={styles.list}>
        {alerts.map((alert) => (
          <li key={alert.id} className={styles.item}>
            <span className={styles.itemName}>{alert.userName}</span>
            <span className={styles.itemDetail}>
              {TYPE_LABELS[alert.type]} · {formatDateBR(alert.date)} · faltaram{" "}
              {alert.minutesShort} min
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
