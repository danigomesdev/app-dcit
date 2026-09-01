import type { Session } from "@/lib/session";
import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { submitAdmissionDocument, submitCertification } from "./actions";
import { AtestadoForm } from "./atestado-form";
import { AtestadoPhotoButton } from "./atestado-photo-button";
import styles from "./documentos.module.css";
import { PhotoUploadField } from "./photo-upload-field";

type DocumentStatus = "enviado" | "em_analise" | "aprovado" | "recusado";

const STATUS_LABEL: Record<DocumentStatus, string> = {
  enviado: "Enviado",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

type Atestado = {
  id: string;
  userName: string;
  cid: string | null;
  crm: string | null;
  medico: string | null;
  dias: number | null;
  status: DocumentStatus;
  createdAt: string;
};

type AdmissionDocument = {
  id: string;
  userId: string;
  userName: string;
  title: string;
  status: DocumentStatus;
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

// API DateTime fields arrive as full ISO instant strings (Prisma DateTime ->
// JSON) — timeZone: "UTC" here is not cosmetic: without it, a UTC-midnight
// value shifts to the previous local day (the exact bug the Férias sub-
// project's final review caught and fixed in its own formatDate).
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) {
    return <EmptyState title="Sem permissão" description="Faça login para continuar." />;
  }
  if (session.role === "colaborador") {
    return <ColaboradorView searchParams={searchParams} />;
  }
  return <TeamView session={session} />;
}

async function TeamView({ session }: { session: Session }) {
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
                  <span className={styles.status}>{STATUS_LABEL[document.status]}</span>
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

type Categoria = "admissionais" | "atestados" | "certificacoes";

const CATEGORIA_LABEL: Record<Categoria, string> = {
  admissionais: "Admissionais",
  atestados: "Atestados",
  certificacoes: "Certificações",
};

function resolveCategoria(value: string | undefined): Categoria {
  return value === "admissionais" || value === "certificacoes" ? value : "atestados";
}

type AdmissionDocumentRecord = {
  id: string;
  title: string;
  photoUri: string | null;
  status: DocumentStatus;
  submittedAt: string;
};

type CertificationRecord = {
  id: string;
  name: string;
  institution: string;
  validUntil: string;
};

type AtestadoRecord = {
  id: string;
  cid: string | null;
  crm: string | null;
  medico: string | null;
  dias: number | null;
  status: DocumentStatus;
  reviewNote: string | null;
  createdAt: string;
};

async function ColaboradorView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const categoria = resolveCategoria(typeof params.categoria === "string" ? params.categoria : undefined);

  const [admissionDocuments, certifications, atestados] = await Promise.all([
    apiFetchJson<AdmissionDocumentRecord[]>("/documentos/admissionais"),
    apiFetchJson<CertificationRecord[]>("/documentos/certificacoes"),
    apiFetchJson<AtestadoRecord[]>("/atestados/mine"),
  ]);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Documentos</h1>

      <div className={styles.categoryTabs}>
        {(["admissionais", "atestados", "certificacoes"] as const).map((option) => (
          <a
            key={option}
            className={
              categoria === option
                ? `${styles.categoryTab} ${styles.categoryTabActive}`
                : styles.categoryTab
            }
            href={`/documentos?categoria=${option}`}
          >
            {CATEGORIA_LABEL[option]}
          </a>
        ))}
      </div>

      {categoria === "admissionais" ? (
        <AdmissionaisSection documents={admissionDocuments} />
      ) : null}
      {categoria === "atestados" ? <AtestadosSection atestados={atestados} /> : null}
      {categoria === "certificacoes" ? (
        <CertificacoesSection certifications={certifications} />
      ) : null}
    </div>
  );
}

function AdmissionaisSection({ documents }: { documents: AdmissionDocumentRecord[] }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Enviar documento admissional</h2>
      <form className={styles.form} action={submitAdmissionDocument}>
        <label htmlFor="title">Título</label>
        <input id="title" name="title" type="text" className={styles.textInput} required />
        <PhotoUploadField name="photo" label="Foto (opcional)" />
        <button type="submit" className={styles.submitButton}>
          Enviar
        </button>
      </form>

      <h2 className={styles.sectionTitle}>Meus documentos admissionais</h2>
      {documents.length === 0 ? (
        <p className={styles.sectionEmpty}>Nenhum documento admissional enviado ainda.</p>
      ) : (
        <ul className={styles.list}>
          {documents.map((document) => (
            <li key={document.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{document.title}</span>
                  <span className={styles.itemDetail}>
                    Enviado em {formatDate(document.submittedAt)}
                  </span>
                </div>
                <span
                  className={`${styles.status} ${
                    document.status === "aprovado" ? styles.statusAprovado : ""
                  }`}
                >
                  {STATUS_LABEL[document.status]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AtestadosSection({ atestados }: { atestados: AtestadoRecord[] }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Enviar atestado</h2>
      <AtestadoForm />

      <h2 className={styles.sectionTitle}>Meus atestados</h2>
      {atestados.length === 0 ? (
        <p className={styles.sectionEmpty}>Nenhum atestado enviado ainda.</p>
      ) : (
        <ul className={styles.list}>
          {atestados.map((atestado) => (
            <li key={atestado.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>
                    {atestado.dias != null ? `${atestado.dias} dia(s)` : "Dias não informados"}
                  </span>
                  <span className={styles.itemDetail}>Enviado em {formatDate(atestado.createdAt)}</span>
                  {atestado.reviewNote ? (
                    <span className={styles.itemNote}>{atestado.reviewNote}</span>
                  ) : null}
                </div>
                <span
                  className={`${styles.status} ${
                    atestado.status === "aprovado" ? styles.statusAprovado : ""
                  }`}
                >
                  {STATUS_LABEL[atestado.status]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CertificacoesSection({ certifications }: { certifications: CertificationRecord[] }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Adicionar certificação</h2>
      <form className={styles.form} action={submitCertification}>
        <label htmlFor="name">Nome</label>
        <input id="name" name="name" type="text" className={styles.textInput} required />
        <label htmlFor="institution">Instituição</label>
        <input id="institution" name="institution" type="text" className={styles.textInput} required />
        <label htmlFor="validUntil">Válida até (DD/MM/AAAA)</label>
        <input
          id="validUntil"
          name="validUntil"
          type="text"
          placeholder="DD/MM/AAAA"
          pattern="\d{2}/\d{2}/\d{4}"
          className={styles.textInput}
          required
        />
        <button type="submit" className={styles.submitButton}>
          Salvar
        </button>
      </form>

      <h2 className={styles.sectionTitle}>Minhas certificações</h2>
      {certifications.length === 0 ? (
        <p className={styles.sectionEmpty}>Nenhuma certificação cadastrada ainda.</p>
      ) : (
        <ul className={styles.list}>
          {certifications.map((certification) => (
            <li key={certification.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{certification.name}</span>
                  <span className={styles.itemDetail}>
                    {certification.institution} · válida até {formatDate(certification.validUntil)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
