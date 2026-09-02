"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";

import { runAtestadoOcr, submitAtestado } from "./actions";
import { PhotoUploadField, type PickedPhoto } from "./photo-upload-field";
import styles from "./documentos.module.css";

type OcrStatus = "idle" | "loading" | "done" | "error";

export function AtestadoForm() {
  const [cid, setCid] = useState("");
  const [crm, setCrm] = useState("");
  const [medico, setMedico] = useState("");
  const [dias, setDias] = useState("");
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle");

  async function handlePhotoPicked(picked: PickedPhoto) {
    setOcrStatus("loading");
    const result = await runAtestadoOcr(picked.base64, picked.mediaType);
    if (!result) {
      setOcrStatus("error");
      return;
    }
    if (result.cid) setCid(result.cid);
    if (result.crm) setCrm(result.crm);
    if (result.medico) setMedico(result.medico);
    if (result.dias) setDias(String(result.dias));
    setOcrStatus("done");
  }

  return (
    <form
      className={styles.form}
      action={async (formData) => {
        await submitAtestado(formData);
        setCid("");
        setCrm("");
        setMedico("");
        setDias("");
        setOcrStatus("idle");
      }}
    >
      <PhotoUploadField
        name="photo"
        label="Foto do atestado (opcional)"
        onPicked={handlePhotoPicked}
      />

      {ocrStatus !== "idle" ? (
        <p className={styles.ocrStatus}>
          {ocrStatus === "loading"
            ? "Lendo o atestado automaticamente…"
            : ocrStatus === "done"
              ? "Dados preenchidos automaticamente — confira antes de enviar."
              : "Não foi possível ler automaticamente — preencha os dados abaixo manualmente."}
        </p>
      ) : null}

      <label htmlFor="cid">CID</label>
      <input
        id="cid"
        name="cid"
        type="text"
        value={cid}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setCid(event.target.value)}
        className={styles.textInput}
        required
      />
      <label htmlFor="crm">CRM do médico</label>
      <input
        id="crm"
        name="crm"
        type="text"
        value={crm}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setCrm(event.target.value)}
        className={styles.textInput}
        required
      />
      <label htmlFor="medico">Nome do médico</label>
      <input
        id="medico"
        name="medico"
        type="text"
        value={medico}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setMedico(event.target.value)}
        className={styles.textInput}
        required
      />
      <label htmlFor="dias">Quantidade de dias</label>
      <input
        id="dias"
        name="dias"
        type="number"
        min="1"
        step="1"
        value={dias}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setDias(event.target.value)}
        className={styles.textInput}
        required
      />

      <button type="submit" className={styles.submitButton}>
        Enviar
      </button>
    </form>
  );
}
