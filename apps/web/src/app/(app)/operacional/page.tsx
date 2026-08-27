import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import styles from "./operacional.module.css";

type ActiveSobreaviso = {
  id: string;
  userId: string;
  userName: string;
  startedAt: string;
};

type Deslocamento = {
  id: string;
  userId: string;
  userName: string;
  startedAt: string;
  endedAt: string;
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR");
}

export default async function OperacionalPage() {
  const session = await getSession();
  if (!session || session.role === "colaborador") {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é restrita a gestores e RH."
      />
    );
  }

  const [activeSobreaviso, deslocamentos] = await Promise.all([
    apiFetchJson<ActiveSobreaviso[]>("/operacional/sobreaviso/equipe"),
    apiFetchJson<Deslocamento[]>("/operacional/deslocamentos/equipe"),
  ]);

  if (activeSobreaviso.length === 0 && deslocamentos.length === 0) {
    return (
      <EmptyState
        title="Operacional"
        description="O status de sobreaviso e os deslocamentos da equipe vão aparecer aqui."
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Operacional</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Sobreaviso agora</h2>
        {activeSobreaviso.length === 0 ? (
          <p className={styles.sectionEmpty}>Ninguém está de sobreaviso no momento.</p>
        ) : (
          <ul className={styles.list}>
            {activeSobreaviso.map((entry) => (
              <li key={entry.id} className={styles.item}>
                <span className={styles.itemName}>{entry.userName}</span>
                <span className={styles.statusActive}>
                  desde {formatDateTime(entry.startedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Deslocamentos</h2>
        {deslocamentos.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum deslocamento registrado.</p>
        ) : (
          <ul className={styles.list}>
            {deslocamentos.map((entry) => (
              <li key={entry.id} className={styles.item}>
                <span className={styles.itemName}>{entry.userName}</span>
                <span className={styles.itemDetail}>
                  {formatDateTime(entry.startedAt)} até {formatDateTime(entry.endedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
