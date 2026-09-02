import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";
import { PAGAMENTO_CATEGORIAS, type PagamentoCategoria } from "@ponto-dcit/shared-types";

import { PagamentoCategorySection } from "./pagamento-category-section";
import styles from "./pagamentos.module.css";

const CATEGORIA_LABEL: Record<PagamentoCategoria, string> = {
  salario: "Salário",
  auxilio_home_office: "Auxílio Home Office",
  vale_transporte: "Vale Transporte",
  vale_alimentacao: "Vale Alimentação",
};

type EmployeeRecord = {
  userId: string;
  name: string;
  role: string;
  team: string | null;
};

// Same reasoning as banco-de-horas/page.tsx's todaySaoPauloDateOnly — "what
// month is it now" follows the company's timezone, never the server's
// ambient one.
function todaySaoPauloDateOnly(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function firstDayOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

export default async function PagamentosPage() {
  const session = await getSession();
  if (!session || session.role !== "rh") {
    return (
      <EmptyState title="Sem permissão" description="Esta página é restrita ao RH." />
    );
  }

  const employees = await apiFetchJson<EmployeeRecord[]>("/employees");
  const colaboradores = employees.filter((e) => e.role === "colaborador");

  const today = todaySaoPauloDateOnly();
  const start = firstDayOfMonth(today);

  const statusByCategory = await Promise.all(
    PAGAMENTO_CATEGORIAS.map((category) =>
      apiFetchJson<{ userId: string; sentAt: string }[]>(
        `/notifications/pagamentos/status/${category}?start=${start}&end=${today}`,
      ),
    ),
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Pagamentos</h1>
      <div className={styles.categories}>
        {PAGAMENTO_CATEGORIAS.map((category, index) => (
          <PagamentoCategorySection
            key={category}
            category={category}
            label={CATEGORIA_LABEL[category]}
            colaboradores={colaboradores}
            status={statusByCategory[index]}
          />
        ))}
      </div>
    </div>
  );
}
