import {
  CAREER_LADDER,
  COMPETENCIA_CATEGORIA,
  COMPETENCIA_KEYS,
  COMPETENCIA_LABELS,
  ELEGIBILIDADE_MEDIA_MINIMA,
  PRINCIPIO_KEYS,
  PRINCIPIOS,
  subNivelIndexFromSalario,
  subNivelLabel,
  subNivelStatus,
  type NivelEscada,
} from "@ponto-dcit/shared-types";

import { saveCareerEvaluation } from "./actions";
import { AutoExpandOnInvalid } from "./auto-expand-on-invalid";
import styles from "./gestao-carreiras.module.css";
import { SubmeterButton } from "./submeter-button";

// Same chevron used by the sidebar's expandable groups (nav-links.tsx) — a
// <details>/<summary> element has no built-in way to put its native
// disclosure marker on the right or restyle it, so this replaces it
// entirely (marker hidden via CSS) and rotates via the `details[open]`
// selector instead of JS state, since <details> is already uncontrolled.
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type PrincipioScore = { principio: string; nota: number; justificativa: string | null };
type CompetenciaScore = { competencia: string; nota: number; justificativa: string | null };
type RequisitoCheck = { tipo: "obrigatorio" | "eletivo"; label: string; atendido: boolean };
type OpenEvaluation = {
  id: string;
  status: string;
  resultado: string | null;
  decidedAt: string | null;
  mediaGeral: number | null;
  proximoNivel: string | null;
  principios: PrincipioScore[];
  competencias: CompetenciaScore[];
  requisitos: RequisitoCheck[];
};

