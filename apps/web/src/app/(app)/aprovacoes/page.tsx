import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { AprovacoesAccordion } from "./aprovacoes-accordion";
import { decideAdjustment, decideAtestado, decideCompensation, decideVacation } from "./actions";
import { ApprovalSection } from "./approval-section";
import { HistorySection } from "./history-section";
import styles from "./aprovacoes.module.css";

type Atestado = {
  id: string;
  userName: string;
  dias: number | null;
  status: string;
  reviewNote: string | null;
  createdAt: string;
};

type Vacation = {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  reviewNote: string | null;
};

type Request = {
  id: string;
  userName: string;
  reason: string;
  status: string;
  reviewNote: string | null;
  createdAt: string;
};

function isDecided(status: string): status is "aprovado" | "recusado" {
  return status === "aprovado" || status === "recusado";
}

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
    apiFetchJson<Vacation[]>("/solicitacoes/ferias/todas"),
    apiFetchJson<Request[]>("/solicitacoes/ajustes/todas"),
    apiFetchJson<Request[]>("/solicitacoes/compensacoes/todas"),
  ]);

  const pendingAtestados = atestados.filter((atestado) => !isDecided(atestado.status));
  const historyAtestados = atestados.filter((atestado) => isDecided(atestado.status));
  const pendingVacations = vacations.filter((vacation) => !isDecided(vacation.status));
  const historyVacations = vacations.filter((vacation) => isDecided(vacation.status));
  const pendingAdjustments = adjustments.filter((adjustment) => !isDecided(adjustment.status));
  const historyAdjustments = adjustments.filter((adjustment) => isDecided(adjustment.status));
  const pendingCompensations = compensations.filter(
    (compensation) => !isDecided(compensation.status)
  );
  const historyCompensations = compensations.filter((compensation) =>
    isDecided(compensation.status)
  );

  const nothingAtAll =
    pendingAtestados.length === 0 &&
    historyAtestados.length === 0 &&
    pendingVacations.length === 0 &&
    historyVacations.length === 0 &&
    pendingAdjustments.length === 0 &&
    historyAdjustments.length === 0 &&
    pendingCompensations.length === 0 &&
    historyCompensations.length === 0;

  if (nothingAtAll) {
    return (
      <EmptyState
        title="Fila de aprovações"
        description="As solicitações de férias e justificativas pendentes de validação vão aparecer aqui."
      />
    );
  }

  return (
    <div className={styles.page}>
      <AprovacoesAccordion
        groups={[
          {
            key: "fila",
            label: "Fila de aprovações",
            items: [
              {
                key: "atestados",
                label: "Atestados",
                content: (
                  <ApprovalSection
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
                ),
              },
              {
                key: "ferias",
                label: "Férias",
                content: (
                  <ApprovalSection
                    emptyLabel="Nenhuma solicitação de férias pendente."
                    onDecide={decideVacation}
                    items={pendingVacations.map((vacation) => ({
                      id: vacation.id,
                      name: vacation.userName,
                      detail: `${formatDateOnly(vacation.startDate)} a ${formatDateOnly(vacation.endDate)} · ${vacation.days} dia(s)`,
                    }))}
                  />
                ),
              },
              {
                key: "ajustes",
                label: "Ajustes de ponto",
                content: (
                  <ApprovalSection
                    emptyLabel="Nenhum ajuste de ponto pendente."
                    onDecide={decideAdjustment}
                    items={pendingAdjustments.map((adjustment) => ({
                      id: adjustment.id,
                      name: adjustment.userName,
                      detail: `${adjustment.reason} · enviado em ${formatTimestamp(adjustment.createdAt)}`,
                    }))}
                  />
                ),
              },
              {
                key: "banco-de-horas",
                label: "Banco de horas",
                content: (
                  <ApprovalSection
                    emptyLabel="Nenhuma solicitação de compensação pendente."
                    onDecide={decideCompensation}
                    items={pendingCompensations.map((compensation) => ({
                      id: compensation.id,
                      name: compensation.userName,
                      detail: `${compensation.reason} · enviado em ${formatTimestamp(compensation.createdAt)}`,
                    }))}
                  />
                ),
              },
            ],
          },
          {
            key: "historico",
            label: "Histórico de aprovações",
            items: [
              {
                key: "atestados",
                label: "Atestados",
                content: (
                  <HistorySection
                    emptyLabel="Nenhum atestado decidido ainda."
                    items={historyAtestados.map((atestado) => ({
                      id: atestado.id,
                      name: atestado.userName,
                      detail: `${
                        atestado.dias != null ? `${atestado.dias} dia(s)` : "Dias não informados"
                      } · enviado em ${formatTimestamp(atestado.createdAt)}`,
                      status: atestado.status as "aprovado" | "recusado",
                      reviewNote: atestado.reviewNote,
                    }))}
                  />
                ),
              },
              {
                key: "ferias",
                label: "Férias",
                content: (
                  <HistorySection
                    emptyLabel="Nenhuma solicitação de férias decidida ainda."
                    items={historyVacations.map((vacation) => ({
                      id: vacation.id,
                      name: vacation.userName,
                      detail: `${formatDateOnly(vacation.startDate)} a ${formatDateOnly(vacation.endDate)} · ${vacation.days} dia(s)`,
                      status: vacation.status as "aprovado" | "recusado",
                      reviewNote: vacation.reviewNote,
                    }))}
                  />
                ),
              },
              {
                key: "ajustes",
                label: "Ajustes de ponto",
                content: (
                  <HistorySection
                    emptyLabel="Nenhum ajuste de ponto decidido ainda."
                    items={historyAdjustments.map((adjustment) => ({
                      id: adjustment.id,
                      name: adjustment.userName,
                      detail: `${adjustment.reason} · enviado em ${formatTimestamp(adjustment.createdAt)}`,
                      status: adjustment.status as "aprovado" | "recusado",
                      reviewNote: adjustment.reviewNote,
                    }))}
                  />
                ),
              },
              {
                key: "banco-de-horas",
                label: "Banco de horas",
                content: (
                  <HistorySection
                    emptyLabel="Nenhuma solicitação de compensação decidida ainda."
                    items={historyCompensations.map((compensation) => ({
                      id: compensation.id,
                      name: compensation.userName,
                      detail: `${compensation.reason} · enviado em ${formatTimestamp(compensation.createdAt)}`,
                      status: compensation.status as "aprovado" | "recusado",
                      reviewNote: compensation.reviewNote,
                    }))}
                  />
                ),
              },
            ],
          },
        ]}
      />
    </div>
  );
}
