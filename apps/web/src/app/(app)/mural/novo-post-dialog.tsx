"use client";

import { useActionState, useEffect, useRef } from "react";

import { createMuralPost } from "./actions";
import styles from "./mural.module.css";

export function NovoPostDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createMuralPost, {
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
        + Novo post
      </button>

      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Novo post no mural</p>
        <form ref={formRef} action={formAction}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Emoji</span>
            <input type="text" name="glyph" required maxLength={4} placeholder="🎉" className={styles.fieldInput} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Título</span>
            <input type="text" name="title" required className={styles.fieldInput} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Mensagem</span>
            <textarea name="body" required className={styles.fieldTextarea} />
          </label>
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
              Publicar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
