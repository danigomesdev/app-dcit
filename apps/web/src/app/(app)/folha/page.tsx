import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { ExportarPdfButton } from "./exportar-pdf-button";
import styles from "./folha.module.css";

type TimeEntry = { id: string; clockedAt: string };
type DayRow = { day: string; label: string; workedMinutes: number; isOpen: boolean };

// Same reasoning as apps/web/src/app/(app)/meu-ponto-card.tsx's
// dateOnlyInSaoPaulo (colocated copy, not a shared import).
function dateOnlyInSaoPaulo(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

function formatDayLabel(day: string): string {
  return new Date(`${day}T00:00:00-03:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

// Pairs over the *entire* chronological history before attributing minutes
// to a day — never buckets entries by day first (see this plan's Global
// Constraints; commit 8dc3fa1 fixed the same class of bug on the punch
// card). A completed pair's minutes count toward the São Paulo date its
// *end* falls on. At most one trailing entry can ever be unpaired (a
// linear alternating stream can't have two), so there's at most one open
// day.
function groupByDay(entries: TimeEntry[]): DayRow[] {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.clockedAt).getTime() - new Date(b.clockedAt).getTime(),
  );

  const minutesByDay = new Map<string, number>();
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    const start = new Date(sorted[i].clockedAt).getTime();
    const end = new Date(sorted[i + 1].clockedAt).getTime();
    const day = dateOnlyInSaoPaulo(new Date(sorted[i + 1].clockedAt));
    minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + (end - start) / 60000);
  }

  const openDay =
    sorted.length % 2 === 1 ? dateOnlyInSaoPaulo(new Date(sorted[sorted.length - 1].clockedAt)) : null;
  if (openDay !== null && !minutesByDay.has(openDay)) {
    minutesByDay.set(openDay, 0);
  }

  return [...minutesByDay.entries()]
    .map(([day, minutes]) => ({
      day,
      label: formatDayLabel(day),
      workedMinutes: Math.round(minutes),
      isOpen: day === openDay,
    }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
}

export default async function FolhaPage() {
  const session = await getSession();
  if (!session || session.role !== "colaborador") {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é pessoal, restrita a colaboradores."
      />
    );
  }

  const entries = await apiFetchJson<TimeEntry[]>("/time-entries");
  const days = groupByDay(entries);

  if (days.length === 0) {
    return (
      <EmptyState
        title="Folha de ponto"
        description="Nenhum dia registrado ainda."
      />
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <h1 className={styles.heading}>Folha de ponto</h1>
        <ExportarPdfButton />
      </div>
      <ul className={styles.list}>
        {days.map((row) => (
          <li key={row.day} className={styles.item}>
            <span className={styles.itemDate}>{row.label}</span>
            <span className={styles.itemHours}>
              {formatMinutes(row.workedMinutes)}
              {row.isOpen ? " · ponto em aberto" : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
