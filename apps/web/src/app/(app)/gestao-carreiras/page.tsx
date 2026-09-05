import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { AvaliacaoCarreiraSection } from "./avaliacao-carreira-section";
import { ColaboradorSelect } from "./colaborador-select";
import styles from "./gestao-carreiras.module.css";

type Employee = { userId: string; name: string; nivel: string | null; salarioMensal: number | null };

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
  const userId = typeof params.userId === "string" ? params.userId : undefined;

  const employees = await apiFetchJson<Employee[]>("/employees");

  return (
    <div className={styles.page}>
      <h1>Avaliação de Carreira</h1>
      <form className={styles.selector}>
        <label htmlFor="userId">Colaborador</label>
        <ColaboradorSelect employees={employees} userId={userId ?? ""} />
      </form>

      {!userId ? (
        <EmptyState title="Selecione um colaborador" description="Escolha um colaborador acima para ver sua carreira." />
      ) : (
        <AvaliacaoCarreiraTab userId={userId} employees={employees} />
      )}
    </div>
  );
}

async function AvaliacaoCarreiraTab({ userId, employees }: { userId: string; employees: Employee[] }) {
  const colaborador = employees.find((e) => e.userId === userId);
  const [promotabilidade, evaluation] = await Promise.all([
    apiFetchJson<{ mesesDeCasa: number }>(`/carreira/promotabilidade/${userId}`),
    apiFetchJson<{
      id: string;
      status: string;
      resultado: string | null;
      decidedAt: string | null;
      mediaGeral: number | null;
      proximoNivel: string | null;
      principios: { principio: string; nota: number; justificativa: string | null }[];
      competencias: { competencia: string; nota: number; justificativa: string | null }[];
      requisitos: { tipo: "obrigatorio" | "eletivo"; label: string; atendido: boolean }[];
    } | null>(`/carreira/evaluations?userId=${userId}`),
  ]);
  return (
    <AvaliacaoCarreiraSection
      userId={userId}
      colaboradorNome={colaborador?.name ?? ""}
      nivel={colaborador?.nivel ?? null}
      salarioMensal={colaborador?.salarioMensal ?? null}
      mesesDeCasa={promotabilidade.mesesDeCasa}
      evaluation={evaluation}
    />
  );
}
