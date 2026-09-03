import { createCareerGoal, updateCareerGoalStatus } from "./actions";
import styles from "./gestao-carreiras.module.css";
import { StatusSelect } from "./status-select";

type CareerGoal = {
  id: string;
  tipo: "pdi" | "entrega";
  title: string;
  status: "pendente" | "andamento" | "concluida";
};

export function MetasSection({ userId, goals }: { userId: string; goals: CareerGoal[] }) {
  const pdi = goals.filter((g) => g.tipo === "pdi");
  const entregas = goals.filter((g) => g.tipo === "entrega");

  return (
    <div className={styles.section}>
      <h2>Plano de Ação (PDI)</h2>
      <GoalList goals={pdi} />
      <form action={createCareerGoal} className={styles.form}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="tipo" value="pdi" />
        <input type="text" name="title" placeholder="Nova meta de PDI" required className={styles.input} />
        <button type="submit">Adicionar</button>
      </form>

      <h2>Histórico de Entregas & Metas</h2>
      <GoalList goals={entregas} />
      <form action={createCareerGoal} className={styles.form}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="tipo" value="entrega" />
        <input type="text" name="title" placeholder="Nova entrega/meta" required className={styles.input} />
        <button type="submit">Adicionar</button>
      </form>
    </div>
  );
}

function GoalList({ goals }: { goals: CareerGoal[] }) {
  if (goals.length === 0) return <p className={styles.empty}>Nenhum item cadastrado.</p>;
  return (
    <ul className={styles.list}>
      {goals.map((goal) => (
        <li key={goal.id} className={styles.item}>
          <span>{goal.title}</span>
          <form action={updateCareerGoalStatus} className={styles.statusForm}>
            <input type="hidden" name="id" value={goal.id} />
            <StatusSelect status={goal.status} />
          </form>
        </li>
      ))}
    </ul>
  );
}
