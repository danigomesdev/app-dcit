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

export default async function BancoDeHorasPage() {
  const session = await getSession();
  if (!session || session.role === "colaborador") {
    return (
      <EmptyState title="Sem permissão" description="Esta página é restrita a gestores e RH." />
    );
  }

  const team = await apiFetchJson<TeamSummary[]>("/banco-de-horas/equipe");

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
      <p className={styles.subheading}>Saldo do mês corrente.</p>
      <ul className={styles.list}>
        {team.map((entry) => (
          <li key={entry.userId} className={styles.item}>
            <span className={styles.itemName}>{entry.userName}</span>
            <span className={styles.itemDetail}>
              Saldo: {formatSignedMinutes(entry.balanceMinutes)} · DSR:{" "}
              {formatSignedMinutes(entry.dsrMinutes)} · Extras:{" "}
              {entry.overtimeValueBRL === null ? "—" : formatBRL(entry.overtimeValueBRL)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
