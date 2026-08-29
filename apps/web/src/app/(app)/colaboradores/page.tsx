import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { ColaboradoresRow } from "./colaboradores-row";
import { LixeiraSection } from "./lixeira-section";
import { NovoColaboradorDialog } from "./novo-colaborador-dialog";
import styles from "./colaboradores.module.css";

type Employee = {
  userId: string;
  name: string;
  role: "colaborador" | "gestor" | "rh";
  hireDate: string;
  expectedStartTime: string | null;
  cpf: string | null;
  rg: string | null;
  dataNascimento: string | null;
  estadoCivil: string | null;
  enderecoRua: string | null;
  enderecoNumero: string | null;
  enderecoBairro: string | null;
  enderecoCidade: string | null;
  enderecoEstado: string | null;
  enderecoCep: string | null;
};

export default async function ColaboradoresPage() {
  const session = await getSession();
  if (!session || session.role !== "rh") {
    return <EmptyState title="Sem permissão" description="Esta página é restrita ao RH." />;
  }

  const employees = await apiFetchJson<Employee[]>("/employees");

  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <h1 className={styles.heading}>Colaboradores</h1>
        <NovoColaboradorDialog />
      </div>
      <p className={styles.subheading}>
        Defina o horário esperado de entrada de cada colaborador — usado para marcá-lo como
        atrasado no painel de presença.
      </p>
      {employees.length === 0 ? (
        <p className={styles.subheading}>Nenhum colaborador cadastrado ainda.</p>
      ) : (
        <ul className={styles.list}>
          {employees.map((employee) => (
            <ColaboradoresRow key={employee.userId} employee={employee} />
          ))}
        </ul>
      )}
      <LixeiraSection />
    </div>
  );
}
