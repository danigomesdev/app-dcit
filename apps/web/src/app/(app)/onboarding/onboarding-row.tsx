"use client";

import { useRef } from "react";

import styles from "./onboarding.module.css";

type Task = {
  id: string;
  title: string;
  description: string;
};

type TeamProgress = {
  userId: string;
  userName: string;
  completedCount: number;
  totalCount: number;
  tasks: Task[];
  completedTaskIds: string[];
};

export function OnboardingRow({ entry }: { entry: TeamProgress }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const percent =
    entry.totalCount === 0 ? 0 : Math.round((entry.completedCount / entry.totalCount) * 100);
  const complete = entry.totalCount > 0 && entry.completedCount === entry.totalCount;
  const completedSet = new Set(entry.completedTaskIds);

  return (
    <>
      <li className={styles.item}>
        <button
          type="button"
          className={styles.itemButton}
          onClick={() => dialogRef.current?.showModal()}
        >
          <div className={styles.itemInfo}>
            <span className={styles.itemName}>{entry.userName}</span>
            <span className={styles.itemDetail}>
              {entry.completedCount} de {entry.totalCount} tarefas concluídas
            </span>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${percent}%` }} />
            </div>
          </div>
          <span className={complete ? styles.statusComplete : styles.statusPending}>
            {complete ? "Concluído" : `${percent}%`}
          </span>
        </button>
      </li>

      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Tarefas de {entry.userName}</p>
        <ul className={styles.taskList}>
          {entry.tasks.map((task) => {
            const done = completedSet.has(task.id);
            return (
              <li key={task.id} className={styles.taskItem}>
                <span className={done ? styles.taskDone : styles.taskPending}>
                  {done ? "Concluída" : "Pendente"}
                </span>
                <div className={styles.taskInfo}>
                  <span className={styles.taskTitle}>{task.title}</span>
                  <span className={styles.taskDescription}>{task.description}</span>
                </div>
              </li>
            );
          })}
        </ul>
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
