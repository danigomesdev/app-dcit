import { AcaoStatusSelect } from "./acao-status-select";
import { createEvaluation, createNineBoxPlacement, createOneOnOne, updateOneOnOneAcaoStatus } from "./actions";
import styles from "./gestao-carreiras.module.css";

type Evaluation = {
  id: string;
  date: string;
  proatividade: number;
  trabalhoEquipe: number;
  comunicacao: number;
  lideranca: number;
  comentario: string | null;
};
type NineBoxPlacement = { id: string; date: string; desempenho: string; potencial: string };
type OneOnOne = {
  id: string;
  date: string;
  pauta: string;
  proximaData: string | null;
  acoes: { id: string; descricao: string; status: "pendente" | "concluido" }[];
};

const SUB_TABS = [
  { value: "ciclos", label: "Ciclos de Avaliação" },
  { value: "1a1", label: "Registros de 1:1" },
  { value: "ninebox", label: "Matriz Nine Box" },
] as const;

export function AvaliacoesSection({
  userId,
  sub,
  evaluations,
  placements,
  oneOnOnes,
}: {
  userId: string;
  sub: string;
  evaluations: Evaluation[];
  placements: NineBoxPlacement[];
  oneOnOnes: OneOnOne[];
}) {
  return (
    <div className={styles.section}>
      <nav className={styles.tabs}>
        {SUB_TABS.map((tab) => (
          <a
            key={tab.value}
            href={`/gestao-carreiras?aba=avaliacoes&sub=${tab.value}&userId=${userId}`}
            className={sub === tab.value ? styles.tabActive : styles.tab}
          >
            {tab.label}
          </a>
        ))}
      </nav>

      {sub === "ciclos" ? <CiclosSubSection userId={userId} evaluations={evaluations} /> : null}
      {sub === "1a1" ? <OneOnOneSubSection userId={userId} oneOnOnes={oneOnOnes} /> : null}
      {sub === "ninebox" ? <NineBoxSubSection userId={userId} placements={placements} /> : null}
    </div>
  );
}

function CiclosSubSection({ userId, evaluations }: { userId: string; evaluations: Evaluation[] }) {
  return (
    <div className={styles.section}>
      {evaluations.length === 0 ? (
        <p className={styles.empty}>Nenhuma avaliação registrada.</p>
      ) : (
        <ul className={styles.list}>
          {evaluations.map((evaluation) => (
            <li key={evaluation.id} className={styles.item}>
              <span>
                Proatividade {evaluation.proatividade} · Trabalho em equipe {evaluation.trabalhoEquipe} · Comunicação{" "}
                {evaluation.comunicacao} · Liderança {evaluation.lideranca}
              </span>
            </li>
          ))}
        </ul>
      )}
      <form action={createEvaluation} className={styles.form}>
        <input type="hidden" name="userId" value={userId} />
        <label>
          Proatividade
          <input type="number" name="proatividade" min={1} max={5} required className={styles.input} />
        </label>
        <label>
          Trabalho em equipe
          <input type="number" name="trabalhoEquipe" min={1} max={5} required className={styles.input} />
        </label>
        <label>
          Comunicação
          <input type="number" name="comunicacao" min={1} max={5} required className={styles.input} />
        </label>
        <label>
          Liderança
          <input type="number" name="lideranca" min={1} max={5} required className={styles.input} />
        </label>
        <input type="text" name="comentario" placeholder="Comentário (opcional)" className={styles.input} />
        <button type="submit">Registrar avaliação</button>
      </form>
    </div>
  );
}

function OneOnOneSubSection({ userId, oneOnOnes }: { userId: string; oneOnOnes: OneOnOne[] }) {
  return (
    <div className={styles.section}>
      {oneOnOnes.length === 0 ? (
        <p className={styles.empty}>Nenhum 1:1 registrado.</p>
      ) : (
        <ul className={styles.list}>
          {oneOnOnes.map((oneOnOne) => (
            <li key={oneOnOne.id} className={styles.item}>
              <div>
                <strong>{oneOnOne.pauta}</strong>
                <ul>
                  {oneOnOne.acoes.map((acao) => (
                    <li key={acao.id}>
                      {acao.descricao} —{" "}
                      <form action={updateOneOnOneAcaoStatus} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={acao.id} />
                        <AcaoStatusSelect status={acao.status} />
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form action={createOneOnOne} className={styles.form}>
        <input type="hidden" name="userId" value={userId} />
        <input type="text" name="pauta" placeholder="Pauta da conversa" required className={styles.input} />
        <textarea name="acoes" placeholder={"Itens de ação (um por linha)"} className={styles.input} />
        <button type="submit">Registrar 1:1</button>
      </form>
    </div>
  );
}

const NINE_BOX_AXIS_LABEL: Record<"baixo" | "medio" | "alto", string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};
// Rows = potencial, top ("alto") to bottom ("baixo"); columns = desempenho,
// left ("baixo") to right ("alto") — standard nine-box orientation.
const NINE_BOX_ROWS = ["alto", "medio", "baixo"] as const;
const NINE_BOX_COLS = ["baixo", "medio", "alto"] as const;

function NineBoxSubSection({ userId, placements }: { userId: string; placements: NineBoxPlacement[] }) {
  const current = placements[0];
  return (
    <div className={styles.section}>
      <p>
        {current
          ? `Posição atual: desempenho ${current.desempenho}, potencial ${current.potencial}`
          : "Nenhum posicionamento registrado."}
      </p>
      <div className={styles.nineBoxAxis}>Potencial ↑ · Desempenho →</div>
      <div className={styles.nineBoxLayout}>
        <div className={styles.nineBoxRowLabels}>
          {NINE_BOX_ROWS.map((potencial) => (
            <div key={potencial} className={styles.nineBoxRowLabel}>
              {NINE_BOX_AXIS_LABEL[potencial]}
            </div>
          ))}
        </div>
        <div>
          <div className={styles.nineBoxGrid}>
            {NINE_BOX_ROWS.flatMap((potencial) =>
              NINE_BOX_COLS.map((desempenho) => {
                const isActive = current?.potencial === potencial && current?.desempenho === desempenho;
                return (
                  <div
                    key={`${potencial}-${desempenho}`}
                    className={isActive ? `${styles.nineBoxCell} ${styles.nineBoxCellActive}` : styles.nineBoxCell}
                  >
                    {NINE_BOX_AXIS_LABEL[desempenho]} / {NINE_BOX_AXIS_LABEL[potencial]}
                  </div>
                );
              }),
            )}
          </div>
          <div className={styles.nineBoxColLabels}>
            {NINE_BOX_COLS.map((desempenho) => (
              <span key={desempenho}>{NINE_BOX_AXIS_LABEL[desempenho]}</span>
            ))}
          </div>
        </div>
      </div>
      <form action={createNineBoxPlacement} className={styles.form}>
        <input type="hidden" name="userId" value={userId} />
        <label>
          Desempenho
          <select name="desempenho" required className={styles.input}>
            <option value="baixo">Baixo</option>
            <option value="medio">Médio</option>
            <option value="alto">Alto</option>
          </select>
        </label>
        <label>
          Potencial
          <select name="potencial" required className={styles.input}>
            <option value="baixo">Baixo</option>
            <option value="medio">Médio</option>
            <option value="alto">Alto</option>
          </select>
        </label>
        <button type="submit">Registrar posição</button>
      </form>
    </div>
  );
}
