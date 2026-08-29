"use client";

import { useActionState, useEffect, useRef } from "react";

import { createEmployee } from "./actions";
import { ColaboradorFormFields, type ColaboradorFormDefaults } from "./colaborador-form-fields";
import styles from "./colaboradores.module.css";

const EMPTY_DEFAULTS: ColaboradorFormDefaults = {
  name: "",
  role: "colaborador",
  hireDate: "",
  cpf: null,
  rg: null,
  dataNascimento: null,
  estadoCivil: null,
  enderecoRua: null,
  enderecoNumero: null,
  enderecoBairro: null,
  enderecoCidade: null,
  enderecoEstado: null,
  enderecoCep: null,
};

export function NovoColaboradorDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createEmployee, {
    error: null,
    success: false,
  });

  useEffect(() => {
    if (state.success) {
      dialogRef.current?.close();
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <>
      <button
        type="button"
        className={styles.addButton}
        onClick={() => dialogRef.current?.showModal()}
      >
        + Novo colaborador
      </button>

      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Novo colaborador</p>
        <form ref={formRef} action={formAction}>
          <ColaboradorFormFields defaults={EMPTY_DEFAULTS} />
          {state.error ? <span className={styles.error}>{state.error}</span> : null}
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={styles.dialogClose}
              onClick={() => dialogRef.current?.close()}
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
