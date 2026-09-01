import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import styles from "./banco-de-horas.module.css";

type TeamSummary = {
  userId: string;
  userName: string;
  balanceMinutes: number;
  dsrMinutes: number;
  hourlyRateBRL: number | null;
  overtimeValueBRL: number | null;
};

type DailySummary = { date: string; expectedMinutes: number; workedMinutes: number; diffMinutes: number };
type MinhaSummary = {
  days: DailySummary[];
  balanceMinutes: number;
  dsrMinutes: number;
  hourlyRateBRL: number | null;
  overtimeValueBRL: number | null;
};
type Periodo = "atual" | "anterior" | "3meses";

// Duplicated (not imported from a shared package) — these are two tiny pure
// functions, not worth a new shared-types entry; the same trade-off already
// made for CARGOS/NIVEIS in colaborador-form-fields.tsx.
function formatSignedMinutes(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? "-" : "+";
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${sign}${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value: string): boolean {
  return DATE_ONLY.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

// Same "explicit America/Sao_Paulo" reasoning as the Escala page's
// todaySaoPauloDateOnly: "which month is it right now" must follow the
// company's timezone, not the server's ambient one (often UTC in
// production) nor a naive local Date.
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

function lastDayOfMonth(dateStr: string): string {
  const date = new Date(`${firstDayOfMonth(dateStr)}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function addMonths(dateStr: string, months: number): string {
  const date = new Date(`${firstDayOfMonth(dateStr)}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

// Date-only values are stored as UTC midnight — format in UTC so the
// displayed month never shifts by one due to the server's local timezone
// (same reasoning as formatDateBR in the Escala page).
function formatMonthLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00.000Z`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

function formatDayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00.000Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

function resolvePeriodo(value: string | undefined): Periodo {
  return value === "anterior" || value === "3meses" ? value : "atual";
}

function periodoRange(periodo: Periodo): { start: string; end: string } {
  const today = todaySaoPauloDateOnly();
  const currentMonthStart = firstDayOfMonth(today);
  if (periodo === "atual") {
    return { start: currentMonthStart, end: today };
  }
  if (periodo === "anterior") {
    const start = addMonths(currentMonthStart, -1);
    return { start, end: lastDayOfMonth(start) };
  }
  return { start: addMonths(currentMonthStart, -2), end: today };
}

const PERIODO_LABEL: Record<Periodo, string> = {
  atual: "Mês atual",
  anterior: "Mês anterior",
  "3meses": "Últimos 3 meses",
};

export default async function BancoDeHorasPage({ searchParams }: PageProps<"/banco-de-horas">) {
  const session = await getSession();
  if (!session) {
    return <EmptyState title="Sem permissão" description="Faça login para continuar." />;
  }
  if (session.role === "colaborador") {
    return <ColaboradorView searchParams={await searchParams} />;
  }
  return <TeamView searchParams={await searchParams} />;
}

async function TeamView({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { start: startParam } = searchParams;
  const today = todaySaoPauloDateOnly();
  const currentMonthStart = firstDayOfMonth(today);
  const requestedStart =
    typeof startParam === "string" && isValidDateOnly(startParam)
      ? firstDayOfMonth(startParam)
      : currentMonthStart;
  // Never navigate into a future month — clamp forward requests back to the
  // current month, matching the API's own "never a future date" rule.
  const start = requestedStart > currentMonthStart ? currentMonthStart : requestedStart;
  const isCurrentMonth = start === currentMonthStart;
  const end = isCurrentMonth ? today : lastDayOfMonth(start);
  const prevMonthStart = addMonths(start, -1);
  const nextMonthStart = addMonths(start, 1);

  const team = await apiFetchJson<TeamSummary[]>(
    `/banco-de-horas/equipe?start=${start}&end=${end}`,
  );

  if (team.length === 0) {
    return (
      <EmptyState
        title="Banco de Horas"
        description="O saldo de banco de horas da equipe vai aparecer aqui."
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Banco de Horas</h1>

      <nav className={styles.periodNav}>
        <a className={styles.periodNavLink} href={`/banco-de-horas?start=${prevMonthStart}`}>
          ← Mês anterior
        </a>
        <span className={styles.periodRange}>Saldo de {formatMonthLabel(start)}</span>
        {isCurrentMonth ? null : (
          <a className={styles.periodNavLink} href={`/banco-de-horas?start=${nextMonthStart}`}>
            Próximo mês →
          </a>
        )}
      </nav>

      <ul className={styles.list}>
        {team.map((entry) => (
          <li key={entry.userId} className={styles.item}>
            <span className={styles.itemName}>{entry.userName}</span>
            <span className={styles.itemDetail}>
              Valor-hora:{" "}
              {entry.hourlyRateBRL === null ? "—" : formatBRL(entry.hourlyRateBRL)} · Saldo:{" "}
              {formatSignedMinutes(entry.balanceMinutes)} · DSR:{" "}
              {formatSignedMinutes(entry.dsrMinutes)} · Extras:{" "}
              {entry.overtimeValueBRL === null ? "—" : formatBRL(entry.overtimeValueBRL)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function ColaboradorView({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const periodoParam = searchParams.periodo;
  const periodo = resolvePeriodo(typeof periodoParam === "string" ? periodoParam : undefined);
  const { start, end } = periodoRange(periodo);

  const summary = await apiFetchJson<MinhaSummary>(
    `/banco-de-horas/minhas?start=${start}&end=${end}`,
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Banco de Horas</h1>

      <div className={styles.periodTabs}>
        {(["atual", "anterior", "3meses"] as const).map((option) => (
          <a
            key={option}
            className={
              periodo === option ? `${styles.periodTab} ${styles.periodTabActive}` : styles.periodTab
            }
            href={`/banco-de-horas?periodo=${option}`}
          >
            {PERIODO_LABEL[option]}
          </a>
        ))}
      </div>

      <div className={styles.summaryCard}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Saldo</span>
          <span className={styles.summaryValue}>{formatSignedMinutes(summary.balanceMinutes)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>DSR estimado</span>
          <span className={styles.summaryValue}>{formatSignedMinutes(summary.dsrMinutes)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Valor-hora</span>
          <span className={styles.summaryValue}>
            {summary.hourlyRateBRL === null ? "—" : formatBRL(summary.hourlyRateBRL)}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Extras em R$</span>
          <span className={styles.summaryValue}>
            {summary.overtimeValueBRL === null ? "—" : formatBRL(summary.overtimeValueBRL)}
          </span>
        </div>
      </div>

      <ul className={styles.list}>
        {summary.days.map((day) => (
          <li key={day.date} className={styles.item}>
            <span className={styles.itemName}>{formatDayLabel(day.date)}</span>
            <span className={styles.itemDetail}>
              Previsto: {formatMinutes(day.expectedMinutes)} · Trabalhado:{" "}
              {formatMinutes(day.workedMinutes)} · Diferença: {formatSignedMinutes(day.diffMinutes)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
