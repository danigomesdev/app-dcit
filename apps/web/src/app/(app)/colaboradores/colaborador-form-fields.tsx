"use client";

import { useRef } from "react";

import styles from "./colaboradores.module.css";

// Kept as local constants (not imported from @ponto-dcit/shared-types) to
// avoid pulling that package's full CommonJS barrel (Zod schemas included)
// into the client bundle for just these two `as const` string arrays. The
// authoritative validation still lives server-side in the Zod schema —
// these values must stay in sync with packages/shared-types/src/employee-create.ts.
const ESTADOS_CIVIS = ["solteiro", "casado", "divorciado", "viuvo", "uniao_estavel"] as const;

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const;

const ESTADO_CIVIL_LABELS: Record<(typeof ESTADOS_CIVIS)[number], string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
  uniao_estavel: "União estável",
};

export type ColaboradorFormDefaults = {
  name: string;
  role: "colaborador" | "gestor" | "rh";
  hireDate: string;
  cpf: string | null;
  rg: string | null;
  dataNascimento: string | null;
  estadoCivil: string | null;
  enderecoRua: string | null;
  enderecoNumero: string | null;
  enderecoBairro: string | null;
  enderecoCidade: string | null;
  enderecoEstado: string | null;
  enderecoCep: string | null;
};

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

export function ColaboradorFormFields({ defaults }: { defaults: ColaboradorFormDefaults }) {
  const ruaRef = useRef<HTMLInputElement>(null);
  const bairroRef = useRef<HTMLInputElement>(null);
  const cidadeRef = useRef<HTMLInputElement>(null);
  const estadoRef = useRef<HTMLSelectElement>(null);
  const initialCepDigitsRef = useRef((defaults.enderecoCep ?? "").replace(/\D/g, ""));

  async function handleCepBlur(rawCep: string) {
    const digits = rawCep.replace(/\D/g, "");
    if (digits.length !== 8) {
      return;
    }
    // Skip the autofill when the CEP hasn't actually changed from the value
    // the form was mounted with — otherwise reusing this component in the
    // edit dialog would silently overwrite manually-corrected address
    // fields every time RH tabs through an unchanged CEP. In the create
    // dialog `initialCepDigitsRef.current` is empty, so any typed CEP still
    // triggers the fetch as before.
    if (digits === initialCepDigitsRef.current) {
      return;
    }
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) {
        return;
      }
      const data: ViaCepResponse = await res.json();
      if (data.erro) {
        return;
      }
      if (ruaRef.current && data.logradouro) ruaRef.current.value = data.logradouro;
      if (bairroRef.current && data.bairro) bairroRef.current.value = data.bairro;
      if (cidadeRef.current && data.localidade) cidadeRef.current.value = data.localidade;
      if (estadoRef.current && data.uf) estadoRef.current.value = data.uf;
    } catch {
      // Network failure: leave the address fields exactly as the user left them.
    }
  }

  return (
    <div className={styles.fieldGrid}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Nome</span>
        <input
          type="text"
          name="name"
          required
          defaultValue={defaults.name}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Cargo</span>
        <select name="role" required defaultValue={defaults.role} className={styles.fieldSelect}>
          <option value="colaborador">Colaborador</option>
          <option value="gestor">Gestor</option>
          <option value="rh">RH</option>
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Data de admissão</span>
        <input
          type="date"
          name="hireDate"
          required
          defaultValue={defaults.hireDate}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>CPF</span>
        <input
          type="text"
          name="cpf"
          placeholder="11 dígitos"
          pattern="\d{11}"
          title="CPF deve ter exatamente 11 dígitos, sem pontuação"
          defaultValue={defaults.cpf ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>RG</span>
        <input
          type="text"
          name="rg"
          defaultValue={defaults.rg ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Data de nascimento</span>
        <input
          type="date"
          name="dataNascimento"
          defaultValue={defaults.dataNascimento ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Estado civil</span>
        <select
          name="estadoCivil"
          defaultValue={defaults.estadoCivil ?? ""}
          className={styles.fieldSelect}
        >
          <option value="">—</option>
          {ESTADOS_CIVIS.map((value) => (
            <option key={value} value={value}>
              {ESTADO_CIVIL_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Rua</span>
        <input
          ref={ruaRef}
          type="text"
          name="enderecoRua"
          defaultValue={defaults.enderecoRua ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Número</span>
        <input
          type="text"
          name="enderecoNumero"
          defaultValue={defaults.enderecoNumero ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Bairro</span>
        <input
          ref={bairroRef}
          type="text"
          name="enderecoBairro"
          defaultValue={defaults.enderecoBairro ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Cidade</span>
        <input
          ref={cidadeRef}
          type="text"
          name="enderecoCidade"
          defaultValue={defaults.enderecoCidade ?? ""}
          className={styles.fieldInput}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Estado (UF)</span>
        <select
          ref={estadoRef}
          name="enderecoEstado"
          defaultValue={defaults.enderecoEstado ?? ""}
          className={styles.fieldSelect}
        >
          <option value="">—</option>
          {UFS.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>CEP</span>
        <input
          type="text"
          name="enderecoCep"
          placeholder="8 dígitos"
          pattern="\d{8}"
          title="CEP deve ter exatamente 8 dígitos, sem hífen"
          defaultValue={defaults.enderecoCep ?? ""}
          onBlur={(e) => handleCepBlur(e.target.value)}
          className={styles.fieldInput}
        />
      </label>
    </div>
  );
}
