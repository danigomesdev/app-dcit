import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { AvaliacoesSection } from "./avaliacoes-section";
import { ColaboradorSelect } from "./colaborador-select";
import styles from "./gestao-carreiras.module.css";
import { MetasSection } from "./metas-section";
import { TrilhaSection } from "./trilha-section";

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
          {aba === "trilha" ? <TrilhaTab userId={userId} /> : null}
          {aba === "avaliacoes" ? (
            <AvaliacoesTab userId={userId} sub={typeof params.sub === "string" ? params.sub : "ciclos"} />
          ) : null}
        </>
      )}
    </div>
  );
}

async function MetasTab({ userId }: { userId: string }) {
  const goals = await apiFetchJson<CareerGoal[]>(`/carreira/metas?userId=${userId}`);
  return <MetasSection userId={userId} goals={goals} />;
}

async function TrilhaTab({ userId }: { userId: string }) {
  const [requirements, promotabilidade] = await Promise.all([
    apiFetchJson<{ id: string; title: string; status: "pendente" | "andamento" | "concluido" }[]>(
      `/carreira/trilha?userId=${userId}`,
    ),
    apiFetchJson<{
      status: "verde" | "amarelo" | "branco";
      mesesDeCasa: number;
      requisitosPendentes: number;
      metasPendentes: number;
      ultimaMediaAvaliacao: number | null;
    }>(`/carreira/promotabilidade/${userId}`),
  ]);
  return <TrilhaSection userId={userId} requirements={requirements} promotabilidade={promotabilidade} />;
}

async function AvaliacoesTab({ userId, sub }: { userId: string; sub: string }) {
  const [evaluations, placements, oneOnOnes] = await Promise.all([
    apiFetchJson<
      { id: string; date: string; proatividade: number; trabalhoEquipe: number; comunicacao: number; lideranca: number; comentario: string | null }[]
    >(`/carreira/avaliacoes?userId=${userId}`),
    apiFetchJson<{ id: string; date: string; desempenho: string; potencial: string }[]>(`/carreira/nine-box?userId=${userId}`),
    apiFetchJson<
      { id: string; date: string; pauta: string; proximaData: string | null; acoes: { id: string; descricao: string; status: "pendente" | "concluido" }[] }[]
    >(`/carreira/one-on-ones?userId=${userId}`),
  ]);
  return (
    <AvaliacoesSection userId={userId} sub={sub} evaluations={evaluations} placements={placements} oneOnOnes={oneOnOnes} />
  );
}
