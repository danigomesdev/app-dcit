import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import styles from "./documentos.module.css";

type Atestado = {
  id: string;
  userName: string;
  cid: string | null;
  crm: string | null;
  medico: string | null;
  dias: number | null;
  status: "enviado" | "em_analise" | "aprovado" | "recusado";
  createdAt: string;
};

const STATUS_LABEL: Record<Atestado["status"], string> = {
  enviado: "Enviado",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

export default async function DocumentosPage() {
  const session = await getSession();
  if (!session || session.role === "colaborador") {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é restrita a gestores e RH."
      />
    );
  }

  const atestados = await apiFetchJson<Atestado[]>("/atestados/team");

  if (atestados.length === 0) {
    return (
      <EmptyState
        title="Documentos e atestados"
        description="Os documentos e atestados enviados pelos colaboradores vão aparecer aqui."
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Documentos e atestados</h1>
      <ul className={styles.list}>
        {atestados.map((atestado) => {
          // cid/crm/medico only arrive non-null for an RH viewer — the API
          // masks them server-side for gestor (see AtestadosService.listTeam).
          const hasClinicalDetail = atestado.cid || atestado.crm || atestado.medico;

          return (
            <li key={atestado.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{atestado.userName}</span>
                  <span className={styles.itemDetail}>
                    {atestado.dias != null ? `${atestado.dias} dia(s)` : "Dias não informados"} ·
                    enviado em {formatDate(atestado.createdAt)}
                  </span>
                </div>
                <span
                  className={`${styles.status} ${
                    atestado.status === "aprovado" ? styles.statusAprovado : ""
                  }`}
                >
                  {STATUS_LABEL[atestado.status]}
                </span>
              </div>
              {hasClinicalDetail ? (
                <div className={styles.clinical}>
                  {atestado.cid ? (
                    <span>
                      <strong>CID:</strong> {atestado.cid}
                    </span>
                  ) : null}
                  {atestado.medico ? (
                    <span>
                      <strong>Médico:</strong> {atestado.medico}
                    </span>
                  ) : null}
                  {atestado.crm ? (
                    <span>
                      <strong>CRM:</strong> {atestado.crm}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
