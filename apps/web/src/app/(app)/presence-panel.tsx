"use client";

import { useEffect, useState } from "react";

import styles from "./ponto.module.css";

export type TeamMemberStatus =
  | "trabalhando"
  | "pausa"
  | "atrasado"
  | "folga"
  | "sem_registro"
  | "nao_presente"
  | "ferias"
  | "atestado";

export type TeamMember = {
  userId: string;
  name: string;
  entries: { id: string; clockedAt: string }[];
  workedMinutes: number;
  status: TeamMemberStatus;
  periodStart?: string;
  periodEnd?: string;
};

const POLL_INTERVAL_MS = 60_000;

const STATUS_LABEL: Record<TeamMemberStatus, string> = {
  trabalhando: "Trabalhando",
  pausa: "Em pausa",
  atrasado: "Atrasado",
  folga: "De folga",
  sem_registro: "Sem registro",
  nao_presente: "Não presente",
  ferias: "Férias",
  atestado: "Atestado",
};

const STATUS_CLASS: Record<TeamMemberStatus, string> = {
  trabalhando: styles.statusTrabalhando,
  pausa: styles.statusPausa,
  atrasado: styles.statusAtrasado,
  folga: styles.statusNeutro,
  sem_registro: styles.statusNeutro,
  nao_presente: styles.statusNeutro,
  ferias: styles.statusFerias,
  atestado: styles.statusAtestado,
};

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function detailFor(member: TeamMember): string {
  if ((member.status === "ferias" || member.status === "atestado") && member.periodStart && member.periodEnd) {
    return `${formatDateOnly(member.periodStart)} até ${formatDateOnly(member.periodEnd)}`;
  }
  return member.entries.length > 0
    ? `${member.entries.map((entry) => formatTime(entry.clockedAt)).join(", ")} · ${formatMinutes(member.workedMinutes)} hoje`
    : "Nenhuma batida hoje";
}

export function PresencePanel({ initialTeam }: { initialTeam: TeamMember[] }) {
  const [team, setTeam] = useState(initialTeam);

  useEffect(() => {
    const id = setInterval(() => {
      fetch("/api/team-presence")
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`))))
        .then((data: TeamMember[]) => setTeam(data))
        .catch(() => {
          // Transient failure (network blip, API hiccup): keep showing the
          // last known-good data rather than clearing the panel or
          // surfacing an error to the gestor.
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Ponto dos funcionários</h1>
      <ul className={styles.list}>
        {team.map((member) => (
          <li key={member.userId} className={styles.item}>
            <div className={styles.itemInfo}>
              <span className={styles.itemName}>{member.name}</span>
              <span className={styles.itemDetail}>{detailFor(member)}</span>
            </div>
            <span className={`${styles.status} ${STATUS_CLASS[member.status]}`}>
              {STATUS_LABEL[member.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
