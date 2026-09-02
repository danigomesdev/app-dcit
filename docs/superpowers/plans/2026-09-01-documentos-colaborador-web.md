# Documentos Colaborador Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the colaborador a working `/documentos` page — upload and view admissionais, atestados (with OCR-assisted CID/CRM/dias extraction), and certificações — reusing the route gestor/RH already have.

**Architecture:** `apps/web/src/app/(app)/documentos/page.tsx` branches by role (like `banco-de-horas/page.tsx`): the existing gestor/RH body becomes `TeamView` (extracted, zero behavior change), and a new `ColaboradorView` renders three category tabs (`?categoria=`), each backed by a Server Component section with a native `<form action={...}>`. File upload is new to this app — a single shared Client Component (`PhotoUploadField`) reads a picked file into a data URL and writes it into a hidden form field, so every surrounding form stays a plain Server Action. Only the atestado form is a Client Component itself, because OCR pre-fills its inputs after the initial render.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions, one Client Component for file reading, one for the OCR-driven form), CSS Modules, Playwright e2e (the only test layer `apps/web` has).

**Spec:** `docs/superpowers/specs/2026-09-01-documentos-colaborador-web-design.md`

## Global Constraints

- No backend changes. Every request in this plan hits an endpoint that already exists and already accepts the colaborador role (`POST`/`GET /documentos/admissionais`, `POST`/`GET /documentos/certificacoes`, `POST /atestados`, `GET /atestados/mine`, `POST /atestados/ocr`).
- `formatDate` gets `timeZone: "UTC"` when extracted — a real bug (not cosmetic) already found in Férias's final review: formatting a UTC-midnight date-only value without pinning the timezone shifts the displayed day.
- `photoUri` (admissionais) and `photoDataUrl` (atestados) are different field names for the same shape (a full `data:image/...;base64,...` string) — never unify them, that's a backend change.
- `imageBase64` (the OCR endpoint) is bare base64, no `data:` prefix — different from `photoUri`/`photoDataUrl`, which both keep the full prefix. The client derives both from one `FileReader.readAsDataURL()` call, never reads the file twice.
- `runAtestadoOcr` never throws — returns `null` on any failure (network, non-ok response, bad media type), so a failed OCR attempt never blocks manual entry.
- `AdmissionaisSection` and `CertificacoesSection` stay Server Components with native `<form action={...}>`; only `AtestadoForm` is a Client Component (it needs controlled inputs so OCR can pre-fill them after mount). `PhotoUploadField` is the one Client Component both forms share for the file-read step.
- `COLABORADOR_SIDEBAR`: the new "Documentos" entry is a sibling of "Ponto", "Banco de Horas", and "Férias" — top-level, not nested.
- Every new/changed behavior gets a Playwright e2e test in `apps/web/e2e/documentos.spec.ts`.

---

## Task 1: Wire `/documentos` into colaborador navigation

