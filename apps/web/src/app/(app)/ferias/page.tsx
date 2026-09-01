import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import styles from "./ferias.module.css";

type VacationRequestRecord = {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  status: "pendente" | "aprovado" | "recusado";
  reviewNote: string | null;
};

type VacationHistoryRecord = {
  id: string;
  year: number;
  startDate: string;
  endDate: string;
  daysTaken: number;
};

type FeriasData = {
  requests: VacationRequestRecord[];
  hireDate: string | null;
  history: VacationHistoryRecord[];
};

// Illustrative only — no payroll/HR accrual engine exists yet, same caveat
// as apps/mobile/src/lib/ferias.ts AVAILABLE_DAYS. CLT gives 30 days/year;
// this is not computed from real absence/accrual data.
const AVAILABLE_DAYS = 22;

const VENCIMENTO_ALERT_THRESHOLD_DAYS = 90;

// Fallback used only when hireDate is null (no Employee row) — same
// fallback constant as apps/mobile/src/lib/ferias.ts HIRE_DATE.
const FALLBACK_HIRE_DATE = "2024-03-15";

// Same "explicit America/Sao_Paulo" reasoning as banco-de-horas/page.tsx's
// todaySaoPauloDateOnly: "which day is it right now" must follow the
// company's timezone, not the server's ambient one.
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

function addYearsToDateOnly(dateStr: string, years: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${(year + years).toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

type VacationCycle = { aquisitivoInicio: string; aquisitivoFim: string; vencimento: string };

const STATUS_LABEL: Record<VacationRequestRecord["status"], string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

// CLT gives 12 months to accrue vacation (período aquisitivo), then another
// 12 months to take it (período concessivo) before the employer risks
// paying it in double. Walks forward from hireDate to the cycle whose
// concessive deadline hasn't passed yet — same rule as
// apps/mobile/src/lib/ferias.ts currentVacationCycle, reimplemented on
// date-only strings instead of Date objects.
function currentVacationCycle(hireDate: string, today: string): VacationCycle {
  let n = 0;
  while (addYearsToDateOnly(hireDate, n + 2) <= today) {
    n++;
  }
  return {
    aquisitivoInicio: addYearsToDateOnly(hireDate, n),
    aquisitivoFim: addYearsToDateOnly(hireDate, n + 1),
    vencimento: addYearsToDateOnly(hireDate, n + 2),
  };
}

function daysUntil(dateStr: string, today: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const target = new Date(`${dateStr}T00:00:00.000Z`).getTime();
  const from = new Date(`${today}T00:00:00.000Z`).getTime();
  return Math.ceil((target - from) / msPerDay);
}

// Date-only values are stored as UTC midnight — format in UTC so the
// displayed date never shifts by one due to São Paulo being behind UTC
// (same reasoning as formatMonthLabel/formatDayLabel in banco-de-horas's
// page.tsx). Only "what day is it right now" (todaySaoPauloDateOnly above)
// needs the America/Sao_Paulo timezone; formatting an already-resolved
// date-only string does not.
function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00.000Z`).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  });
}

export default async function FeriasPage() {
  const session = await getSession();
  if (!session || session.role !== "colaborador") {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é pessoal, restrita a colaboradores."
      />
    );
  }

  const data = await apiFetchJson<FeriasData>("/solicitacoes/ferias");
  const today = todaySaoPauloDateOnly();
  const cycle = currentVacationCycle(data.hireDate ?? FALLBACK_HIRE_DATE, today);
  const diasParaVencimento = daysUntil(cycle.vencimento, today);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Férias</h1>

      <div className={styles.balanceCard}>
        <span className={styles.balanceValue}>{AVAILABLE_DAYS} dias disponíveis</span>
        <span className={styles.balanceDetail}>
          Período aquisitivo: {formatDate(cycle.aquisitivoInicio)} — {formatDate(cycle.aquisitivoFim)}
        </span>
        <span className={styles.balanceDetail}>Vencem em {formatDate(cycle.vencimento)}</span>
      </div>

      {diasParaVencimento <= VENCIMENTO_ALERT_THRESHOLD_DAYS ? (
        <div className={styles.alertBanner}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 9v4M12 17h.01M10.29 3.86l-8.18 14.18A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-2.96L13.71 3.86a2 2 0 0 0-3.42 0z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            Suas férias vencem em {diasParaVencimento} dias. Agende antes do prazo para evitar o
            pagamento em dobro.
          </span>
        </div>
      ) : null}

      <h2 className={styles.sectionTitle}>Minhas solicitações</h2>
      {data.requests.length === 0 ? (
        <p className={styles.sectionEmpty}>Nenhuma solicitação registrada ainda.</p>
      ) : (
        <ul className={styles.list}>
          {data.requests.map((request) => (
            <li key={request.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>
                  {formatDate(request.startDate)} — {formatDate(request.endDate)}
                </span>
                <span className={styles.itemDetail}>{request.days} dia(s)</span>
                {request.reviewNote ? (
                  <span className={styles.itemNote}>{request.reviewNote}</span>
                ) : null}
              </div>
              <span
                className={`${styles.status} ${
                  request.status === "aprovado" ? styles.statusAprovado : ""
                } ${request.status === "recusado" ? styles.statusRecusado : ""}`}
              >
                {STATUS_LABEL[request.status]}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 className={styles.sectionTitle}>Histórico de férias</h2>
      {data.history.length === 0 ? (
        <p className={styles.sectionEmpty}>Nenhum período de férias registrado ainda.</p>
      ) : (
        <ul className={styles.list}>
          {data.history.map((entry) => (
            <li key={entry.id} className={styles.item}>
              <span className={styles.historyYear}>{entry.year}</span>
              <span className={styles.itemDetail}>
                {formatDate(entry.startDate)} — {formatDate(entry.endDate)} · {entry.daysTaken} dias
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
