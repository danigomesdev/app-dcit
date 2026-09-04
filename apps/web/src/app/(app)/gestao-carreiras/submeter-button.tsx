"use client";

import { decidirCareerEvaluation } from "./actions";
import styles from "./gestao-carreiras.module.css";

// Own Client Component for the one interactive bit this screen needs — same
// reasoning as ColaboradorSelect/AcaoStatusSelect: everything else here is a
// plain server-rendered form, but confirming a promotion before it's
// committed needs a client-side confirm() gate in front of the submit.
export function SubmeterButton({
  evaluationId,
  elegivel,
  proximoNivelLabel,
  colaboradorNome,
}: {
  evaluationId: string;
  elegivel: boolean;
  proximoNivelLabel: string | null;
  colaboradorNome: string;
}) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (elegivel && proximoNivelLabel) {
      const confirmado = window.confirm(`Confirmar promoção de ${colaboradorNome} para ${proximoNivelLabel}?`);
      if (!confirmado) {
        event.preventDefault();
      }
    }
  }

  return (
    <form action={decidirCareerEvaluation} onSubmit={handleSubmit}>
      <input type="hidden" name="id" value={evaluationId} />
      <input type="hidden" name="confirmarPromocao" value={elegivel ? "true" : "false"} />
      <button type="submit" className={styles.saveButton}>
        Submeter para Decisão da Diretoria
      </button>
    </form>
  );
}