**Files:**
- Modify: `apps/web/src/lib/nav-sections.ts`
- Modify: `apps/web/e2e/app-shell.spec.ts`
- Modify: `apps/web/e2e/search.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `/documentos` in `NAV_SECTIONS` with `"colaborador"` added to its `roles`, and a `{ href: "/documentos", label: "Documentos" }` entry in `COLABORADOR_SIDEBAR` that later tasks' page will resolve to.

The colaborador-facing content this points to doesn't exist until Task 3 — that's fine here because neither test clicks through to `/documentos`, they only assert the link/search-result is visible. Today `/documentos` shows an `EmptyState` ("Sem permissão") for colaborador (see `apps/web/src/app/(app)/documentos/page.tsx:50-57`) — that's fine too, it disappears once Task 3 lands.

- [ ] **Step 1: Write the failing tests**

In `apps/web/e2e/app-shell.spec.ts`, inside the existing test `"colaborador sees a curated, grouped sidebar instead of the gestor/rh menu"`, add this assertion right after the existing `Férias` check:

```typescript
  await expect(page.getByRole("link", { name: "Férias" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Documentos" })).toBeVisible();
```

In `apps/web/e2e/search.spec.ts`, add a new test at the end of the file:

```typescript
test("colaborador can find Documentos via search", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");

  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByPlaceholder("Buscar telas...").fill("documentos");

  await expect(page.getByRole("button", { name: "Documentos" })).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx playwright test app-shell.spec.ts search.spec.ts`
Expected: FAIL — `page.getByRole('link', { name: 'Documentos' })` and the search test's `getByRole('button', { name: 'Documentos' })` are not found.

- [ ] **Step 3: Add the nav entries**

In `apps/web/src/lib/nav-sections.ts`, change the `/documentos` line in `NAV_SECTIONS` (currently `{ href: "/documentos", label: "Documentos", roles: ["gestor", "rh"] }`):

```typescript
  { href: "/documentos", label: "Documentos", roles: ["gestor", "rh", "colaborador"] },
```

And append to `COLABORADOR_SIDEBAR` (after the `/ferias` entry):

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx playwright test app-shell.spec.ts search.spec.ts`
Expected: PASS — every pre-existing test in both files still passes unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/nav-sections.ts apps/web/e2e/app-shell.spec.ts apps/web/e2e/search.spec.ts
git commit -m "feat(web): add Documentos to colaborador navigation and search"
```

---

## Task 2: Extract `TeamView`; fix `formatDate` and the admissionais status label

**Files:**
- Modify: `apps/web/src/app/(app)/documentos/page.tsx`
- Modify: `apps/web/e2e/documentos.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `TeamView({ session }: { session: Session }): JSX.Element` (extracted, unchanged behavior except the two fixes below); `DocumentStatus` type and `STATUS_LABEL: Record<DocumentStatus, string>` (generalized from `Atestado["status"]`-only); `formatDate(value: string): string` (now UTC-pinned) — all three module-scoped in `page.tsx`, reused unchanged by Tasks 3-5.

This task is a pure refactor plus two small, deliberate behavior fixes. It does NOT add `ColaboradorView`, any category tabs, or any new section — those are Task 3 onward. The existing `import type { Session } from "@/lib/session"` is needed for `TeamView`'s new prop type; add it to the file's imports.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/e2e/documentos.spec.ts` (after the last existing test):

```typescript
test("shows a proper label instead of the raw status for an admissionais document", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    admissionDocuments: [
      {
        id: "adm-2",
        userId: "user-3",
        userName: "Fábio Colaborador",
        title: "RG",
        status: "enviado",
        submittedAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/documentos");

  await expect(page.getByText("Fábio Colaborador")).toBeVisible();
  await expect(page.getByText("Enviado", { exact: true })).toBeVisible();
  await expect(page.getByText("enviado", { exact: true })).toHaveCount(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx playwright test documentos.spec.ts`
Expected: FAIL — the admissionais list currently renders the raw `"enviado"` string (`page.tsx:149` today: `<span className={styles.status}>{document.status}</span>`), so `getByText("Enviado", { exact: true })` isn't found and `getByText("enviado", { exact: true })` IS found (inverted from what's asserted). The 4 pre-existing tests in the file still pass.

- [ ] **Step 3: Extract `TeamView` and apply the two fixes**

Read the full current file first (`apps/web/src/app/(app)/documentos/page.tsx`, 182 lines) so you can extract it exactly — every list/section/JSX block in `TeamView` below is copied verbatim from the current file's body (lines 74-180), with only the two fixes applied inline (`formatDate`'s new `timeZone: "UTC"` option, and the admissionais `<span>` now looking up `STATUS_LABEL`). Do not change anything else about `TeamView`'s JSX, classes, or structure.

Replace the whole file with:

```tsx
import type { Session } from "@/lib/session";
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

type DocumentStatus = "enviado" | "em_analise" | "aprovado" | "recusado";

const STATUS_LABEL: Record<DocumentStatus, string> = {
  enviado: "Enviado",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

// API DateTime fields arrive as full ISO instant strings (Prisma DateTime ->
// JSON) — timeZone: "UTC" here is not cosmetic: without it, a UTC-midnight
// value shifts to the previous local day (the exact bug the Férias sub-
// project's final review caught and fixed in its own formatDate).
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function DocumentosPage() {
  const session = await getSession();
  if (!session) {
    return <EmptyState title="Sem permissão" description="Faça login para continuar." />;
  }
  if (session.role === "colaborador") {
    return (
      <EmptyState title="Sem permissão" description="Esta página é restrita a gestores e RH." />
    );
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
```

Note: `DocumentStatus`/`STATUS_LABEL` are referenced by the `Atestado`/`AdmissionDocument` type aliases above their own declaration in this listing — TypeScript allows forward references to type aliases and `const` declarations used only inside later function bodies, but **declare `DocumentStatus` and `STATUS_LABEL` before the `Atestado`/`AdmissionDocument` type aliases** in the actual file to avoid relying on hoisting subtleties. Order the file as: `DocumentStatus` → `STATUS_LABEL` → `Atestado`/`AdmissionDocument`/`CertificationDoc` → `formatDate` → `DocumentosPage` → `TeamView`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx playwright test documentos.spec.ts`
Expected: PASS for all 5 tests (4 pre-existing + the new one). The pre-existing tests confirm `TeamView` has zero behavior change beyond the label fix (none of them assert the raw `"enviado"` string, per the spec's note that this was checked against the current suite).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(app\)/documentos/page.tsx apps/web/e2e/documentos.spec.ts
git commit -m "refactor(web): extract TeamView from DocumentosPage, fix formatDate timezone and admissionais status label"
```

---

## Task 3: `ColaboradorView` skeleton, category tabs, and Admissionais (upload + list)

**Files:**
- Modify: `apps/web/src/app/(app)/documentos/page.tsx`
- Modify: `apps/web/src/app/(app)/documentos/documentos.module.css`
- Create: `apps/web/src/app/(app)/documentos/photo-upload-field.tsx`
- Create: `apps/web/src/app/(app)/documentos/actions.ts`
- Modify: `apps/web/e2e/test-session.ts`
- Modify: `apps/web/e2e/documentos.spec.ts`

**Interfaces:**
- Consumes: `DocumentStatus`, `STATUS_LABEL`, `formatDate` from Task 2 (unchanged).
- Produces: `ColaboradorView({ searchParams }): Promise<JSX.Element>`; `Categoria` type and `resolveCategoria`; `AdmissionaisSection`; `PickedPhoto` type and `PhotoUploadField` component (both reused unchanged by Task 5's `AtestadoForm`); `submitAdmissionDocument(formData: FormData): Promise<void>` server action in a new `actions.ts` (Task 4 adds `submitCertification`, Task 5 adds `submitAtestado`/`runAtestadoOcr` to the same file).

This task establishes the whole vertical slice — role branch, tab navigation, a real upload — so Tasks 4 and 5 are mostly repetition of an already-proven pattern.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/e2e/documentos.spec.ts`:

```typescript
test("colaborador sees category tabs, with Atestados active by default", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });

  await page.goto("/documentos");

  const admissionais = page.getByRole("link", { name: "Admissionais" });
  const atestados = page.getByRole("link", { name: "Atestados" });
  const certificacoes = page.getByRole("link", { name: "Certificações" });
  await expect(admissionais).toBeVisible();
  await expect(atestados).toBeVisible();
  await expect(certificacoes).toBeVisible();
  await expect(atestados).toHaveClass(/categoryTabActive/);

  await admissionais.click();
  await expect(page).toHaveURL(/categoria=admissionais/);
  await expect(admissionais).toHaveClass(/categoryTabActive/);
  await expect(atestados).not.toHaveClass(/categoryTabActive/);
});

test("colaborador sees their own admissionais documents and can submit a new one without a photo", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    myAdmissionDocuments: [
      {
        id: "adm-1",
        title: "Comprovante de residência",
        photoUri: null,
        status: "enviado",
        submittedAt: "2026-08-20T12:00:00.000Z",
      },
    ],
    myCertifications: [],
    myAtestados: [],
  });
  await seedResponse(request, {
    method: "POST",
    path: "/documentos/admissionais",
    status: 201,
    response: { id: "adm-new", title: "RG", photoUri: null, status: "enviado", submittedAt: "2026-08-31T12:00:00.000Z" },
  });

  await page.goto("/documentos?categoria=admissionais");

  await expect(page.getByText("Comprovante de residência")).toBeVisible();
  await expect(page.getByText("Enviado", { exact: true })).toBeVisible();

  await seedResponse(request, {
    method: "GET",
    path: "/documentos/admissionais",
    response: [
      { id: "adm-new", title: "RG", photoUri: null, status: "enviado", submittedAt: "2026-08-31T12:00:00.000Z" },
      { id: "adm-1", title: "Comprovante de residência", photoUri: null, status: "enviado", submittedAt: "2026-08-20T12:00:00.000Z" },
    ],
  });

  await page.getByLabel("Título").fill("RG");
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/documentos/admissionais")?.body;
    })
    .toEqual({ title: "RG" });

  await expect(page.getByText("RG", { exact: true })).toBeVisible();
});

test("shows a message when there are no admissionais documents yet", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });

  await page.goto("/documentos?categoria=admissionais");

  await expect(page.getByText("Nenhum documento admissional enviado ainda.")).toBeVisible();
});
```

In `apps/web/e2e/documentos.spec.ts`, update the top import to add `getRecordedRequests` and `seedResponse`:

```typescript
import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";
```

(`seedResponse` is already imported today — only `getRecordedRequests` is new.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx playwright test documentos.spec.ts`
Expected: FAIL — `mockApi`'s `data` type doesn't have `myAdmissionDocuments`/`myCertifications`/`myAtestados` yet (TypeScript error) and `/documentos?categoria=...` still renders the colaborador "Sem permissão" `EmptyState` from Task 2. The 5 prior tests still pass once the type error is worked around by finishing Step 3 (the test file won't even compile until `test-session.ts` is updated, so treat the compile failure itself as this step's expected RED).

- [ ] **Step 3: Implement**

In `apps/web/e2e/test-session.ts`, add three keys to `mockApi`'s `data` parameter type (after the existing `certifications?: unknown[];` line):

```typescript
    myAdmissionDocuments?: unknown[];
    myCertifications?: unknown[];
    myAtestados?: unknown[];
```

And add the seeding blocks (after the existing `certifications` block, before the closing `}` of `mockApi`):

```typescript
  if (data.myAdmissionDocuments) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/documentos/admissionais", response: data.myAdmissionDocuments },
    });
  }
  if (data.myCertifications) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/documentos/certificacoes", response: data.myCertifications },
    });
  }
  if (data.myAtestados) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/atestados/mine", response: data.myAtestados },
    });
  }
```

Create `apps/web/src/app/(app)/documentos/photo-upload-field.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

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

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
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
      {error ? (
        <p className={styles.photoFieldError}>Formato não suportado — use JPEG, PNG ou WEBP.</p>
      ) : null}
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable remote asset
        <img src={preview} alt="Pré-visualização" className={styles.photoPreview} />
      ) : null}
      <input ref={hiddenInputRef} type="hidden" name={name} />
    </div>
  );
}
```

Create `apps/web/src/app/(app)/documentos/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function getAtestadoPhoto(id: string): Promise<string | null> {
  const res = await apiFetch(`/atestados/${id}/photo`);
  if (!res.ok) {
    throw new Error(`/atestados/${id}/photo responded with ${res.status}`);
  }
  const data = (await res.json()) as { photoDataUrl: string | null };
  return data.photoDataUrl;
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
```

`getAtestadoPhoto` is moved here unchanged from its own former file — this task deletes `apps/web/src/app/(app)/documentos/atestado-photo-button.tsx`'s import of it and re-points that import at `./actions` (it already imports from `./actions`, so no change needed there — confirm this by reading `atestado-photo-button.tsx:5` after the move, it should still read `import { getAtestadoPhoto } from "./actions";` and just keep working since `actions.ts` already existed with exactly this one export before this task; this task only *adds* `submitAdmissionDocument` to that same file).

Now update `apps/web/src/app/(app)/documentos/page.tsx`. Add these imports at the top (after the existing ones):

```typescript
import { submitAdmissionDocument } from "./actions";
import { PhotoUploadField } from "./photo-upload-field";
```

Change `DocumentosPage`'s colaborador branch from the `EmptyState` (Task 2's placeholder) to:

```typescript
  if (session.role === "colaborador") {
    return <ColaboradorView searchParams={undefined} />;
  }
```

Wait — `searchParams` needs to actually come from the page's own props. Change `DocumentosPage`'s signature and body to:

```typescript
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
```

Add these new pieces after `TeamView`'s closing brace (types, then `ColaboradorView`, then `AdmissionaisSection`):

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

type AdmissionDocumentRecord = {
  id: string;
  title: string;
  photoUri: string | null;
  status: DocumentStatus;
  submittedAt: string;
};

async function ColaboradorView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const categoria = resolveCategoria(typeof params.categoria === "string" ? params.categoria : undefined);

  const [admissionDocuments] = await Promise.all([
    apiFetchJson<AdmissionDocumentRecord[]>("/documentos/admissionais"),
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
```

(`Promise.all` around a single fetch looks odd, but Tasks 4 and 5 extend that same array/destructure to fetch all three categories in parallel — this task deliberately leaves that shape in place rather than writing a single `await` now and rewriting it to `Promise.all` in Task 4, since the two-task diff would otherwise touch the same line twice for no reason.)

In `apps/web/src/app/(app)/documentos/documentos.module.css`, append:

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx playwright test documentos.spec.ts`
Expected: PASS for all 8 tests (5 prior + 3 new).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(app\)/documentos/page.tsx apps/web/src/app/\(app\)/documentos/documentos.module.css apps/web/src/app/\(app\)/documentos/photo-upload-field.tsx apps/web/src/app/\(app\)/documentos/actions.ts apps/web/e2e/test-session.ts apps/web/e2e/documentos.spec.ts
git commit -m "feat(web): colaborador can view and submit admissionais documents"
```

---

## Task 4: Certificações (form + list)

**Files:**
- Modify: `apps/web/src/app/(app)/documentos/page.tsx`
- Modify: `apps/web/src/app/(app)/documentos/actions.ts`
- Modify: `apps/web/e2e/documentos.spec.ts`

**Interfaces:**
- Consumes: `Categoria`, `resolveCategoria`, `CATEGORIA_LABEL`, `styles`, `formatDate` from Task 3 (unchanged).
- Produces: `CertificationRecord` type; `CertificacoesSection`; `submitCertification(formData: FormData): Promise<void>` added to `actions.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/e2e/documentos.spec.ts`:

```typescript
test("colaborador sees their own certifications and can submit a new one", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    myAdmissionDocuments: [],
    myCertifications: [
      { id: "cert-1", name: "AWS Certified", institution: "Amazon", validUntil: "2028-10-10T00:00:00.000Z" },
    ],
    myAtestados: [],
  });
  await seedResponse(request, {
    method: "POST",
    path: "/documentos/certificacoes",
    status: 201,
    response: { id: "cert-new", name: "Scrum Master", institution: "Scrum.org", validUntil: "2027-05-01T00:00:00.000Z" },
  });

  await page.goto("/documentos?categoria=certificacoes");

  await expect(page.getByText("AWS Certified")).toBeVisible();
  await expect(page.getByText("Amazon · válida até 10/10/2028")).toBeVisible();

  await seedResponse(request, {
    method: "GET",
    path: "/documentos/certificacoes",
    response: [
      { id: "cert-new", name: "Scrum Master", institution: "Scrum.org", validUntil: "2027-05-01T00:00:00.000Z" },
      { id: "cert-1", name: "AWS Certified", institution: "Amazon", validUntil: "2028-10-10T00:00:00.000Z" },
    ],
  });

  await page.getByLabel("Nome").fill("Scrum Master");
  await page.getByLabel("Instituição").fill("Scrum.org");
  await page.getByLabel("Válida até (DD/MM/AAAA)").fill("01/05/2027");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/documentos/certificacoes")?.body;
    })
    .toEqual({ name: "Scrum Master", institution: "Scrum.org", validUntil: "01/05/2027" });

  await expect(page.getByText("Scrum Master")).toBeVisible();
});

test("shows a message when there are no certifications yet", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });

  await page.goto("/documentos?categoria=certificacoes");

  await expect(page.getByText("Nenhuma certificação cadastrada ainda.")).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx playwright test documentos.spec.ts`
Expected: FAIL — visiting `?categoria=certificacoes` renders nothing after the tabs (Task 3 only handles `"admissionais"`). The 8 prior tests still pass.

- [ ] **Step 3: Implement**

In `apps/web/src/app/(app)/documentos/actions.ts`, add (after `submitAdmissionDocument`):

```typescript
export async function submitCertification(formData: FormData) {
  const name = formData.get("name");
  const institution = formData.get("institution");
  const validUntil = formData.get("validUntil");
  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    typeof institution !== "string" ||
    institution.trim().length === 0 ||
    typeof validUntil !== "string" ||
    !/^\d{2}\/\d{2}\/\d{4}$/.test(validUntil)
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
```

In `apps/web/src/app/(app)/documentos/page.tsx`:

1. Add the import: `import { submitAdmissionDocument, submitCertification } from "./actions";` (replacing the Task 3 import line that only had `submitAdmissionDocument`).
2. Add the `CertificationRecord` type (next to `AdmissionDocumentRecord`):

```typescript
type CertificationRecord = {
  id: string;
  name: string;
  institution: string;
  validUntil: string;
};
```

3. Change `ColaboradorView`'s data fetch from a single-element `Promise.all` to fetch both:

```typescript
  const [admissionDocuments, certifications] = await Promise.all([
    apiFetchJson<AdmissionDocumentRecord[]>("/documentos/admissionais"),
    apiFetchJson<CertificationRecord[]>("/documentos/certificacoes"),
  ]);
```

4. Add the certificações branch, right after the admissionais one:

```typescript
      {categoria === "certificacoes" ? (
        <CertificacoesSection certifications={certifications} />
      ) : null}
```

5. Add `CertificacoesSection` after `AdmissionaisSection`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx playwright test documentos.spec.ts`
Expected: PASS for all 10 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(app\)/documentos/page.tsx apps/web/src/app/\(app\)/documentos/actions.ts apps/web/e2e/documentos.spec.ts
git commit -m "feat(web): colaborador can view and add certifications"
```

---

## Task 5: Atestados (OCR-assisted form + list)

**Files:**
- Modify: `apps/web/src/app/(app)/documentos/page.tsx`
- Modify: `apps/web/src/app/(app)/documentos/actions.ts`
- Modify: `apps/web/src/app/(app)/documentos/documentos.module.css`
- Create: `apps/web/src/app/(app)/documentos/atestado-form.tsx`
- Modify: `apps/web/e2e/documentos.spec.ts`

**Interfaces:**
- Consumes: `Categoria`, `resolveCategoria`, `CATEGORIA_LABEL`, `styles`, `formatDate`, `DocumentStatus`, `STATUS_LABEL` from Tasks 2-4 (unchanged); `PickedPhoto`, `PhotoUploadField` from Task 3 (unchanged).
- Produces: `AtestadoRecord` type; `AtestadosSection`; `AtestadoForm` (Client Component); `submitAtestado(formData: FormData): Promise<void>` and `runAtestadoOcr(base64: string, mediaType: string): Promise<{ cid: string | null; crm: string | null; medico: string | null; dias: number | null } | null>` added to `actions.ts`.

This is the last task — after it, run the full `apps/web` e2e suite (not just `documentos.spec.ts`) to confirm nothing else regressed.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/e2e/documentos.spec.ts`:

```typescript
test("colaborador sees their own atestados and can submit one manually, without a photo", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    myAdmissionDocuments: [],
    myCertifications: [],
    myAtestados: [
      {
        id: "at-1",
        cid: "J11",
        crm: "CRM-MG 12345",
        medico: "Dr. Teste",
        dias: 2,
        status: "recusado",
        reviewNote: "Faltou assinatura do médico.",
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });
  await seedResponse(request, {
    method: "POST",
    path: "/atestados",
    status: 201,
    response: { id: "at-new", cid: "A01", crm: "CRM-SP 999", medico: "Dra. Nova", dias: 3, status: "enviado", reviewNote: null, createdAt: "2026-08-31T12:00:00.000Z" },
  });

  await page.goto("/documentos?categoria=atestados");

  await expect(page.getByText("2 dia(s)")).toBeVisible();
  await expect(page.getByText("Recusado")).toBeVisible();
  await expect(page.getByText("Faltou assinatura do médico.")).toBeVisible();

  await seedResponse(request, {
    method: "GET",
    path: "/atestados/mine",
    response: [
      { id: "at-new", cid: "A01", crm: "CRM-SP 999", medico: "Dra. Nova", dias: 3, status: "enviado", reviewNote: null, createdAt: "2026-08-31T12:00:00.000Z" },
      { id: "at-1", cid: "J11", crm: "CRM-MG 12345", medico: "Dr. Teste", dias: 2, status: "recusado", reviewNote: "Faltou assinatura do médico.", createdAt: "2026-08-20T12:00:00.000Z" },
    ],
  });

  await page.getByLabel("CID").fill("A01");
  await page.getByLabel("CRM do médico").fill("CRM-SP 999");
  await page.getByLabel("Nome do médico").fill("Dra. Nova");
  await page.getByLabel("Quantidade de dias").fill("3");
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/atestados")?.body;
    })
    .toEqual({ cid: "A01", crm: "CRM-SP 999", medico: "Dra. Nova", dias: 3 });

  await expect(page.getByText("3 dia(s)")).toBeVisible();
});

