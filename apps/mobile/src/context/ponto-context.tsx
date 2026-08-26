import { createContext, useContext, useState, type ReactNode } from "react";

export type TimeEntryRecord = {
  id: string;
  clockedAt: string;
  // Absent/true = confirmed by the server. False = captured locally while
  // offline (spec §4.5 modo offline) and still waiting to sync.
  synced?: boolean;
};

type PontoContextValue = {
  entries: TimeEntryRecord[];
  addEntry: (clockedAt: string, synced?: boolean) => string;
  markEntrySynced: (id: string) => void;
  hydrateEntries: (serverEntries: { id: string; clockedAt: string }[]) => void;
};

const PontoContext = createContext<PontoContextValue | null>(null);

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PontoProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<TimeEntryRecord[]>([]);

  function addEntry(clockedAt: string, synced = true): string {
    const id = nextId();
    setEntries((current) => [...current, { id, clockedAt, synced }]);
    return id;
  }

  function markEntrySynced(id: string) {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, synced: true } : entry)),
    );
  }

  // Replaces the synced portion of the list with the server's authoritative
  // history and keeps only what's still queued (synced === false) — an
  // already-synced local entry is guaranteed to have a matching server
  // record by now, so dropping it here (rather than merging by id, which
  // wouldn't match anyway: local ids are client-generated, server ids are
  // Prisma's) avoids showing the same punch twice.
  function hydrateEntries(serverEntries: { id: string; clockedAt: string }[]) {
    setEntries((current) => {
      const stillPending = current.filter((entry) => entry.synced === false);
      const hydrated: TimeEntryRecord[] = serverEntries.map((entry) => ({
        id: entry.id,
        clockedAt: entry.clockedAt,
        synced: true,
      }));
      return [...hydrated, ...stillPending];
    });
  }

  return (
    <PontoContext.Provider
      value={{
        entries,
        addEntry,
        markEntrySynced,
        hydrateEntries,
      }}
    >
      {children}
    </PontoContext.Provider>
  );
}

export function usePonto() {
  const context = useContext(PontoContext);
  if (!context) {
    throw new Error("usePonto must be used within a PontoProvider");
  }
  return context;
}

/**
 * Pairs sequential punches as clock-in/clock-out (1st = in, 2nd = out, ...).
 * An unpaired trailing punch means the day is still open (no clock-out yet).
 */
export function summarizeDay(dayEntries: TimeEntryRecord[]) {
  const sorted = [...dayEntries].sort(
    (a, b) => new Date(a.clockedAt).getTime() - new Date(b.clockedAt).getTime(),
  );

  let workedMinutes = 0;
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    const start = new Date(sorted[i].clockedAt).getTime();
    const end = new Date(sorted[i + 1].clockedAt).getTime();
    workedMinutes += (end - start) / 60000;
  }

  return {
    workedMinutes: Math.round(workedMinutes),
    isOpen: sorted.length % 2 === 1,
  };
}

export function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

export function isSameDay(isoA: string, isoB: string) {
  return isoA.slice(0, 10) === isoB.slice(0, 10);
}
