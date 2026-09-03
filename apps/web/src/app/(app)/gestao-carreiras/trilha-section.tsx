import { createTrackRequirement, updateTrackRequirementStatus } from "./actions";
import styles from "./gestao-carreiras.module.css";
import { TrilhaStatusSelect } from "./trilha-status-select";

type TrackRequirement = { id: string; title: string; status: "pendente" | "andamento" | "concluido" };
type PromotabilidadeDetail = {
  status: "verde" | "amarelo" | "branco";
  mesesDeCasa: number;
  requisitosPendentes: number;
  metasPendentes: number;
  ultimaMediaAvaliacao: number | null;
};

const PROMOTABILIDADE_LABEL: Record<PromotabilidadeDetail["status"], string> = {
  verde: "🟢 Pronto para promoção",
  amarelo: "🟡 Em desenvolvimento",
  branco: "⚪ Em formação inicial",
};

export function TrilhaSection({
  userId,
  requirements,
  promotabilidade,
}: {
  userId: string;
  requirements: TrackRequirement[];
  promotabilidade: PromotabilidadeDetail;
}) {
  const pendencias: string[] = [];
  if (promotabilidade.mesesDeCasa < 3) pendencias.push("tempo mínimo de 3 meses no cargo ainda não atingido");
  if (promotabilidade.requisitosPendentes > 0)
    pendencias.push(`${promotabilidade.requisitosPendentes} requisito(s) de trilha pendente(s)`);
  if (promotabilidade.metasPendentes > 0) pendencias.push(`${promotabilidade.metasPendentes} meta(s) de PDI pendente(s)`);
  if (promotabilidade.ultimaMediaAvaliacao === null) pendencias.push("nenhuma avaliação de desempenho registrada ainda");
  else if (promotabilidade.ultimaMediaAvaliacao < 4)
    pendencias.push(`média de avaliação (${promotabilidade.ultimaMediaAvaliacao.toFixed(2)}) abaixo de 4`);

  return (
    <div className={styles.section}>
      <h2>Tempo de Casa / Elegibilidade</h2>
      <p>
        {promotabilidade.mesesDeCasa} {promotabilidade.mesesDeCasa === 1 ? "mês" : "meses"} no cargo atual —{" "}
        {PROMOTABILIDADE_LABEL[promotabilidade.status]}
      </p>
      {pendencias.length > 0 ? (
        <ul className={styles.list}>
          {pendencias.map((pendencia) => (
            <li key={pendencia}>{pendencia}</li>
          ))}
        </ul>
      ) : null}

      <h2>Certificações & Cursos Requeridos</h2>
      {requirements.length === 0 ? (
        <p className={styles.empty}>Nenhum requisito cadastrado.</p>
      ) : (
        <ul className={styles.list}>
          {requirements.map((req) => (
            <li key={req.id} className={styles.item}>
              <span>{req.title}</span>
              <form action={updateTrackRequirementStatus} className={styles.statusForm}>
                <input type="hidden" name="id" value={req.id} />
                <TrilhaStatusSelect status={req.status} />
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={createTrackRequirement} className={styles.form}>
        <input type="hidden" name="userId" value={userId} />
        <input type="text" name="title" placeholder="Novo requisito (ex: Certificação AWS)" required />
        <button type="submit">Adicionar</button>
      </form>
    </div>
  );
}
