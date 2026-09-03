"use client";

import { useRef } from "react";

import styles from "./aprovacoes.module.css";

type ApprovalItem = {
  id: string;
  name: string;
  detail: string;
};

function RejectButton({
  id,
  onDecide,
}: {
  id: string;
  onDecide: (formData: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className={styles.rejectButton}
        onClick={() => dialogRef.current?.showModal()}
      >
        Recusar
      </button>
      <dialog ref={dialogRef} className={styles.dialog}>
        <form action={onDecide}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="recusado" />
          <p className={styles.dialogTitle}>Justificar recusa</p>
          <label className={styles.dialogLabel} htmlFor={`reviewNote-${id}`}>
            Motivo da recusa
          </label>
          <textarea
            id={`reviewNote-${id}`}
            name="reviewNote"
            className={styles.dialogTextarea}
            rows={3}
            required
            minLength={1}
          />
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={styles.dialogCancel}
              onClick={() => dialogRef.current?.close()}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.dialogConfirm}>
              Confirmar recusa
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function ApprovalSection({
  title,
  emptyLabel,
  items,
  onDecide,
}: {
  title?: string;
  emptyLabel: string;
  items: ApprovalItem[];
  onDecide: (formData: FormData) => Promise<void>;
}) {
  return (
    <section className={styles.section}>
      {title ? <h2 className={styles.sectionTitle}>{title}</h2> : null}
      {items.length === 0 ? (
        <p className={styles.sectionEmpty}>{emptyLabel}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.itemDetail}>{item.detail}</span>
              </div>
              <div className={styles.itemActions}>
                <form action={onDecide}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="status" value="aprovado" />
                  <button type="submit" className={styles.approveButton}>
                    Aprovar
                  </button>
                </form>
                <RejectButton id={item.id} onDecide={onDecide} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
