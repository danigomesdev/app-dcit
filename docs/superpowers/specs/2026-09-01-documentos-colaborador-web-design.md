# Documentos — Colaborador — Web

**Status:** Proposto
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)
**Spec anterior (mesmo portal):** [`2026-09-01-ferias-colaborador-web-design.md`](2026-09-01-ferias-colaborador-web-design.md)
**Referência mobile (mesma lógica, sem mudança aqui):** `apps/mobile/src/app/(tabs)/documentos.tsx` (seções `AdmissionaisSection`, `AtestadosSection`, `CertificacoesSection`), `apps/mobile/src/lib/documentos-api.ts`, `apps/mobile/src/lib/atestados-api.ts`, `apps/mobile/src/lib/atestado-ocr.ts`

## 1. Objetivo e escopo

Quinto sub-projeto do portal de autoatendimento do colaborador na web. O colaborador consegue enviar e ver os próprios documentos admissionais, atestados (com leitura automática por IA da foto) e certificações — três abas dentro de uma única página `/documentos`, mirror de `documentos.tsx` (mobile), sem a aba de Holerites (o colaborador já tem `/holerites` como página própria, com `roles` incluindo `colaborador`).

A API já entrega tudo isso pronto: `POST`/`GET /documentos/admissionais`, `POST`/`GET /documentos/certificacoes` e `POST /atestados` + `GET /atestados/mine` + `POST /atestados/ocr` já aceitam o colaborador autenticado sem nenhuma restrição de role (só as variantes `/equipe` e `/team`, e a atualização de status, são `gestor`/`rh`). **Nenhuma mudança de backend nesta spec.**

Diferente de Férias (guarda exclusiva), `/documentos` já existe hoje para gestor/RH — a rota é reaproveitada e ramificada por role dentro do mesmo `page.tsx`, no mesmo padrão já usado em Banco de Horas: `TeamView` é o corpo atual da página, extraído sem nenhuma mudança de comportamento; `ColaboradorView` é inteiramente nova.

Upload de arquivo é uma capacidade nova nesta spec — nenhuma página do web hoje lê um arquivo local (`grep -rn 'type="file"' apps/web/src` não retorna nenhum resultado). É o primeiro formulário do portal que precisa de um componente cliente para algo além de abrir/fechar um diálogo.

Fora de escopo (seção 7 tem a lista completa): Mural (próximo sub-projeto); aprovar/recusar admissionais ou certificações (não existe hoje no backend nem no mobile — só atestados têm workflow de status, e mesmo esse não está exposto na `TeamView` atual, que é somente leitura); editar ou cancelar um envio já feito; Holerites.

## 2. Modelo de dados e backend

Nenhuma mudança. Reaproveita integralmente:

