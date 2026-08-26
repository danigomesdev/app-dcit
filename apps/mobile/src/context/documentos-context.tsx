import { createContext, useContext, useState, type ReactNode } from "react";

export type DocumentStatus = "enviado" | "em_analise" | "aprovado" | "recusado";

export type AtestadoRecord = {
  id: string;
  createdAt: string;
  status: DocumentStatus;
  cid: string;
  crm: string;
  medico: string;
  dias: number;
  photoUri?: string;
};

export type Certification = {
  id: string;
  name: string;
  institution: string;
  validUntil: string;
  createdAt: string;
};

type NewAtestado = Omit<AtestadoRecord, "id" | "createdAt" | "status">;
type NewCertification = Omit<Certification, "id" | "createdAt">;

// Seeded so the status list demonstrates more than "enviado" — these two
// stand in for atestados that would already be on file, not user actions.
const SEEDED_ATESTADOS: AtestadoRecord[] = [
  {
    id: "seed-atestado-1",
    createdAt: "2026-07-10T09:00:00.000Z",
    status: "aprovado",
    cid: "J06.9",
    crm: "CRM-MG 45213",
    medico: "Dr. Carlos Mendes",
    dias: 2,
  },
  {
    id: "seed-atestado-2",
    createdAt: "2026-05-22T09:00:00.000Z",
    status: "recusado",
    cid: "M54.5",
    crm: "CRM-MG 78120",
    medico: "Dra. Beatriz Lima",
    dias: 1,
  },
];

type DocumentosContextValue = {
  atestados: AtestadoRecord[];
  addAtestado: (input: NewAtestado) => void;
  certifications: Certification[];
  addCertification: (input: NewCertification) => void;
};

const DocumentosContext = createContext<DocumentosContextValue | null>(null);

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function DocumentosProvider({ children }: { children: ReactNode }) {
  const [atestados, setAtestados] = useState<AtestadoRecord[]>(SEEDED_ATESTADOS);
  const [certifications, setCertifications] = useState<Certification[]>([]);

  function addAtestado(input: NewAtestado) {
    setAtestados((current) => [
      ...current,
      { ...input, id: nextId(), createdAt: new Date().toISOString(), status: "enviado" },
    ]);
  }

  function addCertification(input: NewCertification) {
    setCertifications((current) => [
      ...current,
      { ...input, id: nextId(), createdAt: new Date().toISOString() },
    ]);
  }

  return (
    <DocumentosContext.Provider
      value={{ atestados, addAtestado, certifications, addCertification }}
    >
      {children}
    </DocumentosContext.Provider>
  );
}

export function useDocumentos() {
  const context = useContext(DocumentosContext);
  if (!context) {
    throw new Error("useDocumentos must be used within a DocumentosProvider");
  }
  return context;
}

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  enviado: "Enviado",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  recusado: "Recusado",
};
