# Mural — Colaborador — Web

**Status:** Proposto
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)
**Spec anterior (mesmo portal):** [`2026-09-01-documentos-colaborador-web-design.md`](2026-09-01-documentos-colaborador-web-design.md)
**Referência mobile (mesma lógica, sem mudança aqui):** `apps/mobile/src/app/(tabs)/mural.tsx`, `apps/mobile/src/lib/mural-api.ts`, `apps/mobile/src/lib/mural.ts`

## 1. Objetivo e escopo

Sexto sub-projeto do portal de autoatendimento do colaborador na web, e último dos itens já previstos no roadmap antes de "Pagamento efetuado"/notificações (item greenfield à parte). O colaborador passa a ver o Mural — comunicados e aniversariantes — e pode reagir aos posts, hoje uma capacidade só do mobile.

A API já entrega tudo isso pronto e **sem nenhuma distinção de role**: `GET /mural/posts` já calcula `reacted` por usuário autenticado (`mural.service.ts:8-24`, via `MuralReaction` do próprio `userId`), `POST /mural/posts/:id/react` já alterna a reação de qualquer usuário autenticado, e `GET /mural/birthdays` não tem guarda nenhuma além de `AuthGuard`. **Nenhuma mudança de backend nesta spec.**

Diferente de Férias (guarda exclusiva) e igual a Documentos/Banco de Horas, `/mural` já existe hoje para gestor/RH — a rota é reaproveitada e ramificada por role dentro do mesmo `page.tsx`: `TeamView` é o corpo atual da página, extraído sem nenhuma mudança de comportamento; `ColaboradorView` é inteiramente nova.

Fora de escopo (seção 7 tem a lista completa): indicador de "não lido" do mobile (conceito puramente local/client-side, sem persistência no backend — não existe campo de leitura em `MuralPost` nem em nenhuma tabela relacionada); publicar/editar/excluir posts (não existe hoje em nenhuma plataforma — Mural é somente-leitura + reação em ambas); qualquer notificação (é o próximo sub-projeto do roadmap, greenfield).

## 2. Modelo de dados e backend

Nenhuma mudança. Reaproveita integralmente:

- `GET /mural/posts` (`AuthGuard`) → lista todos os posts, `orderBy createdAt desc`, cada um com `reactionCount` (contagem total) e `reacted` (se o usuário autenticado específico já reagiu) calculados por post. Forma: `{ id, glyph, title, body, createdAt, reactionCount, reacted }`. Idêntica para qualquer role — a TeamView atual já ignora `reacted` (não usa), a ColaboradorView é quem passa a consumi-lo.
- `POST /mural/posts/:id/react` (`AuthGuard`) → alterna: se o usuário já reagiu, remove a reação; senão, cria. Responde `{ reactionCount, reacted }` já atualizados. 404 se o post não existir.
- `GET /mural/birthdays` (`AuthGuard`) → lista todos os aniversariantes, sem filtro de mês/dia (isso é responsabilidade do cliente, tanto no mobile quanto nesta spec). Forma: `{ name, day, month }[]` (`month` é 1-12).

## 3. Web (`apps/web`)

### 3.1 `apps/web/src/app/(app)/mural/page.tsx` — branch por role no mesmo arquivo

Mesmo padrão de `documentos/page.tsx`/`banco-de-horas/page.tsx`. Diferente desses dois, o corpo atual de `MuralPage` não usa `session` para nada além do próprio guard de role — então `TeamView` não precisa de nenhuma prop:

```tsx
export default async function MuralPage() {
  const session = await getSession();
  if (!session) {
    return <EmptyState title="Sem permissão" description="Faça login para continuar." />;
  }
  if (session.role === "colaborador") {
    return <ColaboradorView />;
  }
  return <TeamView />;
}
```

`TeamView()` é o corpo atual (linhas 52-113 de hoje) extraído **sem nenhuma mudança de comportamento** visível, com uma correção pontual ao mover — mesmo raciocínio já registrado na spec de Documentos (seção 3.1 daquela spec): `formatDate` hoje (linha 37-39) não passa `timeZone: "UTC"`, e como passa a ser reaproveitada por `ColaboradorView` também, a correção é obrigatória, não cosmética:

```typescript
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
```

