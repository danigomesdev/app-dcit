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

// Deve ficar em sincronia com CARGOS em packages/shared-types/src/employee-create.ts
// (não importado diretamente — mesmo raciocínio de ESTADOS_CIVIS/UFS acima).
const CARGOS = [
  "rh",
  "analista_monitoramento",
  "analista_cloud_ops",
  "arquiteto_nuvem",
  "devops",
  "desenvolvedor",
  "analista_suporte",
  "engenheiro_dados",
  "dba",
  "analista_seguranca_informacao",
  "analista_qa",
  "analista_infraestrutura",
  "coordenador_ti",
] as const;

const CARGO_LABELS: Record<(typeof CARGOS)[number], string> = {
  rh: "RH",
  analista_monitoramento: "Analista de Monitoramento",
  analista_cloud_ops: "Analista Cloud & Ops",
  arquiteto_nuvem: "Arquiteto de Nuvem",
  devops: "DevOps",
  desenvolvedor: "Desenvolvedor",
  analista_suporte: "Analista de Suporte",
  engenheiro_dados: "Engenheiro de Dados",
  dba: "DBA (Administrador de Banco de Dados)",
  analista_seguranca_informacao: "Analista de Segurança da Informação",
  analista_qa: "Analista de QA / Testes",
  analista_infraestrutura: "Analista de Infraestrutura",
  coordenador_ti: "Coordenador de TI",
};

const NIVEIS = ["junior", "pleno", "senior", "especialista"] as const;

const NIVEL_LABELS: Record<(typeof NIVEIS)[number], string> = {
  junior: "Júnior",
  pleno: "Pleno",
  senior: "Sênior",
  especialista: "Especialista",
};

export type ColaboradorFormDefaults = {
  name: string;
  role: "colaborador" | "gestor" | "rh";
  cargo: string | null;
  team: string | null;
  nivel: string | null;
  convencaoId: string | null;
  salarioMensal: number | null;
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

export function ColaboradorFormFields({
  defaults,
  convencoes,
}: {
  defaults: ColaboradorFormDefaults;
  convencoes: { id: string; nome: string }[];
}) {
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
      <input type="hidden" name="role" value={defaults.role} />
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Função</span>
        <select name="cargo" defaultValue={defaults.cargo ?? ""} className={styles.fieldSelect}>
          <option value="">—</option>
          {CARGOS.map((value) => (
            <option key={value} value={value}>
              {CARGO_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Nível</span>
        <select name="nivel" defaultValue={defaults.nivel ?? ""} className={styles.fieldSelect}>
          <option value="">—</option>
          {NIVEIS.map((value) => (
            <option key={value} value={value}>
              {NIVEL_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Convenção coletiva</span>
        <select
          name="convencaoId"
          defaultValue={defaults.convencaoId ?? ""}
          className={styles.fieldSelect}
        >
          <option value="">—</option>
          {convencoes.map((convencao) => (
            <option key={convencao.id} value={convencao.id}>
              {convencao.nome}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Salário mensal</span>
        <input
          type="number"
          name="salarioMensal"
          min="0"
          step="0.01"
          placeholder="R$"
          defaultValue={defaults.salarioMensal ?? ""}
          className={styles.fieldInput}
        />
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
        <span className={styles.fieldLabel}>Time</span>
        <input
          type="text"
          name="team"
          defaultValue={defaults.team ?? ""}
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
    </div>
  );
}
