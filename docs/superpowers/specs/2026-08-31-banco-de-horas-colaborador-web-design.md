# Banco de Horas — Colaborador — Web

**Status:** Proposto
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)
**Spec do motor de cálculo (já implementada, sem mudança aqui):** [`2026-08-29-banco-de-horas-real-design.md`](2026-08-29-banco-de-horas-real-design.md) — define `GET /banco-de-horas/minhas`, cujo default de período já é "dia 1 do mês corrente até hoje" (São Paulo).
**Spec anterior (mesmo portal):** [`2026-08-31-historico-folha-colaborador-web-design.md`](2026-08-31-historico-folha-colaborador-web-design.md)

## 1. Objetivo e escopo

Terceiro sub-projeto do portal de autoatendimento do colaborador na web. O colaborador consegue ver seu próprio saldo de banco de horas por mês civil (nunca uma janela rolante de N dias — decisão explícita desta spec), navegar entre mês atual/mês anterior/últimos 3 meses, ver a tabela diária de previsto×trabalhado×diferença, e solicitar compensação de banco de horas, acompanhando o status das próprias solicitações. Mirror de `banco-de-horas.tsx` (mobile), sem o gráfico de 30 dias nem os cards de insight (decisão já tomada em conversa).

A API já entrega tudo isso pronto: `GET /banco-de-horas/minhas` (saldo + tabela diária do usuário autenticado) e `POST`/`GET /solicitacoes/compensacoes` (criar e listar as próprias solicitações). **Nenhuma mudança de backend nesta spec.**

Fora de escopo (seção 7 tem a lista completa): Férias, Documentos, Mural (sub-projetos seguintes); navegação livre mês a mês (a visão de gestor/RH já tem isso — aqui são só 3 opções fixas, como no mobile); editar/cancelar uma solicitação já enviada.

## 2. Modelo de dados e backend

Nenhuma mudança. Reaproveita integralmente:
- `GET /banco-de-horas/minhas?start=YYYY-MM-DD&end=YYYY-MM-DD` → `{ days: { date, expectedMinutes, workedMinutes, diffMinutes }[], balanceMinutes, dsrMinutes, hourlyRateBRL, overtimeValueBRL }`. Sem `start`/`end`, o backend já usa o default "dia 1 do mês corrente até hoje" — exatamente o comportamento pedido para "mês atual".
- `POST /solicitacoes/compensacoes` (`AuthGuard`, body `{ reason: string }` via `CompensationRequestInputSchema`) → cria `CompensationRequest` com `status: "pendente"`.
- `GET /solicitacoes/compensacoes` (`AuthGuard`) → lista as solicitações do próprio usuário autenticado, `orderBy createdAt desc`. Cada item: `{ id, userId, reason, status: "pendente" | "aprovado" | "recusado", reviewNote: string | null, createdAt: string }`.

## 3. Web (`apps/web`)

### 3.1 `apps/web/src/app/(app)/banco-de-horas/page.tsx` — branch por role no mesmo arquivo

Diferente das specs anteriores (que usavam guarda exclusiva — bloqueia OU libera por role), esta página passa a servir **as duas visões na mesma rota**, ramificando dentro do mesmo `page.tsx`:

```typescript
export default async function BancoDeHorasPage({ searchParams }: PageProps<"/banco-de-horas">) {
  const session = await getSession();
  if (!session) {
    return <EmptyState title="Sem permissão" description="Faça login para continuar." />;
  }
  if (session.role === "colaborador") {
    return <ColaboradorView searchParams={await searchParams} />;
  }
  return <TeamView searchParams={await searchParams} />;
}
```

`TeamView` é a função extraída do corpo atual do componente (linhas 80-148 do arquivo hoje) — **sem nenhuma mudança de comportamento**, só renomeada/extraída. As funções utilitárias de data já existentes no arquivo (`todaySaoPauloDateOnly`, `firstDayOfMonth`, `lastDayOfMonth`, `addMonths`, `isValidDateOnly`, `formatSignedMinutes`, `formatBRL`, `formatMonthLabel`) ficam no escopo do módulo e são reaproveitadas por `ColaboradorView` também — não duplica, já estão no mesmo arquivo.

Acrescenta uma função pura nova, usada só pela tabela diária (`expectedMinutes`/`workedMinutes` nunca são negativos, ao contrário de `diffMinutes`):

```typescript
function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

// Date-only string (YYYY-MM-DD) → "dd/mm", sem depender de fuso do servidor
// (mesmo raciocínio de formatMonthLabel: formata em UTC porque o valor já
// é uma data-only armazenada como meia-noite UTC).
function formatDayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00.000Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}
```

### 3.2 `ColaboradorView` — período fixo de 3 opções (não navegação livre)

```typescript
type Periodo = "atual" | "anterior" | "3meses";

function resolvePeriodo(value: string | undefined): Periodo {
  return value === "anterior" || value === "3meses" ? value : "atual";
}

function periodoRange(periodo: Periodo): { start: string; end: string } {
  const today = todaySaoPauloDateOnly();
  const currentMonthStart = firstDayOfMonth(today);
  if (periodo === "atual") {
    return { start: currentMonthStart, end: today };
  }
  if (periodo === "anterior") {
    const start = addMonths(currentMonthStart, -1);
    return { start, end: lastDayOfMonth(start) };
  }
  // "3meses": do dia 1 de dois meses atrás até hoje — três meses civis.
  return { start: addMonths(currentMonthStart, -2), end: today };
}
```

