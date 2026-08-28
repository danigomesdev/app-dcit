"use client";

import { useActionState } from "react";

import { updateSchedule } from "./actions";
import styles from "./colaboradores.module.css";

type Employee = {
  userId: string;
  name: string;
  expectedStartTime: string | null;
};

export function ColaboradoresRow({ employee }: { employee: Employee }) {
  const [state, formAction, pending] = useActionState(updateSchedule, { error: null });

  return (
    <li className={styles.item}>
      <span className={styles.itemName}>{employee.name}</span>
      <form action={formAction} className={styles.form}>
        <input type="hidden" name="userId" value={employee.userId} />
        <input
          type="time"
          name="expectedStartTime"
          defaultValue={employee.expectedStartTime ?? ""}
          aria-label={`Horário esperado de entrada de ${employee.name}`}
          className={styles.timeInput}
        />
        <button type="submit" className={styles.saveButton} disabled={pending}>
          Salvar
        </button>
      </form>
      {state.error ? <span className={styles.error}>{state.error}</span> : null}
    </li>
  );
}
