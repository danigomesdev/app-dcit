"use client";

import { useActionState, useEffect, useRef } from "react";

import { createConvencao } from "./actions";
import { ConvencaoFormFields, type ConvencaoFormDefaults } from "./convencao-form-fields";
import styles from "./convencoes.module.css";

const EMPTY_DEFAULTS: ConvencaoFormDefaults = {
  nome: "",
  cnpj: null,
  categoriaSindical: null,
  expectedDailyMinutes: null,
  overtimePercent: null,
};

export function NovaConvencaoDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createConvencao, {
    error: null,
    success: false,
    successToken: 0,
  });

  useEffect(() => {
    if (state.success) {
      dialogRef.current?.close();
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.successToken]);

  return (
    <>
      <button
        type="button"
        className={styles.addButton}
        onClick={() => dialogRef.current?.showModal()}
      >
        + Nova convenção
      </button>

      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Nova convenção coletiva</p>
        <form ref={formRef} action={formAction}>
          <ConvencaoFormFields defaults={EMPTY_DEFAULTS} />
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
              Cadastrar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
