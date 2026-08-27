import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { decideAtestado, decideVacation } from "./actions";
import styles from "./aprovacoes.module.css";

type Atestado = {
  id: string;
  userName: string;
  dias: number | null;
  status: string;
  createdAt: string;
};

type PendingVacation = {
  id: string;
  userName: string;
  startDate: string;
  endDate: string;
  days: number;
};

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

// startDate/endDate are date-only values stored as UTC midnight (see
// VacationRequestInput) — formatting them in the server's local timezone
// (the default for toLocaleDateString) can shift the displayed day by one,
// e.g. UTC midnight Oct 1st renders as Sep 30th in a UTC-3 timezone. Reading
// the UTC calendar fields directly keeps the date the requester actually
// picked.
function formatDateOnly(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function AprovacoesPage() {
  const session = await getSession();
  if (!session || session.role === "colaborador") {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é restrita a gestores e RH."
      />
    );
  }

  const [atestados, vacations] = await Promise.all([
    apiFetchJson<Atestado[]>("/atestados/team"),
    apiFetchJson<PendingVacation[]>("/solicitacoes/ferias/pendentes"),
  ]);
  const pendingAtestados = atestados.filter(
    (atestado) => atestado.status !== "aprovado" && atestado.status !== "recusado"
  );

  if (pendingAtestados.length === 0 && vacations.length === 0) {
    return (
      <EmptyState
        title="Fila de aprovações"
        description="As solicitações de férias e justificativas pendentes de validação vão aparecer aqui."
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Fila de aprovações</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Atestados</h2>
        {pendingAtestados.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum atestado pendente.</p>
        ) : (
          <ul className={styles.list}>
            {pendingAtestados.map((atestado) => (
              <li key={atestado.id} className={styles.item}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{atestado.userName}</span>
                  <span className={styles.itemDetail}>
                    {atestado.dias != null ? `${atestado.dias} dia(s)` : "Dias não informados"} ·
                    enviado em {formatTimestamp(atestado.createdAt)}
                  </span>
                </div>
                <div className={styles.itemActions}>
                  <form action={decideAtestado}>
                    <input type="hidden" name="id" value={atestado.id} />
                    <input type="hidden" name="status" value="aprovado" />
                    <button type="submit" className={styles.approveButton}>
                      Aprovar
                    </button>
                  </form>
                  <form action={decideAtestado}>
                    <input type="hidden" name="id" value={atestado.id} />
                    <input type="hidden" name="status" value="recusado" />
                    <button type="submit" className={styles.rejectButton}>
                      Recusar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Férias</h2>
        {vacations.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhuma solicitação de férias pendente.</p>
        ) : (
          <ul className={styles.list}>
            {vacations.map((vacation) => (
              <li key={vacation.id} className={styles.item}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{vacation.userName}</span>
                  <span className={styles.itemDetail}>
                    {formatDateOnly(vacation.startDate)} a {formatDateOnly(vacation.endDate)} ·{" "}
                    {vacation.days} dia(s)
                  </span>
                </div>
                <div className={styles.itemActions}>
                  <form action={decideVacation}>
                    <input type="hidden" name="id" value={vacation.id} />
                    <input type="hidden" name="status" value="aprovado" />
                    <button type="submit" className={styles.approveButton}>
                      Aprovar
                    </button>
                  </form>
                  <form action={decideVacation}>
                    <input type="hidden" name="id" value={vacation.id} />
                    <input type="hidden" name="status" value="recusado" />
                    <button type="submit" className={styles.rejectButton}>
                      Recusar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