test("shows a message when there are no atestados yet", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });

  await page.goto("/documentos?categoria=atestados");

  await expect(page.getByText("Nenhum atestado enviado ainda.")).toBeVisible();
});

test("picking a photo runs OCR and pre-fills CID/CRM/médico/dias, which stay editable", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });
  await seedResponse(request, {
    method: "POST",
    path: "/atestados/ocr",
    response: { cid: "B34", crm: "CRM-RJ 111", medico: "Dr. OCR", dias: 5 },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/atestados",
    status: 201,
    response: { id: "at-ocr", cid: "B34", crm: "CRM-RJ 111", medico: "Editado", dias: 5, status: "enviado", reviewNote: null, createdAt: "2026-08-31T12:00:00.000Z" },
  });

  await page.goto("/documentos?categoria=atestados");

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "atestado.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("fake-jpeg-bytes"),
  });

  await expect(page.getByText("Dados preenchidos automaticamente — confira antes de enviar.")).toBeVisible();
  await expect(page.getByLabel("CID")).toHaveValue("B34");
  await expect(page.getByLabel("CRM do médico")).toHaveValue("CRM-RJ 111");
  await expect(page.getByLabel("Nome do médico")).toHaveValue("Dr. OCR");
  await expect(page.getByLabel("Quantidade de dias")).toHaveValue("5");

  // OCR-filled fields stay editable — prove it by changing one before submit.
  await page.getByLabel("Nome do médico").fill("Editado");
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/atestados")?.body;
    })
    .toEqual({
      cid: "B34",
      crm: "CRM-RJ 111",
      medico: "Editado",
      dias: 5,
      photoDataUrl: expect.stringMatching(/^data:image\/jpeg;base64,/),
    });
});

