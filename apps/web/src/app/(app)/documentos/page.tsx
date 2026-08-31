import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { AtestadoPhotoButton } from "./atestado-photo-button";
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

type AdmissionDocument = {
  id: string;
  userId: string;
  userName: string;
  title: string;
  status: string;
  submittedAt: string;
};

type CertificationDoc = {
  id: string;
  userId: string;
  userName: string;
  name: string;
  institution: string;
  validUntil: string;
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

  const [atestados, admissionDocuments, certifications] = await Promise.all([
    apiFetchJson<Atestado[]>("/atestados/team"),
    apiFetchJson<AdmissionDocument[]>("/documentos/admissionais/equipe"),
    apiFetchJson<CertificationDoc[]>("/documentos/certificacoes/equipe"),
  ]);

  if (atestados.length === 0 && admissionDocuments.length === 0 && certifications.length === 0) {
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

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Atestados</h2>
        {atestados.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum atestado enviado ainda.</p>
        ) : (
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
              {session.role === "rh" ? <AtestadoPhotoButton id={atestado.id} /> : null}
            </li>
          );
        })}
      </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Documentos admissionais</h2>
        {admissionDocuments.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum documento admissional enviado ainda.</p>
        ) : (
          <ul className={styles.list}>
            {admissionDocuments.map((document) => (
              <li key={document.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{document.userName}</span>
                    <span className={styles.itemDetail}>
                      {document.title} · enviado em {formatDate(document.submittedAt)}
                    </span>
                  </div>
                  <span className={styles.status}>{document.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Certificações</h2>
        {certifications.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhuma certificação enviada ainda.</p>
        ) : (
          <ul className={styles.list}>
            {certifications.map((certification) => (
              <li key={certification.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{certification.userName}</span>
                    <span className={styles.itemDetail}>
                      {certification.name} · {certification.institution} · válida até{" "}
                      {formatDate(certification.validUntil)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