- `POST /documentos/admissionais` (`AuthGuard`, body `{ title: string.min(1), photoUri?: string }` via `AdmissionDocumentInputSchema`) → cria `AdmissionDocument` com `status: "enviado"`. **Atenção ao nome do campo**: apesar de a foto ser uma data URL (igual ao atestado), o schema mantém o nome histórico `photoUri` — não há validação de formato nele (diferente de `AtestadoInputSchema.photoDataUrl`, que exige o padrão `data:image\/(jpeg|png|webp);base64,`). A Server Action deve enviar `photoUri` como chave, mesmo carregando uma data URL completa.
- `GET /documentos/admissionais` (`AuthGuard`) → lista os próprios documentos, `orderBy submittedAt desc`. Cada item: `{ id, userId, title, photoUri: string | null, status, submittedAt }`.
- `POST /documentos/certificacoes` (`AuthGuard`, body `{ name: min(1), institution: min(1), validUntil: string.regex(/^\d{2}\/\d{2}\/\d{4}$/) }` via `CertificationInputSchema`) → cria `Certification`. **`validUntil` é texto livre no formato `DD/MM/AAAA`** (mesmo padrão do mobile, sem date picker) — o serviço (`parseDateBR`) converte para `DateTime` internamente.
- `GET /documentos/certificacoes` (`AuthGuard`) → lista as próprias, `orderBy createdAt desc`. Cada item: `{ id, userId, name, institution, validUntil: string(ISO), createdAt }`. Sem campo de status — `Certification` não tem workflow de aprovação no schema.
- `POST /atestados` (`AuthGuard`, body `{ cid: min(1), crm: min(1), medico: min(1), dias: number.int().positive(), photoDataUrl?: string.regex(/^data:image\/(jpeg|png|webp);base64,/) }` via `AtestadoInputSchema`) → cria `Atestado` com `status: "enviado"`.
- `GET /atestados/mine` (`AuthGuard`) → lista os próprios, sem mascaramento (o mascaramento de `cid`/`crm`/`medico` só se aplica a `listTeam`, que é a visão de gestor). Cada item: `{ id, userId, userName, cid, crm, medico, dias, status, reviewNote, createdAt }` — **sem `photoDataUrl`** (o serviço nunca inclui esse campo em respostas de lista, só em `GET /atestados/:id/photo`, que é `rh`-only e não se aplica ao colaborador vendo os próprios).
- `POST /atestados/ocr` (`AuthGuard`, body `{ imageBase64: string.min(1), mediaType: "image/jpeg"|"image/png"|"image/webp" }` via `AtestadoOcrRequestSchema`) → retorna `{ cid: string|null, crm: string|null, medico: string|null, dias: number|null }`. **`imageBase64` é o base64 puro, sem o prefixo `data:...;base64,`** — diferente do `photoDataUrl` do `POST /atestados`, que exige exatamente esse prefixo. O cliente web precisa gerar as duas representações a partir do mesmo arquivo.

## 3. Web (`apps/web`)

### 3.1 `apps/web/src/app/(app)/documentos/page.tsx` — branch por role no mesmo arquivo

Mesmo padrão de `banco-de-horas/page.tsx`:

```tsx
export default async function DocumentosPage() {
  const session = await getSession();
  if (!session) {
    return <EmptyState title="Sem permissão" description="Faça login para continuar." />;
  }
  if (session.role === "colaborador") {
    return <ColaboradorView />;
  }
  return <TeamView session={session} />;
}
```

`TeamView` é a função extraída do corpo atual do componente (linhas 48-181 do arquivo hoje, incluindo o guard `session.role === "colaborador"` que passa a ser redundante ali mas é inofensivo deixá-lo — mesma decisão já tomada para `TeamView` em Banco de Horas) — **sem nenhuma mudança de comportamento**, só renomeada/extraída, recebendo `session` como prop (precisa de `session.role` para a lógica do botão "Ver foto").

Correção pontual ao mover: `formatDate` (linha 44-46 hoje) não passa `timeZone: "UTC"` — diferente de toda outra página deste portal (`aprovacoes`, `banco-de-horas`, `ferias`), que já usa esse padrão explicitamente por causa de um bug real encontrado na revisão final da spec de Férias (formatar uma data-only/UTC-midnight sem fixar o fuso desloca o dia exibido). Como este `formatDate` passa a ser reaproveitado por `ColaboradorView` também, a correção é obrigatória, não opcional:

```typescript
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
```

`STATUS_LABEL` (linhas 37-42 hoje, hoje só tipado para `Atestado["status"]`) passa a ser reaproveitado também pela lista de admissionais do colaborador (ver 3.3) — generalizar o tipo:

```typescript
type DocumentStatus = "enviado" | "em_analise" | "aprovado" | "recusado";

const STATUS_LABEL: Record<DocumentStatus, string> = {
  enviado: "Enviado",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  recusado: "Recusado",
};
```

`TeamView`'s `AdmissionDocument` local type e a linha `<span className={styles.status}>{document.status}</span>` (hoje mostrando o valor cru) passam a usar `STATUS_LABEL[document.status as DocumentStatus]` — pequena melhoria pontual (mesmo raciocínio: já estamos mexendo nesse trecho, e mostrar `"enviado"` cru para um humano é pior que mostrar `"Enviado"`), sem mudar o texto de nenhum teste existente que não force essa string exata (conferir `documentos.spec.ts` antes — os testes atuais de admissionais/certificações não afirmam o texto do status, só presença do nome do colaborador e dos headings, então a mudança é segura).

