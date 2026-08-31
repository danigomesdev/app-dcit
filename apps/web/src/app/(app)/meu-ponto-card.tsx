"use client";

import { useEffect, useState } from "react";

import { punchTimeEntry } from "./ponto-actions";
import styles from "./ponto.module.css";

type TimeEntry = { id: string; clockedAt: string };

// Same reasoning as page.tsx's dateOnlyInSaoPaulo (colocated copy, not a
// shared import) — needed here to classify each entry/pair by São Paulo
// calendar date, not the pairing itself, which stays timezone-agnostic.
function dateOnlyInSaoPaulo(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Pairs sequentially over the *entire* history (clock-in/out alternate
// globally, not per calendar day — filtering to "today" before pairing
// would strand an overnight shift's clock-in on the wrong side of the
// filter, leaving its clock-out looking like an unpaired open shift with
// 0 worked minutes instead of a completed shift). A completed pair's
// minutes count toward `today` only when the pair's *end* falls on that
// São Paulo date — an overnight shift's hours are credited to the day it
// closes on.
function summarizeToday(allEntries: TimeEntry[], today: string) {
  const sorted = [...allEntries].sort(
    (a, b) => new Date(a.clockedAt).getTime() - new Date(b.clockedAt).getTime(),
  );
  let workedMinutes = 0;
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    const end = sorted[i + 1];
    if (dateOnlyInSaoPaulo(new Date(end.clockedAt)) === today) {
      const start = new Date(sorted[i].clockedAt).getTime();
      workedMinutes += (new Date(end.clockedAt).getTime() - start) / 60000;
    }
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
  today,
}: {
  name: string;
  initialEntries: TimeEntry[];
  today: string;
}) {
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [locationText, setLocationText] = useState<string | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      // Deferred via queueMicrotask, not called synchronously in the effect
      // body — react-hooks/set-state-in-effect flags direct setState calls
      // there, even for a one-time feature-detection branch like this one.
      queueMicrotask(() => setLocationText("Localização não disponível"));
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

  const { workedMinutes, sorted } = summarizeToday(entries, today);
  // "Último ponto" only ever shows today's own last punch (never a stray
  // punch from a previous day) — separate from the worked-minutes pairing
  // above, which deliberately looks across the whole history.
  const todaysEntries = sorted.filter((entry) => dateOnlyInSaoPaulo(new Date(entry.clockedAt)) === today);
  const lastEntry = todaysEntries[todaysEntries.length - 1];
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
