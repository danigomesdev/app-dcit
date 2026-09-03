import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { ColaboradorSelect } from "./colaborador-select";
import styles from "./gestao-carreiras.module.css";
import { MetasSection } from "./metas-section";

type Employee = { userId: string; name: string };
type CareerGoal = { id: string; tipo: "pdi" | "entrega"; title: string; status: "pendente" | "andamento" | "concluida" };

const TABS = [
  { value: "pdi", label: "PDI & Metas" },
  { value: "trilha", label: "Trilha de Carreira" },
  { value: "avaliacoes", label: "Avaliações de Desempenho" },
] as const;

export default async function GestaoCarreirasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session || session.role !== "gestor") {
    return <EmptyState title="Sem permissão" description="Esta área é exclusiva para gestores." />;
  }

  const params = await searchParams;
  const aba = typeof params.aba === "string" ? params.aba : "pdi";
  const userId = typeof params.userId === "string" ? params.userId : undefined;

  const employees = await apiFetchJson<Employee[]>("/employees");

  return (
    <div className={styles.page}>
      <h1>Gestão de Carreiras</h1>
      <form className={styles.selector}>
        <label htmlFor="userId">Colaborador</label>
        <ColaboradorSelect employees={employees} userId={userId ?? ""} />
        <input type="hidden" name="aba" value={aba} />
      </form>

      {!userId ? (
        <EmptyState title="Selecione um colaborador" description="Escolha um colaborador acima para ver sua carreira." />
      ) : (
        <>
          <nav className={styles.tabs}>
            {TABS.map((tab) => (
              <a
                key={tab.value}
                href={`/gestao-carreiras?aba=${tab.value}&userId=${userId}`}
                className={aba === tab.value ? styles.tabActive : styles.tab}
              >
                {tab.label}
              </a>
            ))}
          </nav>
          {aba === "pdi" ? <MetasTab userId={userId} /> : null}
        </>
      )}
    </div>
  );
}

async function MetasTab({ userId }: { userId: string }) {
  const goals = await apiFetchJson<CareerGoal[]>(`/carreira/metas?userId=${userId}`);
  return <MetasSection userId={userId} goals={goals} />;
}