test("shows a manual-entry message when OCR can't read the photo", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });
  await seedResponse(request, {
    method: "POST",
    path: "/atestados/ocr",
    status: 500,
    response: {},
  });

  await page.goto("/documentos?categoria=atestados");

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "atestado.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("fake-jpeg-bytes"),
  });

  await expect(
    page.getByText("Não foi possível ler automaticamente — preencha os dados abaixo manualmente."),
  ).toBeVisible();
  await expect(page.getByLabel("CID")).toHaveValue("");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx playwright test documentos.spec.ts`
Expected: FAIL — visiting `?categoria=atestados` renders nothing after the tabs (Tasks 3-4 only handle `"admissionais"`/`"certificacoes"`). The 10 prior tests still pass.

- [ ] **Step 3: Implement**

In `apps/web/src/app/(app)/documentos/actions.ts`, add (after `submitCertification`):

```typescript
export async function submitAtestado(formData: FormData) {
  const cid = formData.get("cid");
  const crm = formData.get("crm");
  const medico = formData.get("medico");
  const diasRaw = formData.get("dias");
  const photo = formData.get("photo");
  const dias = typeof diasRaw === "string" ? Number.parseInt(diasRaw, 10) : NaN;
  if (
    typeof cid !== "string" ||
    cid.trim().length === 0 ||
    typeof crm !== "string" ||
    crm.trim().length === 0 ||
    typeof medico !== "string" ||
    medico.trim().length === 0 ||
    !Number.isInteger(dias) ||
    dias <= 0
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
  const res = await apiFetch("/atestados/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mediaType }),
  });
  if (!res.ok) return null;
  return res.json();
}
```

In `apps/web/src/app/(app)/documentos/documentos.module.css`, append:

```css
.itemNote {
  font-size: 13px;
  color: #f87171;
}

