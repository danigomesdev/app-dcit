"use client";

import { useRef } from "react";

import { deleteConvencao } from "./actions";
import { EditarConvencaoDialog } from "./editar-convencao-dialog";
import styles from "./convencoes.module.css";

type Convencao = {
  id: string;
  nome: string;
  cnpj: string | null;
  categoriaSindical: string | null;
  expectedDailyMinutes: number;
  overtimePercent: number;
};

function formatJornada(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

export function ConvencoesRow({ convencao }: { convencao: Convencao }) {
  const confirmDeleteRef = useRef<HTMLDialogElement>(null);

  return (
    <li className={styles.item}>
      <span className={styles.itemName}>{convencao.nome}</span>
      <span className={styles.itemDetail}>
        {formatJornada(convencao.expectedDailyMinutes)} · {convencao.overtimePercent}% hora extra
        {convencao.categoriaSindical ? ` · ${convencao.categoriaSindical}` : ""}
      </span>
      <EditarConvencaoDialog convencao={convencao} />
      <button
        type="button"
        className={styles.deleteButton}
        onClick={() => confirmDeleteRef.current?.showModal()}
      >
        Excluir
      </button>

      <dialog ref={confirmDeleteRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Excluir {convencao.nome}?</p>
        <p className={styles.subheading}>
          Esta ação não pode ser desfeita. Colaboradores vinculados a esta convenção ficam sem
          convenção.
        </p>
        <form action={deleteConvencao}>
          <input type="hidden" name="id" value={convencao.id} />
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={styles.dialogClose}
              onClick={() => confirmDeleteRef.current?.close()}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.deleteButton}>
              Excluir
            </button>
          </div>
        </form>
      </dialog>
    </li>
  );
}
