"use client";

import { useActionState, useEffect, useRef } from "react";

import { updateHolerite } from "./actions";
import { HoleriteFormFields, type HoleriteFormDefaults } from "./holerite-form-fields";
import styles from "./holerites.module.css";

type Holerite = {
  id: string;
  label: string;
  gross: number;
  inss: number;
  irrf: number;
  benefits: number;
};

export function EditarHoleriteDialog({ holerite }: { holerite: Holerite }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(updateHolerite, {
    error: null,
    success: false,
    successToken: 0,
  });

  useEffect(() => {
    if (state.success) {
      dialogRef.current?.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.successToken]);

  const defaults: HoleriteFormDefaults = {
    label: holerite.label,
    gross: holerite.gross,
    inss: holerite.inss,
    irrf: holerite.irrf,
    benefits: holerite.benefits,
  };

  return (
    <>
      <button
        type="button"
        className={styles.saveButton}
        onClick={() => dialogRef.current?.showModal()}
      >
        Editar
      </button>

      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Editar {holerite.label}</p>
        <form ref={formRef} action={formAction}>
          <input type="hidden" name="id" value={holerite.id} />
          <HoleriteFormFields defaults={defaults} />
          {state.error ? <span className={styles.error}>{state.error}</span> : null}
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={styles.dialogClose}
              onClick={() => {
                dialogRef.current?.close();
                formRef.current?.reset();
              }}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.saveButton} disabled={pending}>
              Salvar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