.ocrStatus {
  font-size: 13px;
  color: var(--color-text-secondary);
}
```

Create `apps/web/src/app/(app)/documentos/atestado-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";

import { runAtestadoOcr, submitAtestado } from "./actions";
import { PhotoUploadField, type PickedPhoto } from "./photo-upload-field";
import styles from "./documentos.module.css";

type OcrStatus = "idle" | "loading" | "done" | "error";

export function AtestadoForm() {
  const [cid, setCid] = useState("");
  const [crm, setCrm] = useState("");
  const [medico, setMedico] = useState("");
  const [dias, setDias] = useState("");
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle");

  async function handlePhotoPicked(picked: PickedPhoto) {
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
        setOcrStatus("idle");
      }}
    >
      <PhotoUploadField
        name="photo"
        label="Foto do atestado (opcional)"
        onPicked={handlePhotoPicked}
      />

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
      <input
        id="cid"
        name="cid"
        type="text"
        value={cid}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setCid(event.target.value)}
        className={styles.textInput}
        required
      />
      <label htmlFor="crm">CRM do médico</label>
      <input
        id="crm"
        name="crm"
        type="text"
        value={crm}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setCrm(event.target.value)}
        className={styles.textInput}
        required
      />
      <label htmlFor="medico">Nome do médico</label>
      <input
        id="medico"
        name="medico"
        type="text"
        value={medico}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setMedico(event.target.value)}
        className={styles.textInput}
        required
      />
      <label htmlFor="dias">Quantidade de dias</label>
      <input
        id="dias"
        name="dias"
        type="number"
        min="1"
        step="1"
        value={dias}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setDias(event.target.value)}
        className={styles.textInput}
        required
      />

      <button type="submit" className={styles.submitButton}>
        Enviar
      </button>
    </form>
  );
}
```

In `apps/web/src/app/(app)/documentos/page.tsx`:

1. Add the import: `import { AtestadoForm } from "./atestado-form";`
2. Add the `AtestadoRecord` type (next to `CertificationRecord`):

```typescript
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

