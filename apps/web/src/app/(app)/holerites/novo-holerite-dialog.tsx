"use client";

import { useActionState, useEffect, useRef } from "react";

import { createHolerite } from "./actions";
import { HoleriteFormFields, type HoleriteFormDefaults } from "./holerite-form-fields";
import styles from "./holerites.module.css";

const EMPTY_DEFAULTS: HoleriteFormDefaults = {
  label: "",
  gross: null,
  inss: null,
  irrf: null,
  benefits: null,
};

type Employee = { userId: string; name: string };

export function NovoHoleriteDialog({ employees }: { employees: Employee[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createHolerite, {
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
        + Novo holerite
      </button>

      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Novo holerite</p>
        <form ref={formRef} action={formAction}>
          <HoleriteFormFields defaults={EMPTY_DEFAULTS} employeeSelect={employees} />
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