### 3.2 `ColaboradorView` — três abas fixas via query string

```typescript
type Categoria = "admissionais" | "atestados" | "certificacoes";

const CATEGORIA_LABEL: Record<Categoria, string> = {
  admissionais: "Admissionais",
  atestados: "Atestados",
  certificacoes: "Certificações",
};

function resolveCategoria(value: string | undefined): Categoria {
  return value === "admissionais" || value === "certificacoes" ? value : "atestados";
}
```

Default `"atestados"` — mesma escolha do mobile (`useState<Category>("atestados")`, linha 47 de `documentos.tsx`), não `"admissionais"`.

Tipos locais (mesmo raciocínio de duplicação já aceito nas specs anteriores — não vale a pena promover para `shared-types`):

```typescript
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
```

Corpo de `ColaboradorView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> })` (assinatura de Server Component com `searchParams` como Promise, mesmo padrão já usado em `banco-de-horas/page.tsx`'s `ColaboradorView`):

1. `const params = await searchParams; const categoria = resolveCategoria(typeof params.categoria === "string" ? params.categoria : undefined);`
2. Busca em paralelo, sempre as três (não só a categoria ativa — mesma decisão simples já usada em Banco de Horas para as três abas de período, evita um segundo round-trip ao trocar de aba):
   ```typescript
   const [admissionDocuments, certifications, atestados] = await Promise.all([
     apiFetchJson<AdmissionDocumentRecord[]>("/documentos/admissionais"),
     apiFetchJson<CertificationRecord[]>("/documentos/certificacoes"),
     apiFetchJson<AtestadoRecord[]>("/atestados/mine"),
   ]);
   ```
3. Renderiza:
   - `<h1>Documentos</h1>`
   - Abas de categoria (`.categoryTabs`/`.categoryTab`/`.categoryTabActive` — mesma classe/estrutura visual de `.periodTabs` em `banco-de-horas.module.css`, renomeada para este contexto): 3 links (`?categoria=admissionais`, `?categoria=atestados`, `?categoria=certificacoes`), rotulados via `CATEGORIA_LABEL`.
   - `{categoria === "admissionais" ? <AdmissionaisSection documents={admissionDocuments} /> : null}`
   - `{categoria === "atestados" ? <AtestadosSection atestados={atestados} /> : null}`
   - `{categoria === "certificacoes" ? <CertificacoesSection certifications={certifications} /> : null}`

### 3.3 `AdmissionaisSection` — Server Component, formulário simples

Sem interatividade além do upload de foto (ver 3.6 para o componente de upload compartilhado):

```tsx
function AdmissionaisSection({ documents }: { documents: AdmissionDocumentRecord[] }) {
  return (
    <div className={styles.categorySection}>
      <h2 className={styles.sectionTitle}>Enviar documento admissional</h2>
      <form className={styles.form} action={submitAdmissionDocument}>
        <label htmlFor="title">Título</label>
        <input id="title" name="title" type="text" className={styles.textInput} required />
        <PhotoUploadField name="photo" label="Foto (opcional)" />
        <button type="submit" className={styles.submitButton}>Enviar</button>
      </form>

      <h2 className={styles.sectionTitle}>Meus documentos admissionais</h2>
      {documents.length === 0 ? (
        <p className={styles.sectionEmpty}>Nenhum documento admissional enviado ainda.</p>
      ) : (
        <ul className={styles.list}>
          {documents.map((document) => (
            <li key={document.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{document.title}</span>
                <span className={styles.itemDetail}>
                  Enviado em {formatDate(document.submittedAt)}
                </span>
              </div>
              <span className={`${styles.status} ${document.status === "aprovado" ? styles.statusAprovado : ""}`}>
                {STATUS_LABEL[document.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### 3.4 `CertificacoesSection` — Server Component, sem foto

```tsx
function CertificacoesSection({ certifications }: { certifications: CertificationRecord[] }) {
  return (
    <div className={styles.categorySection}>
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
        <button type="submit" className={styles.submitButton}>Salvar</button>
      </form>

      <h2 className={styles.sectionTitle}>Minhas certificações</h2>
      {certifications.length === 0 ? (
        <p className={styles.sectionEmpty}>Nenhuma certificação cadastrada ainda.</p>
      ) : (
        <ul className={styles.list}>
          {certifications.map((certification) => (
            <li key={certification.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{certification.name}</span>
                <span className={styles.itemDetail}>
                  {certification.institution} · válida até {formatDate(certification.validUntil)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

`pattern="\d{2}/\d{2}/\d{4}"` é validação HTML5 client-side (evita um round-trip óbvio de erro), mas a validação real continua sendo o `CertificationInputSchema` no backend — mesmo raciocínio de "não confiar só no client" já aplicado em todo o resto do app.

### 3.5 `AtestadoForm` — o único Client Component novo com estado de formulário

Diferente das duas seções acima, o atestado precisa de campos controlados porque o OCR os preenche depois da montagem inicial. Fica em `apps/web/src/app/(app)/documentos/atestado-form.tsx`:

```tsx
"use client";

import { useState } from "react";

import { runAtestadoOcr, submitAtestado } from "./actions";
import { PhotoUploadField, type PickedPhoto } from "./photo-upload-field";
import styles from "./documentos.module.css";

type OcrStatus = "idle" | "loading" | "done" | "error";

export function AtestadoForm() {
  const [cid, setCid] = useState("");
  const [crm, setCrm] = useState("");
  const [medico, setMedico] = useState("");
  const [dias, setDias] = useState("");
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle");

  async function handlePhotoPicked(picked: PickedPhoto) {
    setPhoto(picked);
    setOcrStatus("loading");
    const result = await runAtestadoOcr(picked.base64, picked.mediaType);
    if (!result) {
      setOcrStatus("error");
      return;
    }
    if (result.cid) setCid(result.cid);
    if (result.crm) setCrm(result.crm);
    if (result.medico) setMedico(result.medico);
    if (result.dias) setDias(String(result.dias));
    setOcrStatus("done");
  }

  return (
    <form
      className={styles.form}
      action={async (formData) => {
        await submitAtestado(formData);
        setCid("");
        setCrm("");
        setMedico("");
        setDias("");
        setPhoto(null);
        setOcrStatus("idle");
      }}
    >
      <PhotoUploadField name="photo" label="Foto do atestado (opcional)" onPicked={handlePhotoPicked} />

      {ocrStatus !== "idle" ? (
        <p className={styles.ocrStatus}>
          {ocrStatus === "loading"
            ? "Lendo o atestado automaticamente…"
            : ocrStatus === "done"
              ? "Dados preenchidos automaticamente — confira antes de enviar."
              : "Não foi possível ler automaticamente — preencha os dados abaixo manualmente."}
        </p>
      ) : null}

      <label htmlFor="cid">CID</label>
      <input id="cid" name="cid" type="text" value={cid} onChange={(e) => setCid(e.target.value)} className={styles.textInput} required />
      <label htmlFor="crm">CRM do médico</label>
      <input id="crm" name="crm" type="text" value={crm} onChange={(e) => setCrm(e.target.value)} className={styles.textInput} required />
      <label htmlFor="medico">Nome do médico</label>
      <input id="medico" name="medico" type="text" value={medico} onChange={(e) => setMedico(e.target.value)} className={styles.textInput} required />
      <label htmlFor="dias">Quantidade de dias</label>
      <input id="dias" name="dias" type="number" min="1" step="1" value={dias} onChange={(e) => setDias(e.target.value)} className={styles.textInput} required />

      <button type="submit" className={styles.submitButton}>Enviar</button>
    </form>
  );
}
```

`action={async (formData) => { ... }}` — uma função inline que chama a Server Action e depois limpa o estado local do formulário; isso é necessário porque `photo`/`ocrStatus` são estado do cliente, não algo que `revalidatePath` reseta sozinho (diferente de todo formulário anterior neste portal, que é stateless e reseta naturalmente porque é Server Component). `submitAtestado` continua sendo uma Server Action de verdade (`"use server"`), só chamada indiretamente em vez de via `action={submitAtestado}` direto.

`AtestadosSection` (Server Component) só compõe `AtestadoForm` com a lista, mesmo padrão de `AdmissionaisSection`:

```tsx
function AtestadosSection({ atestados }: { atestados: AtestadoRecord[] }) {
  return (
    <div className={styles.categorySection}>
      <h2 className={styles.sectionTitle}>Enviar atestado</h2>
      <AtestadoForm />

      <h2 className={styles.sectionTitle}>Meus atestados</h2>
      {atestados.length === 0 ? (
        <p className={styles.sectionEmpty}>Nenhum atestado enviado ainda.</p>
      ) : (
        <ul className={styles.list}>
          {atestados.map((atestado) => (
            <li key={atestado.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>
                  {atestado.dias != null ? `${atestado.dias} dia(s)` : "Dias não informados"}
                </span>
                <span className={styles.itemDetail}>Enviado em {formatDate(atestado.createdAt)}</span>
                {atestado.reviewNote ? <span className={styles.itemNote}>{atestado.reviewNote}</span> : null}
              </div>
              <span className={`${styles.status} ${atestado.status === "aprovado" ? styles.statusAprovado : ""}`}>
                {STATUS_LABEL[atestado.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

CID/CRM/médico não aparecem na própria listagem do colaborador — são dados de entrada do formulário, não há necessidade de repeti-los na lista (o mobile também não repete, só mostra dias/status — ver `documentos.tsx` linhas 357-384 e a `StatusBadge`).

### 3.6 `PhotoUploadField` — Client Component compartilhado, único ponto de leitura de arquivo

`apps/web/src/app/(app)/documentos/photo-upload-field.tsx` (novo):

```tsx
"use client";

import { useRef, useState } from "react";

import styles from "./documentos.module.css";

export type PickedPhoto = { dataUrl: string; base64: string; mediaType: string };

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function PhotoUploadField({
  name,
  label,
  onPicked,
}: {
  name: string;
  label: string;
  onPicked?: (photo: PickedPhoto) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(true);
      setPreview(null);
      return;
    }
    setError(false);
    const dataUrl = await readFileAsDataUrl(file);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    setPreview(dataUrl);
    if (hiddenInputRef.current) hiddenInputRef.current.value = dataUrl;
    onPicked?.({ dataUrl, base64, mediaType: file.type });
  }

  return (
    <div className={styles.photoField}>
      <label htmlFor={`${name}-input`}>{label}</label>
      <input
        id={`${name}-input`}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleChange}
        className={styles.fileInput}
      />
      {error ? <p className={styles.photoFieldError}>Formato não suportado — use JPEG, PNG ou WEBP.</p> : null}
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable remote asset
        <img src={preview} alt="Pré-visualização" className={styles.photoPreview} />
      ) : null}
      <input ref={hiddenInputRef} type="hidden" name={name} />
    </div>
  );
}
```

O `<input type="hidden" name={name}>` é o que carrega a data URL para dentro do `FormData` do `<form action={...}>` que envolve este componente — assim `AdmissionaisSection` (Server Component puro) continua funcionando com uma Server Action nativa, sem precisar de estado de formulário próprio; só o pedaço de leitura de arquivo é client-side. Em `AtestadoForm` (3.5), o mesmo componente é usado, mas seu `onPicked` também dispara o OCR.

### 3.7 `apps/web/src/app/(app)/documentos/actions.ts` — três novas Server Actions

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { apiFetch, apiFetchJson } from "@/lib/api";

export async function getAtestadoPhoto(id: string): Promise<string | null> {
  // ... inalterado (já existe)
}

export async function submitAdmissionDocument(formData: FormData) {
  const title = formData.get("title");
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new Error("Título é obrigatório.");
  }
  const photo = formData.get("photo");
  const res = await apiFetch("/documentos/admissionais", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: title.trim(),
      photoUri: typeof photo === "string" && photo.length > 0 ? photo : undefined,
    }),
  });
  if (!res.ok) {
    throw new Error(`/documentos/admissionais responded with ${res.status}`);
  }
  revalidatePath("/documentos");
}

export async function submitCertification(formData: FormData) {
  const name = formData.get("name");
  const institution = formData.get("institution");
  const validUntil = formData.get("validUntil");
  if (
    typeof name !== "string" || name.trim().length === 0 ||
    typeof institution !== "string" || institution.trim().length === 0 ||
    typeof validUntil !== "string" || !/^\d{2}\/\d{2}\/\d{4}$/.test(validUntil)
  ) {
    throw new Error("Preencha nome, instituição e uma data válida (DD/MM/AAAA).");
  }
  const res = await apiFetch("/documentos/certificacoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim(), institution: institution.trim(), validUntil }),
  });
  if (!res.ok) {
    throw new Error(`/documentos/certificacoes responded with ${res.status}`);
  }
  revalidatePath("/documentos");
}

export async function submitAtestado(formData: FormData) {
  const cid = formData.get("cid");
  const crm = formData.get("crm");
  const medico = formData.get("medico");
  const diasRaw = formData.get("dias");
  const photo = formData.get("photo");
  const dias = typeof diasRaw === "string" ? Number.parseInt(diasRaw, 10) : NaN;
  if (
    typeof cid !== "string" || cid.trim().length === 0 ||
    typeof crm !== "string" || crm.trim().length === 0 ||
    typeof medico !== "string" || medico.trim().length === 0 ||
    !Number.isInteger(dias) || dias <= 0
  ) {
    throw new Error("Preencha CID, CRM, médico e uma quantidade de dias válida.");
  }
  const res = await apiFetch("/atestados", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cid: cid.trim(),
      crm: crm.trim(),
      medico: medico.trim(),
      dias,
      photoDataUrl: typeof photo === "string" && photo.length > 0 ? photo : undefined,
    }),
  });
  if (!res.ok) {
    throw new Error(`/atestados responded with ${res.status}`);
  }
  revalidatePath("/documentos");
}

export async function runAtestadoOcr(
  base64: string,
  mediaType: string,
): Promise<{ cid: string | null; crm: string | null; medico: string | null; dias: number | null } | null> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) return null;
  try {
    return await apiFetchJson(`/atestados/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64, mediaType }),
    } as never); // apiFetchJson hoje só aceita (path); ver nota abaixo
  } catch {
    return null;
  }
}
```

**Nota de implementação:** `apiFetchJson<T>(path: string): Promise<T>` (`apps/web/src/lib/api.ts`) hoje só aceita `path`, sempre um `GET` implícito via `apiFetch(path)` sem `init`. `runAtestadoOcr` precisa de um `POST` com corpo — a alternativa mais simples, consistente com todo o resto do arquivo, é não usar `apiFetchJson` aqui e replicar o padrão de `apiFetch` + `res.json()` manual, igual a `getAtestadoPhoto` já faz:

```typescript
export async function runAtestadoOcr(
  base64: string,
  mediaType: string,
): Promise<{ cid: string | null; crm: string | null; medico: string | null; dias: number | null } | null> {
  const res = await apiFetch("/atestados/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mediaType }),
  });
  if (!res.ok) return null;
  return res.json();
}
```

`runAtestadoOcr` **nunca lança** (retorna `null` em qualquer falha) — mesmo contrato do `extractAtestadoData` no mobile (`atestado-ocr.ts`, "never throws"), porque uma falha de OCR não deve impedir o preenchimento manual.

### 3.8 `documentos.module.css` — classes novas

Reaproveita `.page`, `.heading`, `.section`→renomeado para `.categorySection` (mesmo propósito, nome mais específico já que agora convive com as abas), `.sectionTitle`, `.sectionEmpty`, `.list`, `.item`, `.itemHeader`→`.itemInfo` já é o padrão usado nas specs de Banco de Horas/Férias (mais consistente entre sub-projetos que o `.itemHeader`/`.itemInfo` misto atual — usar `.itemInfo` sozinho, igual Férias), `.itemName`, `.itemDetail`, `.status`, `.statusAprovado`. Classes novas:

```css
.categoryTabs {
  display: flex;
  gap: 8px;
}

