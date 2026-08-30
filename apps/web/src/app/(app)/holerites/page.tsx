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

export default async function HoleritesPage() {
  const session = await getSession();
  if (!session || session.role === "colaborador") {
    return (
      <EmptyState title="Sem permissão" description="Esta página é restrita a gestores e RH." />
    );
  }

  const [holerites, employees] = await Promise.all([
    apiFetchJson<Holerite[]>("/documentos/holerites/equipe"),
    apiFetchJson<Employee[]>("/employees"),
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
        <ul className={styles.list}>
          {holerites.map((holerite) => (
            <HoleritesRow key={holerite.id} holerite={holerite} />
          ))}
        </ul>
      )}
    </div>
  );
}
