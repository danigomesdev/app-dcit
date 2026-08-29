"use client";

import { useRef } from "react";

import { permanentlyDeleteEmployee, restoreEmployee } from "./actions";
import styles from "./colaboradores.module.css";

type TrashedEmployee = {
  userId: string;
  name: string;
  deletedAt: string;
};

export function LixeiraRow({ employee }: { employee: TrashedEmployee }) {
  const confirmPermanentRef = useRef<HTMLDialogElement>(null);

  return (
    <li className={styles.item}>
      <span className={styles.itemName}>{employee.name}</span>
      <form action={restoreEmployee}>
        <input type="hidden" name="userId" value={employee.userId} />
        <button type="submit" className={styles.saveButton}>
          Restaurar
        </button>
      </form>
      <button
        type="button"
        className={styles.deleteButton}
        onClick={() => confirmPermanentRef.current?.showModal()}
      >
        Excluir permanentemente
      </button>

      <dialog ref={confirmPermanentRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Excluir {employee.name} permanentemente?</p>
        <p className={styles.subheading}>Essa ação não pode ser desfeita.</p>
        <form action={permanentlyDeleteEmployee}>
          <input type="hidden" name="userId" value={employee.userId} />
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={styles.dialogClose}
              onClick={() => confirmPermanentRef.current?.close()}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.deleteButton}>
              Excluir permanentemente
            </button>
          </div>
        </form>
      </dialog>
    </li>
  );
}
