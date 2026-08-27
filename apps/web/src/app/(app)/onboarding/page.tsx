import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { OnboardingRow } from "./onboarding-row";
import styles from "./onboarding.module.css";

type Task = {
  id: string;
  title: string;
  description: string;
};

type TeamProgress = {
  userId: string;
  userName: string;
  completedCount: number;
  totalCount: number;
  tasks: Task[];
  completedTaskIds: string[];
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
        {progress.map((entry) => (
          <OnboardingRow key={entry.userId} entry={entry} />
        ))}
      </ul>
    </div>
  );
}
