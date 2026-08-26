import { createContext, useContext, useState, type ReactNode } from "react";

export type DeslocamentoRecord = {
  id: string;
  startedAt: string;
  endedAt: string;
};

type OperacionalContextValue = {
  sobreavisoActive: boolean;
  sobreavisoStartedAt: string | null;
  toggleSobreaviso: () => void;
  deslocamentoActive: boolean;
  deslocamentoStartedAt: string | null;
  toggleDeslocamento: () => void;
  deslocamentos: DeslocamentoRecord[];
};

const OperacionalContext = createContext<OperacionalContextValue | null>(null);

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function OperacionalProvider({ children }: { children: ReactNode }) {
  const [sobreavisoActive, setSobreavisoActive] = useState(false);
  const [sobreavisoStartedAt, setSobreavisoStartedAt] = useState<string | null>(null);
  const [deslocamentoActive, setDeslocamentoActive] = useState(false);
  const [deslocamentoStartedAt, setDeslocamentoStartedAt] = useState<string | null>(null);
  const [deslocamentos, setDeslocamentos] = useState<DeslocamentoRecord[]>([]);

  function toggleSobreaviso() {
    if (sobreavisoActive) {
      setSobreavisoActive(false);
      setSobreavisoStartedAt(null);
    } else {
      setSobreavisoActive(true);
      setSobreavisoStartedAt(new Date().toISOString());
    }
  }

  function toggleDeslocamento() {
    if (deslocamentoActive && deslocamentoStartedAt) {
      setDeslocamentos((current) => [
        ...current,
        { id: nextId(), startedAt: deslocamentoStartedAt, endedAt: new Date().toISOString() },
      ]);
      setDeslocamentoActive(false);
      setDeslocamentoStartedAt(null);
    } else {
      setDeslocamentoActive(true);
      setDeslocamentoStartedAt(new Date().toISOString());
    }
  }

  return (
    <OperacionalContext.Provider
      value={{
        sobreavisoActive,
        sobreavisoStartedAt,
        toggleSobreaviso,
        deslocamentoActive,
        deslocamentoStartedAt,
        toggleDeslocamento,
        deslocamentos,
      }}
    >
      {children}
    </OperacionalContext.Provider>
  );
}

export function useOperacional() {
  const context = useContext(OperacionalContext);
  if (!context) {
    throw new Error("useOperacional must be used within an OperacionalProvider");
  }
  return context;
}
