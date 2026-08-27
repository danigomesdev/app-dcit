import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import styles from "./ponto.module.css";

type TeamMember = {
  userId: string;
  name: string;
  entries: { id: string; clockedAt: string }[];
  workedMinutes: number;
  isOpen: boolean;
};

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default async function Home() {
  const session = await getSession();
  if (!session || session.role === "colaborador") {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é restrita a gestores e RH."
      />
    );
  }

  const team = await apiFetchJson<TeamMember[]>("/time-entries/team");

  if (team.length === 0) {
    return (
      <EmptyState
        title="Ponto dos funcionários"
        description="A presença dos funcionários no dia vai aparecer aqui."
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Ponto dos funcionários</h1>
      <ul className={styles.list}>
        {team.map((member) => {
          const statusLabel = member.isOpen
            ? "Presente"
            : member.entries.length > 0
              ? "Não presente"
              : "Sem registro hoje";
          const statusClass = member.isOpen
            ? styles.statusOpen
            : member.entries.length > 0
              ? styles.statusClosed
              : styles.statusNone;

          return (
            <li key={member.userId} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{member.name}</span>
                <span className={styles.itemDetail}>
                  {member.entries.length > 0
                    ? `${member.entries.map((entry) => formatTime(entry.clockedAt)).join(", ")} · ${formatMinutes(member.workedMinutes)} hoje`
                    : "Nenhuma batida hoje"}
                </span>
              </div>
              <span className={`${styles.status} ${statusClass}`}>{statusLabel}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
