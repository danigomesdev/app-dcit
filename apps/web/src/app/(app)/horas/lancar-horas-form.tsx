import { lancarHoras } from "./actions";
import styles from "./horas.module.css";

type Employee = { userId: string; name: string };

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

export function LancarHorasForm({ employees }: { employees: Employee[] }) {
  return (
    <form action={lancarHoras} className={styles.form}>
      <h2 className={styles.sectionTitle}>Lançar horas</h2>
      <label className={styles.field}>
        Colaborador
        <select name="userId" required defaultValue="" className={styles.input}>
          <option value="" disabled>
            Selecione
          </option>
          {employees.map((employee) => (
            <option key={employee.userId} value={employee.userId}>
              {employee.name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Data
        <input type="date" name="date" required defaultValue={todaySaoPauloDateOnly()} className={styles.input} />
      </label>
      <label className={styles.field}>
        Horas trabalhadas
        <input type="number" name="horasTrabalhadas" min={0} step={0.5} required className={styles.input} />
      </label>
      <label className={styles.field}>
        Horas em tickets
        <input type="number" name="horasTickets" min={0} step={0.5} required className={styles.input} />
      </label>
      <button type="submit" className={styles.submitButton}>
        Lançar
      </button>
    </form>
  );
}
