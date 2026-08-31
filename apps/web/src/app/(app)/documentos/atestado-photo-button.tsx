"use client";

import { useRef, useState } from "react";

import { getAtestadoPhoto } from "./actions";
import styles from "./documentos.module.css";

type PhotoStatus = "idle" | "loading" | "loaded" | "empty" | "error";

export function AtestadoPhotoButton({ id }: { id: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<PhotoStatus>("idle");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  async function open() {
    dialogRef.current?.showModal();
    setStatus("loading");
    try {
      const url = await getAtestadoPhoto(id);
      setPhotoDataUrl(url);
      setStatus(url ? "loaded" : "empty");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <button type="button" className={styles.photoButton} onClick={open}>
        Ver foto
      </button>

      <dialog ref={dialogRef} className={styles.photoDialog}>
        {status === "loading" ? <p>Carregando...</p> : null}
        {status === "loaded" && photoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable remote asset
          <img src={photoDataUrl} alt="Foto do atestado" className={styles.photoImage} />
        ) : null}
        {status === "empty" ? <p>Este atestado não possui foto anexada.</p> : null}
        {status === "error" ? <p>Não foi possível carregar a foto.</p> : null}
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={() => dialogRef.current?.close()}
          >
            Fechar
          </button>
        </div>
      </dialog>
    </>
  );
}
