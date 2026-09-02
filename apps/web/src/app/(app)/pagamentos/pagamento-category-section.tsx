"use client";

import { useMemo, useState, useTransition } from "react";

import { sendPagamento } from "./actions";
import styles from "./pagamentos.module.css";

type Colaborador = { userId: string; name: string; role: string; team: string | null };
type StatusEntry = { userId: string; sentAt: string };

function formatSentAt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function PagamentoCategorySection({
  category,
  label,
  colaboradores,
  status,
}: {
  category: string;
  label: string;
  colaboradores: Colaborador[];
  status: StatusEntry[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sentAtByUserId = useMemo(() => new Map(status.map((s) => [s.userId, s.sentAt])), [status]);

  const teams = useMemo(
    () =>
      Array.from(new Set(colaboradores.map((c) => c.team).filter((t): t is string => Boolean(t)))).sort(),
    [colaboradores],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return colaboradores.filter((c) => {
      const matchesSearch = query.length === 0 || c.name.toLowerCase().includes(query);
      const matchesTeam = teamFilter.length === 0 || c.team === teamFilter;
      return matchesSearch && matchesTeam;
    });
  }, [colaboradores, search, teamFilter]);

  function handleSend(userIds: string[]) {
    startTransition(async () => {
      try {
        await sendPagamento(category, userIds);
        setError(null);
      } catch {
        setError("Não foi possível enviar. Tente novamente.");
      }
    });
  }

  return (
    <div className={styles.categoryGroup}>
      <button
        type="button"
        className={styles.categoryHeader}
        onClick={() => {
          setOpen((current) => !current);
          setError(null);
        }}
        aria-expanded={open}
      >
        <span className={styles.categoryLabel}>{label}</span>
        <svg
          className={open ? `${styles.categoryChevron} ${styles.categoryChevronOpen}` : styles.categoryChevron}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className={styles.categoryBody}>
          <div className={styles.filters}>
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={styles.filterInput}
              aria-label={`Buscar colaborador em ${label}`}
            />
            <select
              value={teamFilter}
              onChange={(event) => setTeamFilter(event.target.value)}
              className={styles.filterSelect}
              aria-label={`Filtrar por time em ${label}`}
            >
              <option value="">Todos os times</option>
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.sendAllButton}
              disabled={isPending || filtered.length === 0}
              onClick={() => handleSend(filtered.map((c) => c.userId))}
            >
              Enviar para todos ({filtered.length})
            </button>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}

          {filtered.length === 0 ? (
            <p className={styles.sectionEmpty}>Nenhum colaborador encontrado.</p>
          ) : (
            <ul className={styles.list}>
              {filtered.map((colaborador) => {
                const sentAt = sentAtByUserId.get(colaborador.userId);
                return (
                  <li key={colaborador.userId} className={styles.item}>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemName}>{colaborador.name}</span>
                      <span className={styles.itemDetail}>
                        {colaborador.team ?? "Sem time"} ·{" "}
                        {sentAt ? `Enviado em ${formatSentAt(sentAt)}` : "Não enviado"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.sendButton}
                      disabled={isPending}
                      onClick={() => handleSend([colaborador.userId])}
                    >
                      {sentAt ? "Reenviar" : "Enviar"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