3. Extend `ColaboradorView`'s `Promise.all` to fetch all three:

```typescript
  const [admissionDocuments, certifications, atestados] = await Promise.all([
    apiFetchJson<AdmissionDocumentRecord[]>("/documentos/admissionais"),
    apiFetchJson<CertificationRecord[]>("/documentos/certificacoes"),
    apiFetchJson<AtestadoRecord[]>("/atestados/mine"),
  ]);
```

4. Add the atestados branch, right after the admissionais one and before certificações (matching the tab order `admissionais`/`atestados`/`certificacoes`):

```typescript
      {categoria === "atestados" ? <AtestadosSection atestados={atestados} /> : null}
```

5. Add `AtestadosSection` after `AdmissionaisSection`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx playwright test documentos.spec.ts`
Expected: PASS for all 14 tests.

- [ ] **Step 5: Run the full web e2e suite**

Run: `cd apps/web && npx playwright test`
Expected: PASS — every pre-existing spec file still passes unchanged, alongside `documentos.spec.ts`. (As of the Férias sub-project, `auth.spec.ts:19`, `esqueci-senha.spec.ts:38`/`:47`, `login.spec.ts:33`, and `search.spec.ts:17` have 5 known pre-existing failures unrelated to any colaborador-portal work — confirm the failure set is still exactly those 5 and nothing new, not that the suite is 100% green.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(app\)/documentos/page.tsx apps/web/src/app/\(app\)/documentos/actions.ts apps/web/src/app/\(app\)/documentos/documentos.module.css apps/web/src/app/\(app\)/documentos/atestado-form.tsx apps/web/e2e/documentos.spec.ts
git commit -m "feat(web): colaborador can submit atestados with OCR-assisted CID/CRM/dias"
```
