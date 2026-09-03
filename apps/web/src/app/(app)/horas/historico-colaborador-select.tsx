"use client";

import styles from "./horas.module.css";

type Employee = { userId: string; name: string };

// Own Client Component for the same reason as this app's other auto-submit
// selects (see gestao-carreiras/colaborador-select.tsx): the onChange
// handler needs "use client", while page.tsx stays an async Server
// Component.
export function HistoricoColaboradorSelect({
  employees,
  colaboradorId,
}: {
  employees: Employee[];
  colaboradorId: string;
}) {
  return (
    <select
      id="colaborador"
      name="colaborador"
      defaultValue={colaboradorId}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className={styles.input}
    >
      <option value="">Nenhum</option>
      {employees.map((employee) => (
        <option key={employee.userId} value={employee.userId}>
          {employee.name}
        </option>
      ))}
    </select>
  );
}
