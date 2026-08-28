import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { ColaboradoresRow } from "./colaboradores-row";
import styles from "./colaboradores.module.css";

type Employee = {
  userId: string;
  name: string;
  expectedStartTime: string | null;
};

export default async function ColaboradoresPage() {
  const session = await getSession();
  if (!session || session.role !== "rh") {
    return <EmptyState title="Sem permissão" description="Esta página é restrita ao RH." />;
  }

  const employees = await apiFetchJson<Employee[]>("/employees");

  if (employees.length === 0) {
    return (
      <EmptyState title="Colaboradores" description="Nenhum colaborador cadastrado ainda." />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Colaboradores</h1>
      <p className={styles.subheading}>
        Defina o horário esperado de entrada de cada colaborador — usado para marcá-lo como
        atrasado no painel de presença.
      </p>
      <ul className={styles.list}>
        {employees.map((employee) => (
          <ColaboradoresRow key={employee.userId} employee={employee} />
        ))}
      </ul>
    </div>
  );
}