### 3.2 `ColaboradorView` — aniversariantes + feed com reação, sem abas

Não há categorias nem query string aqui — é uma página só, mais simples que Documentos/Banco de Horas.

```typescript
type MuralPostRecord = {
  id: string;
  glyph: string;
  title: string;
  body: string;
  createdAt: string;
  reactionCount: number;
  reacted: boolean;
};

type BirthdayRecord = {
  name: string;
  day: number;
  month: number;
};
```

"Hoje" precisa ser calculado no fuso da empresa, não no fuso ambiente do servidor (mesma razão de `todaySaoPauloDateOnly` em `banco-de-horas/page.tsx`/`ferias/page.tsx` — o servidor de produção roda em UTC, e a virada do dia em UTC não coincide com a virada em São Paulo):

```typescript
function todaySaoPauloMonthDay(): { day: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: get("day"), month: get("month") };
}

function birthdaysToday(birthdays: BirthdayRecord[], today: { day: number; month: number }): BirthdayRecord[] {
  return birthdays.filter((b) => b.day === today.day && b.month === today.month);
}

function birthdaysThisMonthExcludingToday(
  birthdays: BirthdayRecord[],
  today: { day: number; month: number },
): BirthdayRecord[] {
  return birthdays.filter((b) => b.month === today.month && b.day !== today.day);
}
```

Mesma lógica de `apps/mobile/src/lib/mural.ts` (`birthdaysToday`/`birthdaysThisMonthExcludingToday`), reescrita localmente — não vale a pena promover para `shared-types` por duas funções puras de poucas linhas (mesmo raciocínio já aceito nas specs anteriores para tipos duplicados). Diferença deliberada da assinatura mobile: lá o parâmetro é `referenceDate = new Date()` (fuso local do dispositivo, correto para um app rodando no fuso do próprio usuário); aqui o parâmetro já vem pré-calculado no fuso de São Paulo, porque o servidor não pode assumir que seu próprio relógio/fuso representa "agora, no Brasil".

Corpo de `ColaboradorView()`:

```tsx
async function ColaboradorView() {
  const [posts, birthdays] = await Promise.all([
    apiFetchJson<MuralPostRecord[]>("/mural/posts"),
    apiFetchJson<BirthdayRecord[]>("/mural/birthdays"),
  ]);

  if (posts.length === 0 && birthdays.length === 0) {
    return (
      <EmptyState
        title="Mural"
        description="Os comunicados publicados no mural vão aparecer aqui."
      />
    );
  }

  const today = todaySaoPauloMonthDay();
  const todayBirthdays = birthdaysToday(birthdays, today);
  const monthBirthdays = birthdaysThisMonthExcludingToday(birthdays, today);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Mural</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Aniversariantes</h2>
        {todayBirthdays.length > 0 ? (
          <div className={styles.birthdayToday}>
            🎂 Aniversariante(s) de hoje: {todayBirthdays.map((b) => b.name).join(", ")}
          </div>
        ) : null}
        {monthBirthdays.length > 0 ? (
          <p className={styles.birthdayMonth}>
            Também fazem aniversário este mês:{" "}
            {monthBirthdays
              .map((b) => `${b.name} (${String(b.day).padStart(2, "0")}/${String(b.month).padStart(2, "0")})`)
              .join(", ")}
          </p>
        ) : null}
        {todayBirthdays.length === 0 && monthBirthdays.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum aniversariante este mês.</p>
        ) : null}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Comunicados</h2>
        {posts.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum comunicado publicado ainda.</p>
        ) : (
          <ul className={styles.list}>
            {posts.map((post) => (
              <li key={post.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <span className={styles.glyph}>{post.glyph}</span>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{post.title}</span>
                    <span className={styles.itemDetail}>publicado em {formatDate(post.createdAt)}</span>
                  </div>
                </div>
                <p className={styles.body}>{post.body}</p>
                <form action={toggleMuralReaction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <button
                    type="submit"
                    className={post.reacted ? `${styles.reactionButton} ${styles.reactionButtonActive}` : styles.reactionButton}
                  >
                    {post.reacted ? "♥" : "♡"} {post.reactionCount}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

`ColaboradorView` aqui não recebe nenhuma prop nem resolve `searchParams` — diferente de Documentos/Banco de Horas (que têm abas por query string), o Mural do colaborador é uma página só, sem estado de navegação.

`todayBirthdays.length === 0 && monthBirthdays.length === 0` só aparece quando `birthdays.length > 0` mas nenhum é deste mês (o guard geral do topo já cobre `birthdays.length === 0` junto com `posts.length === 0`; se só `posts` estiver vazio mas `birthdays` não, a seção de Aniversariantes deve mesmo assim considerar o filtro por mês — é proposital que "nenhum aniversariante este mês" apareça mesmo havendo aniversariantes cadastrados para outros meses, replicando o próprio comportamento do mobile, que só mostra o mês corrente).

### 3.3 Botão de reação — form nativo, mesmo padrão de `aprovacoes/approval-section.tsx`

`<form action={onDecide}><input type="hidden" name="id" value={id} />...</form>` já é o padrão estabelecido em `aprovacoes` para uma ação por item de lista. Aqui é o mesmo desenho: um hidden input carrega o `postId`, o botão de submit é o próprio glyph de coração + contagem — não precisa de nenhum Client Component, é um Server Action puro por post.

Símbolo de coração: `♥`/`♡` (glyph de texto, mesma linguagem visual já usada no resto do app para o campo `glyph` dos próprios posts e para o emoji de aniversário `🎂` — o app não usa nenhuma biblioteca de ícones no web, só `<svg>` inline pontual em dois lugares (`ferias`, `beneficios`) e nenhum precedente de ícone reaproveitável para "coração"; um glyph de texto é mais simples e consistente que introduzir um SVG novo só para isto).

### 3.4 `apps/web/src/app/(app)/mural/actions.ts` — uma Server Action nova

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function toggleMuralReaction(formData: FormData) {
  const postId = formData.get("postId");
  if (typeof postId !== "string" || postId.length === 0) {
    throw new Error("postId é obrigatório.");
  }
  const res = await apiFetch(`/mural/posts/${postId}/react`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`/mural/posts/${postId}/react responded with ${res.status}`);
  }
  revalidatePath("/mural");
}
```

