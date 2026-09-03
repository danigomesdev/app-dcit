import { apiFetchJson } from "@/lib/api";

import { excluirLancamento } from "./actions";
import styles from "./horas.module.css";

type Lancamento = { id: string; date: string; horasTrabalhadas: number; horasTickets: number };

// date is a full ISO instant serialized from a Prisma DateTime, not a bare
// "YYYY-MM-DD" string — new Date(value) with an explicit UTC timeZone reads
// the calendar day the gestor actually picked, matching this app's
// established formatDateOnly convention (see aprovacoes/page.tsx).
function formatDateOnly(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export async function HistoricoSection({ userId, periodo }: { userId: string; periodo: string }) {
  const lancamentos = await apiFetchJson<Lancamento[]>(`/horas?userId=${userId}&periodo=${periodo}`);

  if (lancamentos.length === 0) {
    return <p className={styles.empty}>Nenhum lançamento neste período.</p>;
  }

  return (
    <ul className={styles.list}>
      {lancamentos.map((lancamento) => (
        <li key={lancamento.id} className={styles.item}>
          <span>
            {formatDateOnly(lancamento.date)} — {lancamento.horasTrabalhadas}h trabalhadas ·{" "}
            {lancamento.horasTickets}h em tickets
          </span>
          <form action={excluirLancamento}>
            <input type="hidden" name="id" value={lancamento.id} />
            <button type="submit" className={styles.deleteButton}>
              Excluir
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
