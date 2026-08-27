import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { decideAdjustment, decideAtestado, decideCompensation, decideVacation } from "./actions";
import { ApprovalSection } from "./approval-section";
import styles from "./aprovacoes.module.css";

type Atestado = {
  id: string;
  userName: string;
  dias: number | null;
  status: string;
  createdAt: string;
};

type PendingVacation = {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  days: number;
};

type PendingRequest = {
  id: string;
  userName: string;
  reason: string;
  createdAt: string;
};

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

// startDate/endDate are date-only values stored as UTC midnight (see
// VacationRequestInput) — formatting them in the server's local timezone
// (the default for toLocaleDateString) can shift the displayed day by one,
// e.g. UTC midnight Oct 1st renders as Sep 30th in a UTC-3 timezone. Reading
// the UTC calendar fields directly keeps the date the requester actually
// picked.
function formatDateOnly(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function AprovacoesPage() {
  const session = await getSession();
  if (!session || session.role === "colaborador") {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é restrita a gestores e RH."
      />
    );
  }

  const [atestados, vacations, adjustments, compensations] = await Promise.all([
    apiFetchJson<Atestado[]>("/atestados/team"),
    apiFetchJson<PendingVacation[]>("/solicitacoes/ferias/pendentes"),
    apiFetchJson<PendingRequest[]>("/solicitacoes/ajustes/pendentes"),
    apiFetchJson<PendingRequest[]>("/solicitacoes/compensacoes/pendentes"),
  ]);
  const pendingAtestados = atestados.filter(
    (atestado) => atestado.status !== "aprovado" && atestado.status !== "recusado"
  );

  const nothingPending =
    pendingAtestados.length === 0 &&
    vacations.length === 0 &&
    adjustments.length === 0 &&
    compensations.length === 0;

  if (nothingPending) {
    return (
      <EmptyState
        title="Fila de aprovações"
        description="As solicitações de férias e justificativas pendentes de validação vão aparecer aqui."
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Fila de aprovações</h1>

      <ApprovalSection
        title="Atestados"
        emptyLabel="Nenhum atestado pendente."
        onDecide={decideAtestado}
        items={pendingAtestados.map((atestado) => ({
          id: atestado.id,
          name: atestado.userName,
          detail: `${
            atestado.dias != null ? `${atestado.dias} dia(s)` : "Dias não informados"
          } · enviado em ${formatTimestamp(atestado.createdAt)}`,
        }))}
      />

      <ApprovalSection
        title="Férias"
        emptyLabel="Nenhuma solicitação de férias pendente."
        onDecide={decideVacation}
        items={vacations.map((vacation) => ({
          id: vacation.id,
          name: vacation.userName,
          detail: `${formatDateOnly(vacation.startDate)} a ${formatDateOnly(vacation.endDate)} · ${vacation.days} dia(s)`,
        }))}
      />

      <ApprovalSection
        title="Ajustes de ponto"
        emptyLabel="Nenhum ajuste de ponto pendente."
        onDecide={decideAdjustment}
        items={adjustments.map((adjustment) => ({
          id: adjustment.id,
          name: adjustment.userName,
          detail: `${adjustment.reason} · enviado em ${formatTimestamp(adjustment.createdAt)}`,
        }))}
      />

      <ApprovalSection
        title="Banco de horas"
        emptyLabel="Nenhuma solicitação de compensação pendente."
        onDecide={decideCompensation}
        items={compensations.map((compensation) => ({
          id: compensation.id,
          name: compensation.userName,
          detail: `${compensation.reason} · enviado em ${formatTimestamp(compensation.createdAt)}`,
        }))}
      />
    </div>
  );
}
