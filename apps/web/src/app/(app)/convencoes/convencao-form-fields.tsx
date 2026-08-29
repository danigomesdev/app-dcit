"use client";

import styles from "./convencoes.module.css";

export type ConvencaoFormDefaults = {
  nome: string;
  cnpj: string | null;
  categoriaSindical: string | null;
  expectedDailyMinutes: number | null;
  overtimePercent: number | null;
};

export function ConvencaoFormFields({ defaults }: { defaults: ConvencaoFormDefaults }) {
  return (
    <div className={styles.fieldGrid}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Nome</span>
        <input
          type="text"
          name="nome"
          required
          defaultValue={defaults.nome}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>CNPJ</span>
        <input
          type="text"
          name="cnpj"
          defaultValue={defaults.cnpj ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Categoria sindical</span>
        <input
          type="text"
          name="categoriaSindical"
          defaultValue={defaults.categoriaSindical ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Jornada esperada por dia (minutos)</span>
        <input
          type="number"
          name="expectedDailyMinutes"
          required
          min="1"
          placeholder="ex: 480 = 8h"
          defaultValue={defaults.expectedDailyMinutes ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Percentual de hora extra</span>
        <input
          type="number"
          name="overtimePercent"
          required
          min="0"
          step="0.01"
          placeholder="ex: 50 = 50%"
          defaultValue={defaults.overtimePercent ?? ""}
          className={styles.fieldInput}
        />
      </label>
    </div>
  );
}
