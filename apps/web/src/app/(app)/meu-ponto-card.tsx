"use client";

import { useEffect, useState } from "react";

import { punchTimeEntry } from "./ponto-actions";
import styles from "./ponto.module.css";

type TimeEntry = { id: string; clockedAt: string };

function summarizeDay(dayEntries: TimeEntry[]) {
  const sorted = [...dayEntries].sort(
    (a, b) => new Date(a.clockedAt).getTime() - new Date(b.clockedAt).getTime(),
  );
  let workedMinutes = 0;
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    const start = new Date(sorted[i].clockedAt).getTime();
    const end = new Date(sorted[i + 1].clockedAt).getTime();
    workedMinutes += (end - start) / 60000;
  }
  return { workedMinutes: Math.round(workedMinutes), sorted };
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

export function MeuPontoCard({
  name,
  initialEntries,
}: {
  name: string;
  initialEntries: TimeEntry[];
}) {
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [locationText, setLocationText] = useState<string | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationText("Localização não disponível");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocationText(`Localização: ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
      },
      () => setLocationText("Localização não disponível"),
      // Without an explicit timeout, the browser default is Infinity — an
      // unanswered permission prompt would leave "Obtendo localização..."
      // on screen forever, since neither callback ever fires.
      { timeout: 10_000 },
    );
  }, []);

  async function handlePunch() {
    setPending(true);
    setError(null);
    try {
      const entry = await punchTimeEntry();
      setEntries((current) => [...current, entry]);
    } catch {
      setError("Falha ao registrar ponto. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  const { workedMinutes, sorted } = summarizeDay(entries);
  const lastEntry = sorted[sorted.length - 1];
  const lastPunchTime = lastEntry
    ? new Date(lastEntry.clockedAt).toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--:--";

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Olá, {name}</h1>
      <div className={styles.meuPontoCard}>
        <button
          type="button"
          className={styles.punchButton}
          onClick={handlePunch}
          disabled={pending}
        >
          Bater Ponto
        </button>
        <p className={styles.itemDetail}>Último ponto: {lastPunchTime}</p>
        <p className={styles.itemDetail}>Horas trabalhadas hoje: {formatMinutes(workedMinutes)}</p>
        <p className={styles.itemDetail}>{locationText ?? "Obtendo localização..."}</p>
        {error ? <p className={styles.errorText}>{error}</p> : null}
      </div>
    </div>
  );
}
