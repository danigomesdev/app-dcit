import { apiFetchJson } from "@/lib/api";

import { LixeiraRow } from "./lixeira-row";
import styles from "./colaboradores.module.css";

type TrashedEmployee = {
  userId: string;
  name: string;
  deletedAt: string;
};

export async function LixeiraSection() {
  const trashed = await apiFetchJson<TrashedEmployee[]>("/employees/trash");

  return (
    <details className={styles.trash}>
      <summary className={styles.trashSummary}>Lixeira ({trashed.length})</summary>
      {trashed.length === 0 ? (
        <p className={styles.subheading}>Nenhum colaborador na lixeira.</p>
      ) : (
        <ul className={styles.list}>
          {trashed.map((employee) => (
            <LixeiraRow key={employee.userId} employee={employee} />
          ))}
        </ul>
      )}
    </details>
  );
}
