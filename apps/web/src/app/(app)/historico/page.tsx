import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import styles from "./historico.module.css";

type TimeEntry = { id: string; clockedAt: string };

export default async function HistoricoPage() {
  const session = await getSession();
  if (!session || session.role !== "colaborador") {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é pessoal, restrita a colaboradores."
      />
    );
  }

  const entries = await apiFetchJson<TimeEntry[]>("/time-entries");
  const sorted = [...entries].sort(
    (a, b) => new Date(b.clockedAt).getTime() - new Date(a.clockedAt).getTime(),
  );

  if (sorted.length === 0) {
    return (
      <EmptyState
        title="Histórico de pontos"
        description="Nenhum ponto registrado ainda."
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Histórico de pontos</h1>
      <ul className={styles.list}>
        {sorted.map((entry) => {
          const date = new Date(entry.clockedAt);
          return (
            <li key={entry.id} className={styles.item}>
              <span className={styles.itemDate}>
                {date.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  timeZone: "America/Sao_Paulo",
                })}
              </span>
              <span className={styles.itemTime}>
                {date.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "America/Sao_Paulo",
                })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