Tipos (locais ao arquivo, não em shared-types — mesmo raciocínio já usado para `TeamSummary` neste mesmo arquivo):

```typescript
type DailySummary = { date: string; expectedMinutes: number; workedMinutes: number; diffMinutes: number };
type MinhaSummary = {
  days: DailySummary[];
  balanceMinutes: number;
  dsrMinutes: number;
  hourlyRateBRL: number | null;
  overtimeValueBRL: number | null;
};
type CompensationRequest = {
  id: string;
  reason: string;
  status: "pendente" | "aprovado" | "recusado";
  reviewNote: string | null;
  createdAt: string;
};
```

Corpo de `ColaboradorView({ searchParams }: { searchParams: Record<string, string | string[] | undefined> })`:

1. `const periodo = resolvePeriodo(typeof searchParams.periodo === "string" ? searchParams.periodo : undefined);`
2. `const { start, end } = periodoRange(periodo);`
3. Busca em paralelo:
   ```typescript
   const [summary, minhasSolicitacoes] = await Promise.all([
     apiFetchJson<MinhaSummary>(`/banco-de-horas/minhas?start=${start}&end=${end}`),
     apiFetchJson<CompensationRequest[]>("/solicitacoes/compensacoes"),
   ]);
   ```
4. Renderiza:
   - `<h1>Banco de Horas</h1>`
   - Navegação de período: 3 links (`<a href="/banco-de-horas?periodo=atual">`, `?periodo=anterior`, `?periodo=3meses`), rotulados "Mês atual", "Mês anterior", "Últimos 3 meses" — o ativo (`periodo === opção`) ganha a classe `.periodTabActive` (mesmo padrão visual de `.navLinkActive`, mas local a este CSS module).
   - Card de resumo (`.summaryCard`, uma seção nova): Saldo (`formatSignedMinutes(summary.balanceMinutes)`), DSR estimado (`formatSignedMinutes(summary.dsrMinutes)`), Valor-hora (`formatBRL` ou "—" se `null`), Extras em R$ (idem).
   - Tabela diária (`.list`/`.item`, reaproveitado do estilo já existente): para cada `day` de `summary.days` (já vem em ordem crescente de data, a mesma ordem da API) — `formatDayLabel(day.date)`, "Previsto: {formatMinutes(day.expectedMinutes)} · Trabalhado: {formatMinutes(day.workedMinutes)} · Diferença: {formatSignedMinutes(day.diffMinutes)}".
   - Formulário "Solicitar compensação" (seção nova, `<form action={requestCompensation}>`): `<textarea name="reason" required />` + botão "Enviar solicitação".
   - Lista "Minhas solicitações" (seção nova): cada `CompensationRequest` — motivo, badge de status (mesmo padrão de `documentos/page.tsx`: `STATUS_LABEL` record + classe condicional `.statusAprovado`/`.statusRecusado`), e `reviewNote` quando presente (só existe quando `recusado`, pela regra do `statusUpdateSchema`). Vazio → texto simples "Nenhuma solicitação registrada ainda." (não é o `EmptyState` de página inteira — é só uma seção dentro de uma página que já tem conteúdo).

### 3.3 `apps/web/src/app/(app)/banco-de-horas/actions.ts` (novo)

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function requestCompensation(formData: FormData) {
  const reason = formData.get("reason");
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new Error("Motivo é obrigatório.");
  }
  const res = await apiFetch("/solicitacoes/compensacoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    throw new Error(`/solicitacoes/compensacoes responded with ${res.status}`);
  }
  revalidatePath("/banco-de-horas");
}
```

Mesmo padrão de `aprovacoes/actions.ts`: Server Action lendo `FormData`, `apiFetch` (não `apiFetchJson`, porque não precisamos do corpo da resposta), `revalidatePath` pra a lista de solicitações recarregar.

### 3.4 `banco-de-horas.module.css` — classes novas

```css
.periodTabs {
  display: flex;
  gap: 8px;
}

.periodTab {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-background-element);
}

.periodTab:hover {
  color: var(--color-text);
}

.periodTabActive,
.periodTabActive:hover {
  background: var(--color-text);
  color: var(--color-background);
}

.summaryCard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  padding: 20px;
  border-radius: 12px;
  background: var(--color-background-element);
}

