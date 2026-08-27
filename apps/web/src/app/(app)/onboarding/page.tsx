import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import styles from "./onboarding.module.css";

type TeamProgress = {
  userId: string;
  userName: string;
  completedCount: number;
  totalCount: number;
};

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session || session.role === "colaborador") {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é restrita a gestores e RH."
      />
    );
  }

  const progress = await apiFetchJson<TeamProgress[]>("/onboarding/equipe");

  if (progress.length === 0) {
    return (
      <EmptyState
        title="Onboarding"
        description="O progresso de integração dos colaboradores vai aparecer aqui."
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Onboarding</h1>
      <ul className={styles.list}>
        {progress.map((entry) => {
          const percent =
            entry.totalCount === 0
              ? 0
              : Math.round((entry.completedCount / entry.totalCount) * 100);
          const complete = entry.totalCount > 0 && entry.completedCount === entry.totalCount;

          return (
            <li key={entry.userId} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{entry.userName}</span>
                <span className={styles.itemDetail}>
                  {entry.completedCount} de {entry.totalCount} tarefas concluídas
                </span>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
              <span
                className={complete ? styles.statusComplete : styles.statusPending}
              >
                {complete ? "Concluído" : `${percent}%`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
