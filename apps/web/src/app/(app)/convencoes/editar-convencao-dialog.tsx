"use client";

import { useActionState, useEffect, useRef } from "react";

import { updateConvencao } from "./actions";
import { ConvencaoFormFields, type ConvencaoFormDefaults } from "./convencao-form-fields";
import styles from "./convencoes.module.css";

type Convencao = {
  id: string;
  nome: string;
  cnpj: string | null;
  categoriaSindical: string | null;
  expectedDailyMinutes: number;
  overtimePercent: number;
};

export function EditarConvencaoDialog({ convencao }: { convencao: Convencao }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(updateConvencao, {
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

  const defaults: ConvencaoFormDefaults = {
    nome: convencao.nome,
    cnpj: convencao.cnpj,
    categoriaSindical: convencao.categoriaSindical,
    expectedDailyMinutes: convencao.expectedDailyMinutes,
    overtimePercent: convencao.overtimePercent,
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
        <p className={styles.dialogTitle}>Editar {convencao.nome}</p>
        <form ref={formRef} action={formAction}>
          <input type="hidden" name="id" value={convencao.id} />
          <ConvencaoFormFields defaults={defaults} />
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