.summaryItem {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summaryLabel {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.summaryValue {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
}

.sectionTitle {
  font-size: 18px;
  font-weight: 600;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.textarea {
  min-height: 80px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-background-selected);
  background: var(--color-background-element);
  color: var(--color-text);
  font: inherit;
  resize: vertical;
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

.status {
  font-size: 13px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--color-background-selected);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.statusAprovado {
  background: rgba(74, 222, 128, 0.18);
  color: #4ade80;
}

.statusRecusado {
  background: rgba(248, 113, 113, 0.18);
  color: #f87171;
}

.sectionEmpty {
  color: var(--color-text-secondary);
  font-size: 14px;
}
```

`.page`, `.heading`, `.periodNav`, `.periodNavLink`, `.periodRange`, `.list`, `.item`, `.itemName`, `.itemDetail` continuam como estão (usados por `TeamView`, sem mudança).

### 3.5 `nav-sections.ts`

Novo item de topo em `COLABORADOR_SIDEBAR` (irmão do grupo "Ponto", não filho dele — mesma estrutura combinada em conversa anterior para Férias/Documentos/Mural):

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
];
```

`NAV_SECTIONS` (usada pela busca global e pela sidebar de gestor/RH) já tem `/banco-de-horas` — sem mudança lá.

## 4. Mobile

Nenhuma mudança de código.

## 5. Testes

- **`banco-de-horas.spec.ts`**: o teste existente `"colaborador sees a permission message instead of the team's banco de horas"` **deixa de ser válido** (colaborador agora vê uma página real) — substituído por:
  - Colaborador vê saldo, DSR, tabela diária e a lista "Minhas solicitações" (mockando `bancoDeHorasMinhas` e `myCompensations`, ver abaixo).
  - Os 3 links de período aparecem, com "Mês atual" ativo por padrão; clicar em "Últimos 3 meses" navega para `?periodo=3meses` e o link correspondente vira o ativo.
  - Enviar o formulário de solicitação faz uma requisição `POST /solicitacoes/compensacoes` com o `reason` digitado (via `getRecordedRequests`, mesmo padrão já usado em outros specs desta suite para verificar payload de mutação) e a página recarrega mostrando a nova solicitação na lista (a resposta do POST mockada via `seedResponse`, e a lista via `GET /solicitacoes/compensacoes` re-seedada para incluir o novo item).
  - Uma solicitação com `status: "recusado"` mostra o `reviewNote`.
  - Os testes de gestor/RH já existentes (`shows the team's banco de horas...`, `shows the hourly rate...`, `shows an empty state...`, `the current month has no next-month link`, `month navigation moves between periods...`) **continuam passando sem alteração** — `TeamView` não muda de comportamento, só foi extraída para uma função.
- **`test-session.ts`**: `mockApi`'s typed `data` ganha duas chaves novas:
  ```typescript
  bancoDeHorasMinhas?: unknown;
  myCompensations?: unknown[];
  ```
  seedando `/banco-de-horas/minhas` e `/solicitacoes/compensacoes` respectivamente (mesmo padrão de todas as outras chaves já existentes no arquivo). Nenhuma mudança em `fake-api-server.mjs` — o servidor já resolve qualquer `GET`/`POST` seedado via `__seed` antes de cair nos handlers hardcoded (linha 66 do arquivo, checada antes das rotas específicas), então o `POST /solicitacoes/compensacoes` do formulário é coberto pelo helper genérico `seedResponse` já existente, sem precisar de rota nova no fake server.
- **`app-shell.spec.ts`**: o teste `"colaborador sees a curated, grouped sidebar..."` ganha uma asserção a mais — `page.getByRole("link", { name: "Banco de Horas" })` visível sem precisar expandir o grupo "Ponto" (é item de topo, não filho).
- **`search.spec.ts`**: sem mudança — "Banco de Horas" já é resultado de busca via `NAV_SECTIONS`, que não muda.

## 6. Global Constraints (herdadas + novas)

- Saldo e tabela diária sempre alinhados ao calendário civil (mês tem 30 ou 31 dias, nunca uma janela rolante de N dias) — regra explícita desta conversa, já satisfeita pelo default do backend (`GET /banco-de-horas/minhas` sem parâmetros = dia 1 do mês corrente até hoje).
- "Hoje"/limites de mês devem ser São-Paulo-aware, não UTC-ingênuo (herdada; já satisfeita pelos helpers existentes no arquivo, reaproveitados sem mudança).
- Sem gráfico de 30 dias nem cards de insight fabricados — decisão já tomada em conversa; a paridade funcional pedida é saldo + tabela + solicitar/acompanhar compensação.
- `COLABORADOR_SIDEBAR`: item novo é irmão do grupo "Ponto", não filho — mesma estrutura combinada para os próximos sub-projetos (Férias, Documentos, Mural).

## 7. Fora de escopo

- Férias, Documentos, Mural — sub-projetos seguintes, specs próprias.
- Navegação livre mês a mês para o colaborador (como a visão de gestor/RH já tem) — só as 3 opções fixas do mobile (atual/anterior/últimos 3 meses).
- Editar ou cancelar uma solicitação de compensação já enviada — não existe no mobile hoje, não é criado aqui.
- Botão "Pagamento efetuado" (RH) e qualquer infraestrutura de notificação — sub-projeto próprio futuro, greenfield (não existe nenhuma tabela de notificação no sistema hoje).
- Gráfico de barras de 30 dias e os cards de insight de hora-extra em R$ do mobile — decisão já tomada em conversa de não replicar (são enfeite visual, não essenciais à paridade funcional).
