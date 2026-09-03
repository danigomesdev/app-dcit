import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { HorasChart } from "./horas-chart";
import styles from "./horas.module.css";

type HorasResumoItem = { userId: string; name: string; horasTrabalhadas: number; horasTickets: number };

const PERIODOS = ["dia", "semana", "mes"] as const;
type Periodo = (typeof PERIODOS)[number];

const PERIODO_LABEL: Record<Periodo, string> = {
  dia: "Dia",
  semana: "Semana",
  mes: "Mês",
};

function resolvePeriodo(value: string | undefined): Periodo {
  return value === "dia" || value === "semana" ? value : "mes";
}

export default async function HorasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session || session.role !== "gestor") {
    return <EmptyState title="Sem permissão" description="Esta página é restrita a gestores." />;
  }

  const params = await searchParams;
  const periodoParam = params.periodo;
  const periodo = resolvePeriodo(typeof periodoParam === "string" ? periodoParam : undefined);

  const resumo = await apiFetchJson<HorasResumoItem[]>(`/horas/resumo?periodo=${periodo}`);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Horas</h1>

      <nav className={styles.periodTabs}>
        {PERIODOS.map((option) => (
          <a
            key={option}
            className={periodo === option ? `${styles.periodTab} ${styles.periodTabActive}` : styles.periodTab}
            href={`/horas?periodo=${option}`}
          >
            {PERIODO_LABEL[option]}
          </a>
        ))}
      </nav>

      <HorasChart data={resumo} />
    </div>
  );
}
