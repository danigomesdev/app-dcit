"use client";

import { useRef } from "react";

import { deleteHolerite } from "./actions";
import { EditarHoleriteDialog } from "./editar-holerite-dialog";
import styles from "./holerites.module.css";

type Holerite = {
  id: string;
  userName: string;
  label: string;
  gross: number;
  inss: number;
  irrf: number;
  benefits: number;
};

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function HoleritesRow({ holerite }: { holerite: Holerite }) {
  const confirmDeleteRef = useRef<HTMLDialogElement>(null);

  return (
    <li className={styles.item}>
      <span className={styles.itemName}>
        {holerite.userName} · {holerite.label}
      </span>
      <span className={styles.itemDetail}>
        Bruto: {formatBRL(holerite.gross)} · INSS: {formatBRL(holerite.inss)} · IRRF:{" "}
        {formatBRL(holerite.irrf)} · Descontos de benefícios:{" "}
        {formatBRL(holerite.benefits)} · Líquido:{" "}
        {formatBRL(holerite.gross - holerite.inss - holerite.irrf - holerite.benefits)}
      </span>
      <EditarHoleriteDialog holerite={holerite} />
      <button
        type="button"
        className={styles.deleteButton}
        onClick={() => confirmDeleteRef.current?.showModal()}
      >
        Excluir
      </button>

      <dialog ref={confirmDeleteRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>
          Excluir o holerite de {holerite.userName} ({holerite.label})?
        </p>
        <p className={styles.subheading}>Esta ação não pode ser desfeita.</p>
        <form action={deleteHolerite}>
          <input type="hidden" name="id" value={holerite.id} />
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
