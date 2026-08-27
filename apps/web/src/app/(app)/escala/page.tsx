import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { addShift, removeShift } from "./actions";
import styles from "./escala.module.css";

type Shift = {
  id: string;
  date: string;
  label: string;
  userId: string;
  userName: string;
};

type Employee = {
  userId: string;
  name: string;
};

const DAY_LABELS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

function mondayOfCurrentWeek(): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Date-only values are stored as UTC midnight — format in UTC so the
// displayed day never shifts by one due to the server's local timezone
// (same reasoning as apps/web/src/app/(app)/aprovacoes/page.tsx's
// formatDateOnly).
function formatDateBR(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00.000Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function EscalaPage({ searchParams }: PageProps<"/escala">) {
  const session = await getSession();
  if (!session || session.role === "colaborador") {
    return (
      <EmptyState title="Sem permissão" description="Esta página é restrita a gestores e RH." />
    );
  }

  const { start: startParam } = await searchParams;
  const start = typeof startParam === "string" ? startParam : mondayOfCurrentWeek();
  const end = addDays(start, 6);
  const prevWeek = addDays(start, -7);
  const nextWeek = addDays(start, 7);

  const [shifts, employees] = await Promise.all([
    apiFetchJson<Shift[]>(`/operacional/escala?start=${start}&end=${end}`),
    apiFetchJson<Employee[]>("/employees"),
  ]);

  const days = DAY_LABELS.map((label, index) => {
    const date = addDays(start, index);
    return {
      label,
      date,
      shifts: shifts.filter((shift) => shift.date.slice(0, 10) === date),
    };
  });

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Escala de plantão</h1>

      <nav className={styles.weekNav}>
        <a className={styles.weekNavLink} href={`/escala?start=${prevWeek}`}>
          ← Semana anterior
        </a>
        <span className={styles.weekRange}>
          {formatDateBR(start)} a {formatDateBR(end)}
        </span>
        <a className={styles.weekNavLink} href={`/escala?start=${nextWeek}`}>
          Próxima semana →
        </a>
      </nav>

      <div className={styles.days}>
        {days.map((day) => (
          <section key={day.date} className={styles.day}>
            <h2 className={styles.dayTitle}>
              {day.label} · {formatDateBR(day.date)}
            </h2>
            {day.shifts.length > 0 ? (
              <ul className={styles.shiftList}>
                {day.shifts.map((shift) => (
                  <li key={shift.id} className={styles.shiftItem}>
                    <span>
                      <strong>{shift.label}:</strong> {shift.userName}
                    </span>
                    <form action={removeShift}>
                      <input type="hidden" name="id" value={shift.id} />
                      <button type="submit" className={styles.removeButton}>
                        Remover
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}
            <form action={addShift} className={styles.addForm}>
              <input type="hidden" name="date" value={day.date} />
              <input
                type="text"
                name="label"
                placeholder="Rótulo (ex: Manhã)"
                required
                className={styles.labelInput}
              />
              <select name="userId" required className={styles.select} defaultValue="">
                <option value="" disabled>
                  Escolha um funcionário
                </option>
                {employees.map((employee) => (
                  <option key={employee.userId} value={employee.userId}>
                    {employee.name}
                  </option>
                ))}
              </select>
              <button type="submit" className={styles.addButton}>
                Adicionar
              </button>
            </form>
          </section>
        ))}
      </div>
    </div>
  );
}
