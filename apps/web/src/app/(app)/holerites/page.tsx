import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { HoleritesRow } from "./holerites-row";
import { NovoHoleriteDialog } from "./novo-holerite-dialog";
import styles from "./holerites.module.css";

type Holerite = {
  id: string;
  userId: string;
  userName: string;
  label: string;
  gross: number;
  inss: number;
  irrf: number;
  benefits: number;
};

type Employee = { userId: string; name: string };

type HoleriteGroup = { userId: string; userName: string; holerites: Holerite[] };

function groupByColaborador(holerites: Holerite[]): HoleriteGroup[] {
  const groups = new Map<string, HoleriteGroup>();
  for (const holerite of holerites) {
    const group = groups.get(holerite.userId);
    if (group) {
      group.holerites.push(holerite);
    } else {
      groups.set(holerite.userId, {
        userId: holerite.userId,
        userName: holerite.userName,
        holerites: [holerite],
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.userName.localeCompare(b.userName, "pt-BR"));
}

export default async function HoleritesPage() {
  const session = await getSession();
  if (!session || session.role === "colaborador") {
    return (
      <EmptyState title="Sem permissão" description="Esta página é restrita a gestores e RH." />
    );
  }

  const [holerites, employees] = await Promise.all([
    apiFetchJson<Holerite[]>("/documentos/holerites/equipe"),
    apiFetchJson<Employee[]>("/employees").catch(() => []),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <h1 className={styles.heading}>Holerites</h1>
        <NovoHoleriteDialog employees={employees} />
      </div>
      {holerites.length === 0 ? (
        <p className={styles.subheading}>Nenhum holerite cadastrado ainda.</p>
      ) : (
        <div className={styles.list}>
          {groupByColaborador(holerites).map((group) => (
            <details key={group.userId} className={styles.group}>
              <summary className={styles.groupSummary}>
                {group.userName} ({group.holerites.length})
              </summary>
              <ul className={styles.list}>
                {group.holerites.map((holerite) => (
                  <HoleritesRow key={holerite.id} holerite={holerite} />
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