Sem corpo de requisição — `POST /mural/posts/:id/react` não espera nenhum campo, só o `id` na própria URL (confirmado em `mural.controller.ts:20-23`).

### 3.5 `mural.module.css` — classes novas

Reaproveita `.page`, `.heading`, `.section`, `.sectionTitle`, `.sectionEmpty`, `.list`, `.item`, `.itemHeader`, `.glyph`, `.itemInfo`, `.itemName`, `.itemDetail`, `.body` (todas já existem, usadas sem mudança por `TeamView`). Classes novas, só para `ColaboradorView`:

```css
.birthdayToday {
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--color-background-selected);
  font-weight: 600;
  color: var(--color-text);
}

.birthdayMonth {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.reactionButton {
  appearance: none;
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--color-background-selected);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
}

.reactionButton:hover {
  background: var(--color-background-selected);
}

.reactionButtonActive {
  color: var(--color-text);
  border-color: var(--color-text);
}
```

### 3.6 `nav-sections.ts`

`NAV_SECTIONS`'s existing `/mural` entry ganha `"colaborador"`:

```typescript
{ href: "/mural", label: "Mural", roles: ["gestor", "rh", "colaborador"] },
```

`COLABORADOR_SIDEBAR` ganha um item de topo novo, irmão de "Banco de Horas"/"Férias"/"Documentos" (última peça da estrutura já anticipada no comentário do próprio arquivo):

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
  { href: "/mural", label: "Mural" },
];
```

## 4. Mobile

Nenhuma mudança de código.

## 5. Testes

- **`mural.spec.ts`**: o teste existente `"colaborador sees a permission message instead of the mural"` **deixa de ser válido** (mesmo raciocínio já documentado nas specs de Banco de Horas/Documentos) — substituído por uma suíte nova cobrindo `ColaboradorView`:
  - Aniversariante de hoje aparece destacado; aniversariante só deste mês (não hoje) aparece na linha "Também fazem aniversário este mês"; um aniversariante de outro mês não aparece em nenhum dos dois. Mesmo padrão já usado em `ferias.spec.ts` para lidar com uma data "hoje" calculada em `America/Sao_Paulo`: o teste **não congela o relógio** — ele replica `todaySaoPauloMonthDay()` localmente (mesma função, copiada no spec, igual `ferias.spec.ts` replica `todaySaoPauloDateOnly()`) para calcular o dia/mês reais no momento da execução, e semeia os aniversariantes com valores relativos a esse "hoje" real (ex.: dia de hoje, um dia do mês corrente que não seja hoje, e um dia de um mês diferente do atual calculado por deslocamento) em vez de datas fixas no texto do teste.
  - Mensagem "Nenhum aniversariante este mês." quando há aniversariantes cadastrados mas nenhum no mês corrente.
  - Posts aparecem com título/corpo/data e o botão de reação mostra a contagem e o estado (`♡`/`♥`) conforme o campo `reacted` seedado.
  - Clicar no botão de reação faz `POST /mural/posts/{id}/react` (via `getRecordedRequests`, sem corpo) e, após o seed da resposta simular a lista recarregada (`reactionCount`/`reacted` atualizados via um segundo `seedResponse` de `GET /mural/posts`, mesmo padrão usado em Documentos para refletir o estado pós-`revalidatePath`), o botão passa a mostrar a nova contagem/estado.
  - Mensagem vazia quando não há posts ("Nenhum comunicado publicado ainda.").
  - Gestor e RH continuam vendo `TeamView` exatamente como antes — o teste já existente (`"lists mural posts with reaction counts and upcoming birthdays for a gestor"`) **continua passando sem alteração**, já que `TeamView` não muda de comportamento, só foi extraída para uma função.
- **`test-session.ts`**: nenhuma mudança — `mockApi`'s `muralPosts`/`birthdays` já seedam exatamente `/mural/posts`/`/mural/birthdays`, os mesmos endpoints que `ColaboradorView` consome (API não distingue role). O toggle de reação usa `seedResponse` diretamente (`{ method: "POST", path: "/mural/posts/post-1/react", response: {...} }`), mesmo padrão já usado para outros `POST`s dinâmicos por id neste portal.
- **`app-shell.spec.ts`**: o teste `"colaborador sees a curated, grouped sidebar..."` ganha uma asserção a mais — `page.getByRole("link", { name: "Mural" })` visível como item de topo.
- **`search.spec.ts`**: ganha um teste novo — "Mural" aparece nos resultados de busca do colaborador.

## 6. Global Constraints (herdadas + novas)

- Sem mudança de backend — os três endpoints já existem e já não distinguem role.
- `formatDate` em `mural/page.tsx` ganha `timeZone: "UTC"` ao ser extraída para reuso — mesma correção obrigatória já aplicada em Documentos/Banco de Horas/Férias pelo mesmo motivo (data-only/UTC-midnight sem fuso fixo desloca o dia exibido).
- "Hoje" para o corte de aniversariantes é calculado com `America/Sao_Paulo` explícito (`todaySaoPauloMonthDay`), nunca com o fuso ambiente do servidor — mesmo raciocínio já estabelecido em `banco-de-horas/page.tsx`/`ferias/page.tsx`.
- Indicador de "não lido" do mobile não é replicado — é um estado client-side efêmero sem contrapartida no backend; não há como fazer isso de forma coerente numa página Server Component renderizada do zero a cada request, e adicionar um Client Component com estado só para isso violaria o padrão simples já estabelecido nas duas seções desta página.
- O botão de reação é um `<form action={...}>` nativo por item, mesmo padrão já usado em `aprovacoes/approval-section.tsx` para uma ação por linha de lista — nenhum Client Component novo nesta spec.
- `COLABORADOR_SIDEBAR`: item novo é irmão de "Ponto", "Banco de Horas", "Férias" e "Documentos", não filho de nenhum — fecha a estrutura já anticipada desde a spec de Banco de Horas.

## 7. Fora de escopo

- Indicador de post "não lido" — conceito client-side efêmero do mobile, sem persistência no backend.
- Publicar, editar ou excluir posts do mural — não existe hoje em nenhuma plataforma (mobile também é somente-leitura + reação).
- "Pagamento efetuado" / sistema de notificações — próximo item do roadmap, greenfield, spec própria.
- Qualquer alteração ao modelo de aniversariantes (ex.: opt-out de exibição) — fora do escopo, não existe hoje em nenhuma plataforma.