export function AvaliacaoCarreiraSection({
  userId,
  colaboradorNome,
  nivel,
  salarioMensal,
  mesesDeCasa,
  evaluation,
}: {
  userId: string;
  colaboradorNome: string;
  nivel: string | null;
  salarioMensal: number | null;
  mesesDeCasa: number;
  evaluation: OpenEvaluation | null;
}) {
  const nivelEscada = (nivel ?? "junior") as NivelEscada;
  const nivelInfo = CAREER_LADDER[nivelEscada];
  const proximoNivel = nivelInfo.proximoNivel;
  const proximoNivelInfo = proximoNivel ? CAREER_LADDER[proximoNivel] : null;

  const subNivelIndex = subNivelIndexFromSalario(nivelEscada, salarioMensal ?? nivelInfo.degraus[0]);
  const subNivelAtualLabel = subNivelLabel(nivelEscada, subNivelIndex);
  const subNivelAtualStatus = subNivelStatus(nivelEscada, subNivelIndex);

  const isOpen = evaluation?.status === "salva";
  const formEvaluation = isOpen ? evaluation : null;

  const notaPorPrincipio = new Map(formEvaluation?.principios.map((p) => [p.principio, p]) ?? []);
  const notaPorCompetencia = new Map(formEvaluation?.competencias.map((c) => [c.competencia, c]) ?? []);
  const requisitosAtendidos = new Set(formEvaluation?.requisitos.filter((r) => r.atendido).map((r) => r.label) ?? []);

  const obrigatoriosOk =
    proximoNivelInfo !== null &&
    proximoNivelInfo.requisitos.filter((r) => r.tipo === "obrigatorio").every((r) => requisitosAtendidos.has(r.label));
  const mediaOk = (formEvaluation?.mediaGeral ?? 0) >= ELEGIBILIDADE_MEDIA_MINIMA;
  const elegivel = formEvaluation !== null && proximoNivel !== null && obrigatoriosOk && mediaOk;

  function faixaLabel(degraus: number[]): string {
    return `R$ ${degraus[0].toLocaleString("pt-BR")} – R$ ${degraus[degraus.length - 1].toLocaleString("pt-BR")}`;
  }

  return (
    <div className={styles.section}>
      <div className={styles.summaryCard}>
        <div>
          <strong>Nível Atual</strong>
          <p>{subNivelAtualLabel}</p>
        </div>
        <div>
          <strong>Tempo de Casa</strong>
          <p>
            {mesesDeCasa} {mesesDeCasa === 1 ? "mês" : "meses"}
          </p>
        </div>
        <div>
          <strong>Faixa Salarial Atual</strong>
          <p>
            {faixaLabel(nivelInfo.degraus)}
            {salarioMensal !== null ? ` (atual: R$ ${salarioMensal.toLocaleString("pt-BR")})` : ""}
          </p>
        </div>
        <div>
          <strong>Próximo Nível</strong>
          <p>{proximoNivelInfo ? `${proximoNivelInfo.label} (${faixaLabel(proximoNivelInfo.degraus)})` : "Nível máximo atingido"}</p>
        </div>
      </div>

      <p className={subNivelIndex === 0 ? styles.badgeDesenvolvimento : styles.badgeElegivel}>
        {subNivelAtualStatus.toUpperCase()}
      </p>

      {evaluation && !isOpen ? (
        <p className={styles.description}>
          Última avaliação decidida em{" "}
          {evaluation.decidedAt ? new Date(evaluation.decidedAt).toLocaleDateString("pt-BR") : "—"}:{" "}
          {evaluation.resultado === "promovido" ? "Promovido(a)" : "Em desenvolvimento"}
          {evaluation.mediaGeral != null ? ` (média ${evaluation.mediaGeral.toFixed(1)})` : ""}
        </p>
      ) : null}

      <AutoExpandOnInvalid>
      <form action={saveCareerEvaluation} className={styles.evaluationForm}>
        <input type="hidden" name="userId" value={userId} />

        <details className={styles.group}>
          <summary className={styles.groupSummary}>
            5 Princípios Essenciais
            <ChevronIcon className={styles.groupChevron} />
          </summary>
          {PRINCIPIO_KEYS.map((key) => {
            const info = PRINCIPIOS[key];
            const current = notaPorPrincipio.get(key);
            return (
              <div key={key} className={styles.scoreBlock}>
                <label>
                  <strong>{info.label}</strong> — {info.descricao}
                  <input
                    type="number"
                    name={`nota-${key}`}
                    min={0}
                    max={10}
                    required
                    defaultValue={current?.nota ?? ""}
                    className={styles.input}
                  />
                </label>
                <textarea
                  name={`justificativa-${key}`}
                  placeholder="Observações/Justificativa"
                  defaultValue={current?.justificativa ?? ""}
                  rows={1}
                  className={styles.justificativaInput}
                />
              </div>
            );
          })}
        </details>

        <details className={styles.group}>
          <summary className={styles.groupSummary}>
            Competências
            <ChevronIcon className={styles.groupChevron} />
          </summary>
          <div className={styles.competenciaColumns}>
          <div className={styles.competenciaColumn}>
          <h3>Hard Skills</h3>
          {COMPETENCIA_KEYS.filter((key) => COMPETENCIA_CATEGORIA[key] === "hard").map((key) => {
            const current = notaPorCompetencia.get(key);
            return (
              <div key={key} className={styles.scoreBlock}>
                <label>
                  {COMPETENCIA_LABELS[key]}
                  <input
                    type="number"
                    name={`nota-${key}`}
                    min={0}
                    max={10}
                    required
                    defaultValue={current?.nota ?? ""}
                    className={styles.input}
                  />
                </label>
                <textarea
                  name={`justificativa-${key}`}
                  placeholder="Observações/Justificativa"
                  defaultValue={current?.justificativa ?? ""}
                  rows={1}
                  className={styles.justificativaInput}
                />
              </div>
            );
          })}
          </div>
          <div className={styles.competenciaColumn}>
          <h3>Soft Skills</h3>
          {COMPETENCIA_KEYS.filter((key) => COMPETENCIA_CATEGORIA[key] === "soft").map((key) => {
            const current = notaPorCompetencia.get(key);
            return (
              <div key={key} className={styles.scoreBlock}>
                <label>
                  {COMPETENCIA_LABELS[key]}
                  <input
                    type="number"
                    name={`nota-${key}`}
                    min={0}
                    max={10}
                    required
                    defaultValue={current?.nota ?? ""}
                    className={styles.input}
                  />
                </label>
                <textarea
                  name={`justificativa-${key}`}
                  placeholder="Observações/Justificativa"
                  defaultValue={current?.justificativa ?? ""}
                  rows={1}
                  className={styles.justificativaInput}
                />
              </div>
            );
          })}
          </div>
          </div>
        </details>

        {proximoNivelInfo ? (
          <details className={styles.group}>
            <summary className={styles.groupSummary}>
              Checklist de Requisitos para o Próximo Nível
              <ChevronIcon className={styles.groupChevron} />
            </summary>
            <h3>Obrigatórios</h3>
            {proximoNivelInfo.requisitos
              .filter((r) => r.tipo === "obrigatorio")
              .map((r) => (
                <label key={r.label} className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    name="requisitosAtendidos"
                    value={r.label}
                    defaultChecked={requisitosAtendidos.has(r.label)}
                  />
                  {r.label}
                </label>
              ))}
            {proximoNivelInfo.requisitos.some((r) => r.tipo === "eletivo") ? (
              <>
                <h3>Eletivos</h3>
                {proximoNivelInfo.requisitos
                  .filter((r) => r.tipo === "eletivo")
                  .map((r) => (
                    <label key={r.label} className={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        name="requisitosAtendidos"
                        value={r.label}
                        defaultChecked={requisitosAtendidos.has(r.label)}
                      />
                      {r.label}
                    </label>
                  ))}
              </>
            ) : null}
          </details>
        ) : (
          <p className={styles.empty}>Não há checklist a exibir — este colaborador já está no topo da escada.</p>
        )}

        <button type="submit" className={styles.saveButton}>
          Salvar Avaliação
        </button>
      </form>
      </AutoExpandOnInvalid>

      <div className={styles.finalPanel}>
        <h2>Painel Final</h2>
        <p>Média Geral: {formEvaluation?.mediaGeral != null ? formEvaluation.mediaGeral.toFixed(1) : "—"} / 10</p>
        <p className={elegivel ? styles.badgeElegivel : styles.badgeDesenvolvimento}>
          {proximoNivel === null ? "Nível Máximo" : elegivel ? "Elegível para Promoção" : "Em Desenvolvimento"}
        </p>
        <div className={styles.actions}>
          {isOpen && evaluation ? (
            <SubmeterButton
              evaluationId={evaluation.id}
              elegivel={elegivel}
              proximoNivelLabel={proximoNivelInfo?.label ?? null}
              colaboradorNome={colaboradorNome}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
