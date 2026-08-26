import { createContext, useContext, useState, type ReactNode } from "react";

export type TimeEntryRecord = {
  id: string;
  clockedAt: string;
};

export type AdjustmentRequest = {
  id: string;
  reason: string;
  createdAt: string;
  status: "pendente";
};

export type CompensationRequest = {
  id: string;
  reason: string;
  createdAt: string;
  status: "pendente";
};

export type VacationStatus = "pendente" | "aprovado" | "recusado";

export type VacationRequest = {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  createdAt: string;
  status: VacationStatus;
};

// Seeded so the status list has something to show beyond "pendente" — these
// two are demo data standing in for requests that would already exist by
// the time a real employee opens this screen, not something the user did.
const SEEDED_VACATION_REQUESTS: VacationRequest[] = [
  {
    id: "seed-1",
    startDate: "2026-10-05",
    endDate: "2026-10-14",
    days: 10,
    createdAt: "2026-08-01T12:00:00.000Z",
    status: "aprovado",
  },
  {
    id: "seed-2",
    startDate: "2026-12-20",
    endDate: "2026-12-24",
    days: 5,
    createdAt: "2026-08-10T12:00:00.000Z",
    status: "recusado",
  },
];

type PontoContextValue = {
  entries: TimeEntryRecord[];
  addEntry: (clockedAt: string) => void;
  adjustmentRequests: AdjustmentRequest[];
  addAdjustmentRequest: (reason: string) => void;
  compensationRequests: CompensationRequest[];
  addCompensationRequest: (reason: string) => void;
  vacationRequests: VacationRequest[];
  addVacationRequest: (startDate: string, endDate: string, days: number) => void;
};

const PontoContext = createContext<PontoContextValue | null>(null);

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PontoProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<TimeEntryRecord[]>([]);
  const [adjustmentRequests, setAdjustmentRequests] = useState<AdjustmentRequest[]>([]);
  const [compensationRequests, setCompensationRequests] = useState<CompensationRequest[]>([]);
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>(
    SEEDED_VACATION_REQUESTS,
  );

  function addEntry(clockedAt: string) {
    setEntries((current) => [...current, { id: nextId(), clockedAt }]);
  }

  function addAdjustmentRequest(reason: string) {
    setAdjustmentRequests((current) => [
      ...current,
      { id: nextId(), reason, createdAt: new Date().toISOString(), status: "pendente" },
    ]);
  }

  function addCompensationRequest(reason: string) {
    setCompensationRequests((current) => [
      ...current,
      { id: nextId(), reason, createdAt: new Date().toISOString(), status: "pendente" },
    ]);
  }

  function addVacationRequest(startDate: string, endDate: string, days: number) {
    setVacationRequests((current) => [
      ...current,
      {
        id: nextId(),
        startDate,
        endDate,
        days,
        createdAt: new Date().toISOString(),
        status: "pendente",
      },
    ]);
  }

  return (
    <PontoContext.Provider
      value={{
        entries,
        addEntry,
        adjustmentRequests,
        addAdjustmentRequest,
        compensationRequests,
        addCompensationRequest,
        vacationRequests,
        addVacationRequest,
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