.categoryTab {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-background-element);
}

.categoryTab:hover {
  color: var(--color-text);
}

.categoryTabActive,
.categoryTabActive:hover {
  background: var(--color-text);
  color: var(--color-background);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 480px;
}

.textInput {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-background-selected);
  background: var(--color-background-element);
  color: var(--color-text);
  font: inherit;
}

.submitButton {
  align-self: flex-start;
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  background: var(--color-text);
  color: var(--color-background);
  font-weight: 600;
  cursor: pointer;
}

.itemNote {
  font-size: 13px;
  color: #f87171;
}

.photoField {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fileInput {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.photoFieldError {
  font-size: 13px;
  color: #f87171;
}

.photoPreview {
  max-width: 240px;
  max-height: 240px;
  border-radius: 8px;
  object-fit: cover;
}

.ocrStatus {
  font-size: 13px;
  color: var(--color-text-secondary);
}
```

### 3.9 `nav-sections.ts`

`NAV_SECTIONS`'s existing `/documentos` entry (linha 18) ganha `"colaborador"`:

```typescript
{ href: "/documentos", label: "Documentos", roles: ["gestor", "rh", "colaborador"] },
```

`COLABORADOR_SIDEBAR` ganha um item de topo novo, irmão de "Banco de Horas" e "Férias" (mesma estrutura já anticipada no comentário do próprio arquivo):

```typescript
export const COLABORADOR_SIDEBAR: SidebarEntry[] = [
  {
    href: "/",
    label: "Ponto",
    children: [
      { href: "/historico", label: "Histórico de Pontos" },
      { href: "/folha", label: "Folha de Ponto" },
    ],
  },
  { href: "/banco-de-horas", label: "Banco de Horas" },
  { href: "/ferias", label: "Férias" },
  { href: "/documentos", label: "Documentos" },
];
```

## 4. Mobile

Nenhuma mudança de código.

## 5. Testes

- **`documentos.spec.ts`**: o teste existente `"colaborador sees a permission message instead of the documents list"` **deixa de ser válido** (colaborador agora vê uma página real, mesmo raciocínio já documentado na spec de Banco de Horas para o teste equivalente) — substituído por uma suíte nova cobrindo `ColaboradorView`:
  - Abas de categoria aparecem, com "Atestados" ativo por padrão (default do mobile); trocar de aba navega para `?categoria=admissionais`/`?categoria=certificacoes` e a aba correspondente vira a ativa.
  - **Admissionais**: enviar o formulário (só título, sem foto) faz `POST /documentos/admissionais` com `{ title, photoUri: undefined }` (via `getRecordedRequests`) e a lista recarrega mostrando o novo item; envio com foto simulada (via `setInputFiles` do Playwright num `<input type="file">`) inclui `photoUri` como uma data URL no corpo da requisição; mensagem vazia quando não há documentos.
  - **Certificações**: enviar o formulário faz `POST /documentos/certificacoes` com os três campos; validação de formato de data rejeitada pelo `pattern` do HTML5 (não precisa de teste de E2E para isso — é validação nativa do browser) mas uma tentativa com formato inválido que passe pelo `pattern` (ex.: um valor idêntico em formato mas semanticamente inválido não existe aqui, então o único teste de validação relevante é o caminho feliz); mensagem vazia quando não há certificações.
  - **Atestados**: preencher CID/CRM/médico/dias manualmente (sem foto) e enviar faz `POST /atestados` com os campos e sem `photoDataUrl`; anexar uma foto simulada dispara `POST /atestados/ocr` (mockado via `seedResponse`) e os campos são preenchidos automaticamente — depois de editados manualmente, o valor editado é o que é enviado (prova que os inputs continuam controláveis, não travados pelo OCR); uma resposta de OCR com todos os campos `null` deixa os inputs vazios para preenchimento manual, sem travar o formulário; um atestado com `status: "recusado"` mostra o `reviewNote`; mensagem vazia quando não há atestados.
  - Gestor e RH continuam vendo `TeamView` exatamente como antes — todos os testes já existentes (`"rh sees clinical detail..."`, `"rh can view the atestado photo..."`, `"lists admission documents and certifications..."`) **continuam passando sem alteração**, já que `TeamView` não muda de comportamento, só foi extraída para uma função.
- **`test-session.ts`**: `mockApi`'s `data` ganha três chaves novas, seguindo o padrão já estabelecido (uma delas plural-array, as outras idem):
  ```typescript
  myAdmissionDocuments?: unknown[];
  myCertifications?: unknown[];
  myAtestados?: unknown[];
  ```
  seedando `/documentos/admissionais`, `/documentos/certificacoes` e `/atestados/mine` respectivamente. `fake-api-server.mjs` não precisa de rota nova para os `POST`s — cobertos pelo helper genérico `seedResponse`, e `POST /atestados/ocr` também via `seedResponse`.
- **`app-shell.spec.ts`**: o teste `"colaborador sees a curated, grouped sidebar..."` ganha uma asserção a mais — `page.getByRole("link", { name: "Documentos" })` visível como item de topo.
- **`search.spec.ts`**: ganha um teste novo — "Documentos" aparece nos resultados de busca do colaborador.

## 6. Global Constraints (herdadas + novas)

- Sem mudança de backend — toda a superfície de API já existe e já aceita o colaborador.
- `formatDate` em `documentos/page.tsx` ganha `timeZone: "UTC"` ao ser extraída para reuso — correção obrigatória, não cosmética, dado o bug real já encontrado na revisão final de Férias com exatamente essa classe de problema.
- `photoUri` (admissionais) e `photoDataUrl` (atestados) continuam com nomes de campo diferentes no payload da API, ambos carregando uma data URL completa — não unificar nomes nesta spec (mudança de backend, fora de escopo).
- `imageBase64` (OCR) é base64 puro sem prefixo; `photoDataUrl`/`photoUri` (create) são data URLs completas com prefixo — o cliente deriva as duas representações do mesmo `FileReader.readAsDataURL()`, nunca faz uma segunda leitura de arquivo.
- `runAtestadoOcr` nunca lança — retorna `null` em qualquer falha (rede, resposta não-ok, tipo de mídia inválido), mesmo contrato do equivalente mobile.
- `AtestadoForm` é o único Client Component com estado de formulário deste sub-projeto — `AdmissionaisSection`/`CertificacoesSection` continuam Server Components puros com `<form action={...}>` nativo; só `PhotoUploadField` (o pedaço de leitura de arquivo) é client-side em todos os três casos.
- `COLABORADOR_SIDEBAR`: item novo é irmão de "Ponto", "Banco de Horas" e "Férias", não filho de nenhum — mesma estrutura combinada para o próximo sub-projeto (Mural).

## 7. Fora de escopo

- Mural — próximo sub-projeto, spec própria.
- Aprovar/recusar admissionais ou certificações — não existe hoje no backend nem no mobile; só atestados têm workflow de status, e a `TeamView` atual nem expõe essa ação na web (só lê).
- Editar ou cancelar um documento/atestado/certificação já enviado.
- Holerites — já é página própria do colaborador (`/holerites`), fora do escopo desta spec.
- Unificar os nomes de campo `photoUri`/`photoDataUrl` na API — mudança de backend.
- Câmera nativa/captura direta — `<input type="file" accept="...">` já permite abrir a câmera em navegadores móveis via o próprio seletor do SO; não há necessidade de UI dedicada de captura como no mobile (`pickPhoto("camera")` vs `pickPhoto("library")` como dois botões separados).
