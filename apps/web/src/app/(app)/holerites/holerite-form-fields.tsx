"use client";

import styles from "./holerites.module.css";

export type HoleriteFormDefaults = {
  label: string;
  gross: number | null;
  inss: number | null;
  irrf: number | null;
  benefits: number | null;
};

type Employee = { userId: string; name: string };

// employeeSelect is omitted (undefined) when editing an existing holerite —
// a holerite doesn't change owner after creation, so the edit dialog never
// renders the colaborador picker.
export function HoleriteFormFields({
  defaults,
  employeeSelect,
}: {
  defaults: HoleriteFormDefaults;
  employeeSelect?: Employee[];
}) {
  return (
    <div className={styles.fieldGrid}>
      {employeeSelect ? (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Colaborador</span>
          <select name="userId" required defaultValue="" className={styles.fieldSelect}>
            <option value="" disabled>
              Escolha um colaborador
            </option>
            {employeeSelect.map((employee) => (
              <option key={employee.userId} value={employee.userId}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Rótulo</span>
        <input
          type="text"
          name="label"
          required
          placeholder="ex: Agosto/2026"
          defaultValue={defaults.label}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Bruto (R$)</span>
        <input
          type="number"
          name="gross"
          required
          min="0"
          step="0.01"
          defaultValue={defaults.gross ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>INSS (R$)</span>
        <input
          type="number"
          name="inss"
          required
          min="0"
          step="0.01"
          defaultValue={defaults.inss ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>IRRF (R$)</span>
        <input
          type="number"
          name="irrf"
          required
          min="0"
          step="0.01"
          defaultValue={defaults.irrf ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Benefícios (R$)</span>
        <input
          type="number"
          name="benefits"
          required
          min="0"
          step="0.01"
          defaultValue={defaults.benefits ?? ""}
          className={styles.fieldInput}
        />
      </label>
    </div>
  );
}
