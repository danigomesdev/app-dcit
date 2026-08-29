import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { ConvencoesRow } from "./convencoes-row";
import { NovaConvencaoDialog } from "./nova-convencao-dialog";
import styles from "./convencoes.module.css";

type Convencao = {
  id: string;
  nome: string;
  cnpj: string | null;
  categoriaSindical: string | null;
  expectedDailyMinutes: number;
  overtimePercent: number;
};

export default async function ConvencoesPage() {
  const session = await getSession();
  if (!session || session.role !== "rh") {
    return <EmptyState title="Sem permissão" description="Esta página é restrita ao RH." />;
  }

  const convencoes = await apiFetchJson<Convencao[]>("/convencoes");

  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <h1 className={styles.heading}>Convenções coletivas</h1>
        <NovaConvencaoDialog />
      </div>
      {convencoes.length === 0 ? (
        <p className={styles.subheading}>Nenhuma convenção cadastrada ainda.</p>
      ) : (
        <ul className={styles.list}>
          {convencoes.map((convencao) => (
            <ConvencoesRow key={convencao.id} convencao={convencao} />
          ))}
        </ul>
      )}
    </div>
  );
}
