# Pagamentos (RH) + Infraestrutura de Notificações

**Status:** Proposto
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)
**Spec anterior (mesmo portal):** [`2026-09-01-mural-colaborador-web-design.md`](2026-09-01-mural-colaborador-web-design.md)

## 1. Objetivo e escopo

Primeiro de três sub-projetos que implementam o item "Pagamento efetuado" do roadmap, agora bem mais detalhado do que a nota original previa. Os três, em ordem:

1. **Esta spec** — o modelo de dados novo (`Notification`, campo `team` em `Employee`), a API completa de notificações (envio de pagamentos pelo RH **e** leitura pelo colaborador — ambos os lados da API, mesmo que só um lado tenha UI agora), e a tela `/pagamentos` (RH-only) para disparar as notificações.
2. Sininho de notificações no colaborador — **web** (spec própria, depois desta).
3. Sininho de notificações no colaborador — **mobile** (spec própria, depois da 2).

Motivo de fazer a API inteira agora: `Notification` é uma única tabela com um único fluxo de leitura (`GET /notifications/mine`, `POST /notifications/:id/read`) que os sub-projetos 2 e 3 vão consumir sem precisar tocar na API de novo — construir isso em três pedaços não traria nenhum benefício de isolamento, só obrigaria a reabrir o mesmo módulo três vezes.

**O que o RH consegue fazer nesta spec:** na tela `/pagamentos`, ver 4 categorias (Salário, Auxílio Home Office, Vale Transporte, Vale Alimentação), cada uma expansível mostrando todos os colaboradores com um indicador de "já enviado este mês" ou não, filtrar por nome e por time, e enviar a notificação de pagamento individualmente (um colaborador) ou em massa (todos os que estão visíveis com o filtro aplicado no momento).

**O que a notificação diz:** um aviso de status fixo por categoria (ex.: "Seu Vale Transporte foi depositado."), **sem valor em R$** — Auxílio Home Office, Vale Transporte e Vale Alimentação não têm nenhum valor cadastrado hoje em nenhuma plataforma, e adicionar isso é explicitamente fora de escopo (seção 7).

**Campo `team` (novo, para toda a empresa):** texto livre, rotulado "Time" no cadastro/edição do colaborador (mesmo padrão de RG — um `<input type="text">` opcional, sem lista fixa). A tela de Pagamentos usa os valores de `team` já cadastrados para montar o filtro — sem lista fixa pra manter no código.

## 2. Modelo de dados e backend

### 2.1 `Employee.team` (novo campo)

Migration adicionando `team String?` ao model `Employee` (`apps/api/prisma/schema.prisma`), ao lado dos demais campos opcionais (`cargo`, `rg`, etc.).

Muda em cascata os mesmos lugares que qualquer campo opcional de `Employee` já muda (mesmo raciocínio de todo campo anterior — `cargo`, `rg`, etc.):
- `packages/shared-types/src/employee-create.ts`: `EmployeeCreateSchema` ganha `team: z.string().min(1).nullable()`.
- `apps/web/src/app/(app)/colaboradores/employee-optional-fields.ts`: `OPTIONAL_FIELDS` ganha `"team"`.
- `apps/api/src/employees/employees.service.ts`: `create` e `updatePersonalData` passam `team: input.team` para o Prisma.
- `apps/web/src/app/(app)/colaboradores/colaborador-form-fields.tsx`: novo campo, mesmo padrão do RG:
  ```tsx
  <label className={styles.field}>
    <span className={styles.fieldLabel}>Time</span>
    <input
      type="text"
      name="team"
      defaultValue={defaults.team ?? ""}
      className={styles.fieldInput}
    />
  </label>
  ```
  (`defaults` já é o tipo que espelha `Employee` — ganha `team: string | null`.)
- **Fixtures de teste existentes quebram sem isso**: `apps/api/src/employees/employees.controller.spec.ts` e `employees.service.spec.ts` constroem objetos `EmployeeCreateInput`/`Employee` manualmente (ex.: `cargo: null` nas linhas 219/167/422 hoje) — como `team` é `.nullable()` e não `.optional()` (mesma escolha de `cargo`), essas fixtures precisam ganhar `team: null` também, senão a validação Zod falha nesses testes. Isso é esperado e mecânico, não uma decisão de design — mesma coisa aconteceu toda vez que um campo opcional novo foi adicionado a este model.

### 2.2 `Notification` (model novo)

```prisma
model Notification {
  id        String    @id @default(uuid())
  userId    String
  type      String    // "pagamento" por enquanto — string livre, não enum do Prisma,
                       // pensado para o próximo item do roadmap (detecção automática
                       // de ponto perdido) reaproveitar esta mesma tabela sem migration nova.
  category  String?   // só preenchido quando type === "pagamento": uma de PAGAMENTO_CATEGORIAS
  message   String    // texto final já pronto pra exibição, gerado no servidor no momento do envio
  createdAt DateTime  @default(now())
  readAt    DateTime? // null = não lida — usado pelos sub-projetos 2/3 (sininho)
}
```

Sem relação declarada com `Employee` (mesmo padrão de `PasswordResetCode`/`JornadaAlert`, que também guardam `userId` como string solta, resolvida na camada de serviço).

### 2.3 `packages/shared-types/src/notifications.ts` (novo arquivo)

```typescript
import { z } from "zod";

// Categorias de pagamento — lista fixa: ao contrário de "team" (que é
// texto livre porque a lista de times muda sem envolver o código), estas
// quatro correspondem a um texto de notificação fixo cada (ver
// PAGAMENTO_MESSAGE no serviço da API) — uma quinta categoria exigiria de
// qualquer forma uma mudança de código para ter uma mensagem própria.
export const PAGAMENTO_CATEGORIAS = [
  "salario",
  "auxilio_home_office",
  "vale_transporte",
  "vale_alimentacao",
] as const;
export type PagamentoCategoria = (typeof PAGAMENTO_CATEGORIAS)[number];

export const SendPagamentoSchema = z.object({
  category: z.enum(PAGAMENTO_CATEGORIAS),
  userIds: z.array(z.string().min(1)).min(1),
});
export type SendPagamentoInput = z.infer<typeof SendPagamentoSchema>;
```

Exportado de `packages/shared-types/src/index.ts` junto com o resto.

### 2.4 API — módulo `notifications` (novo: `apps/api/src/notifications/`)

`notifications.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PagamentoCategoria } from '@ponto-dcit/shared-types';

const PAGAMENTO_MESSAGE: Record<PagamentoCategoria, string> = {
  salario: 'Seu salário foi depositado.',
  auxilio_home_office: 'Seu auxílio home office foi depositado.',
  vale_transporte: 'Seu vale-transporte foi depositado.',
  vale_alimentacao: 'Seu vale-alimentação foi depositado.',
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async sendPagamento(category: PagamentoCategoria, userIds: string[]) {
    const message = PAGAMENTO_MESSAGE[category];
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: 'pagamento',
        category,
        message,
      })),
    });
  }

  // start/end: strings "YYYY-MM-DD", calculadas pelo cliente (mesmo padrão
  // já usado em /banco-de-horas/equipe — a API nunca decide sozinha "qual
  // mês é agora", só recebe o intervalo já resolvido no fuso de São Paulo).
  async pagamentoStatus(category: PagamentoCategoria, start: string, end: string) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        type: 'pagamento',
        category,
        createdAt: { gte: new Date(start), lte: new Date(`${end}T23:59:59.999Z`) },
      },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, createdAt: true },
    });
    // Um colaborador pode ter sido notificado mais de uma vez no período
    // (reenvio) — mantém só o mais recente por userId; orderBy desc acima
    // garante que o primeiro encontro por userId já é o mais recente.
    const seen = new Map<string, string>();
    for (const n of notifications) {
      if (!seen.has(n.userId)) seen.set(n.userId, n.createdAt.toISOString());
    }
    return Array.from(seen, ([userId, sentAt]) => ({ userId, sentAt }));
  }

  listMine(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(id: string, userId: string) {
    // where composto (id + userId) em vez de findUnique+update separados:
    // um usuário não pode marcar como lida a notificação de outro só por
    // adivinhar o id — updateMany com esse where não afeta nada se o id
    // pertencer a outro userId, sem precisar de uma checagem de posse à parte.
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }
}
```

`notifications.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { SendPagamentoSchema, PAGAMENTO_CATEGORIAS } from '@ponto-dcit/shared-types';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Post('pagamentos')
  async sendPagamento(@Body() body: unknown) {
    const result = SendPagamentoSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    await this.notifications.sendPagamento(result.data.category, result.data.userIds);
    return { sent: result.data.userIds.length };
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Get('pagamentos/status/:category')
  pagamentoStatus(
    @Param('category') category: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    if (!PAGAMENTO_CATEGORIAS.includes(category as never)) {
      throw new BadRequestException('categoria inválida');
    }
    return this.notifications.pagamentoStatus(category as never, start, end);
  }

  @UseGuards(AuthGuard)
  @Get('mine')
  listMine(@Req() req: AuthenticatedRequest) {
    return this.notifications.listMine(req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Post(':id/read')
  markRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.notifications.markRead(id, req.user.sub);
  }
}
```

`GET /notifications/mine` e `POST /notifications/:id/read` não são consumidos por nenhuma UI nesta spec — existem só para os sub-projetos 2/3, e são testados no nível de API (controller/service specs) mas não têm nenhum teste e2e do web nesta spec, já que não há página nenhuma que os chame ainda.

`notifications.module.ts`: padrão de todo outro módulo (`imports: [PrismaModule]` se necessário conferir o padrão exato em `mural.module.ts`, `providers`/`controllers`/`exports` na mesma forma).

## 3. Web (`apps/web`) — tela `/pagamentos`

### 3.1 `apps/web/src/app/(app)/pagamentos/page.tsx` (novo, RH-only)

```tsx
import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";
import { PAGAMENTO_CATEGORIAS, type PagamentoCategoria } from "@ponto-dcit/shared-types";

import { PagamentoCategorySection } from "./pagamento-category-section";
import styles from "./pagamentos.module.css";

const CATEGORIA_LABEL: Record<PagamentoCategoria, string> = {
  salario: "Salário",
  auxilio_home_office: "Auxílio Home Office",
  vale_transporte: "Vale Transporte",
  vale_alimentacao: "Vale Alimentação",
};

type EmployeeRecord = {
  userId: string;
  name: string;
  role: string;
  team: string | null;
};

// Mesmo raciocínio de banco-de-horas/page.tsx's todaySaoPauloDateOnly — "que
// mês é agora" segue o fuso da empresa, nunca o fuso ambiente do servidor.
function todaySaoPauloDateOnly(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function firstDayOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

export default async function PagamentosPage() {
  const session = await getSession();
  if (!session || session.role !== "rh") {
    return (
      <EmptyState title="Sem permissão" description="Esta página é restrita ao RH." />
    );
  }

  const employees = await apiFetchJson<EmployeeRecord[]>("/employees");
  const colaboradores = employees.filter((e) => e.role === "colaborador");

  const today = todaySaoPauloDateOnly();
  const start = firstDayOfMonth(today);

  const statusByCategory = await Promise.all(
    PAGAMENTO_CATEGORIAS.map((category) =>
      apiFetchJson<{ userId: string; sentAt: string }[]>(
        `/notifications/pagamentos/status/${category}?start=${start}&end=${today}`,
      ),
    ),
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Pagamentos</h1>
      <div className={styles.categories}>
        {PAGAMENTO_CATEGORIAS.map((category, index) => (
          <PagamentoCategorySection
            key={category}
            category={category}
            label={CATEGORIA_LABEL[category]}
            colaboradores={colaboradores}
            status={statusByCategory[index]}
          />
        ))}
      </div>
    </div>
  );
}
```

`EmployeeRecord` inclui `team` porque `GET /employees` já retorna o `Employee` inteiro (`this.prisma.employee.findMany`, seção 2.1) — nenhuma mudança de API pra isso, só o campo novo passa a existir na resposta assim que a migration roda.

### 3.2 `PagamentoCategorySection` — Client Component (acordeão + filtros + envio)

Único Client Component desta spec. Justificativa da escolha (mesmo padrão de justificar Client Components das specs anteriores — Documentos só usou onde upload de arquivo exigia, Mural não usou nenhum): o acordeão por categoria precisa de estado local (aberto/fechado, mesmo padrão de `EmployeeBenefitsGroup` em `beneficios/employee-benefits-group.tsx` — **botão + chevron, não `<details>` nativo**, porque `<details>` já foi descartado numa spec anterior por renderizar inconsistente entre navegadores), e a busca por nome + filtro por time precisam recalcular a lista visível a cada tecla — não dá pra fazer isso com Server Components/forms nativos sem um round-trip ao servidor por tecla digitada, o que seria uma experiência ruim para uma busca local sobre uma lista já carregada.

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";

import { sendPagamento } from "./actions";
import styles from "./pagamentos.module.css";

type Colaborador = { userId: string; name: string; role: string; team: string | null };
type StatusEntry = { userId: string; sentAt: string };

function formatSentAt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function PagamentoCategorySection({
  category,
  label,
  colaboradores,
  status,
}: {
  category: string;
  label: string;
  colaboradores: Colaborador[];
  status: StatusEntry[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [isPending, startTransition] = useTransition();

  const sentAtByUserId = useMemo(() => new Map(status.map((s) => [s.userId, s.sentAt])), [status]);

  const teams = useMemo(
    () =>
      Array.from(new Set(colaboradores.map((c) => c.team).filter((t): t is string => Boolean(t)))).sort(),
    [colaboradores],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return colaboradores.filter((c) => {
      const matchesSearch = query.length === 0 || c.name.toLowerCase().includes(query);
      const matchesTeam = teamFilter.length === 0 || c.team === teamFilter;
      return matchesSearch && matchesTeam;
    });
  }, [colaboradores, search, teamFilter]);

  function handleSend(userIds: string[]) {
    startTransition(async () => {
      await sendPagamento(category, userIds);
    });
  }

  return (
    <div className={styles.categoryGroup}>
      <button
        type="button"
        className={styles.categoryHeader}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className={styles.categoryLabel}>{label}</span>
        <svg
          className={open ? `${styles.categoryChevron} ${styles.categoryChevronOpen}` : styles.categoryChevron}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className={styles.categoryBody}>
          <div className={styles.filters}>
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={styles.filterInput}
              aria-label={`Buscar colaborador em ${label}`}
            />
            <select
              value={teamFilter}
              onChange={(event) => setTeamFilter(event.target.value)}
              className={styles.filterSelect}
              aria-label={`Filtrar por time em ${label}`}
            >
              <option value="">Todos os times</option>
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.sendAllButton}
              disabled={isPending || filtered.length === 0}
              onClick={() => handleSend(filtered.map((c) => c.userId))}
            >
              Enviar para todos ({filtered.length})
            </button>
          </div>

          {filtered.length === 0 ? (
            <p className={styles.sectionEmpty}>Nenhum colaborador encontrado.</p>
          ) : (
            <ul className={styles.list}>
              {filtered.map((colaborador) => {
                const sentAt = sentAtByUserId.get(colaborador.userId);
                return (
                  <li key={colaborador.userId} className={styles.item}>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemName}>{colaborador.name}</span>
                      <span className={styles.itemDetail}>
                        {colaborador.team ?? "Sem time"} ·{" "}
                        {sentAt ? `Enviado em ${formatSentAt(sentAt)}` : "Não enviado"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.sendButton}
                      disabled={isPending}
                      onClick={() => handleSend([colaborador.userId])}
                    >
                      {sentAt ? "Reenviar" : "Enviar"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
```

`useTransition` (não um simples `async function` solto) porque `disabled={isPending}` precisa refletir o estado de carregamento nos botões — sem isso, cliques repetidos durante o envio disparariam múltiplas chamadas simultâneas.

### 3.3 `apps/web/src/app/(app)/pagamentos/actions.ts` (novo)

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function sendPagamento(category: string, userIds: string[]) {
  const res = await apiFetch("/notifications/pagamentos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, userIds }),
  });
  if (!res.ok) {
    throw new Error(`/notifications/pagamentos responded with ${res.status}`);
  }
  revalidatePath("/pagamentos");
}
```

Chamada diretamente pelo Client Component (não dentro de um `<form action={...}>`) — é o primeiro lugar do portal onde isso acontece, então vale registrar por quê: uma Server Action pode ser importada e chamada como uma função async comum a partir de qualquer Client Component, `<form>` é só o jeito mais comum de invocá-la quando os dados vêm de inputs nativos. Aqui os dados (`userIds`, potencialmente uma lista variável calculada pelo filtro no cliente) não têm como ser expressos como um `FormData` de um formulário nativo sem reconstruir manualmente uma lista de inputs hidden — chamar a função diretamente é mais simples e é um uso suportado, não uma gambiarra. `revalidatePath` dentro da action continua funcionando do mesmo jeito independente de como a action foi invocada.

### 3.4 `pagamentos.module.css` (novo)

Reaproveita nomes de classe já estabelecidos onde o propósito é idêntico (`.page`, `.heading`, `.list`, `.item`, `.itemInfo`, `.itemName`, `.itemDetail`, `.sectionEmpty` — mesmo desenho visual do resto do portal). Classes novas: `.categories`, `.categoryGroup`, `.categoryHeader`, `.categoryLabel`, `.categoryChevron`/`.categoryChevronOpen` (mesmo desenho de `.employeeChevron`/`.employeeChevronOpen` em `beneficios.module.css` — copiar os valores exatos de lá), `.categoryBody`, `.filters`, `.filterInput`, `.filterSelect`, `.sendAllButton`, `.sendButton`.

### 3.5 `nav-sections.ts`

```typescript
{ href: "/pagamentos", label: "Pagamentos", roles: ["rh"] },
```

Adicionado depois da entrada `/beneficios` (agrupamento temático — Benefícios, Holerites e Pagamentos são as três páginas do portal que lidam com dinheiro/remuneração).

## 4. Mobile

Nenhuma mudança nesta spec — o mobile não tem tela de RH para isto, e o sininho do colaborador (que consumiria `GET /notifications/mine`) é o sub-projeto 3, não esta spec.

## 5. Testes

### 5.1 API

- `notifications.service.spec.ts`/`notifications.controller.spec.ts` (novos, mesmo padrão de `mural.service.spec.ts`/`mural.controller.spec.ts`):
  - `sendPagamento` cria um `Notification` por `userId` com `type: "pagamento"`, a `category` certa, e a mensagem correspondente de `PAGAMENTO_MESSAGE`.
  - `pagamentoStatus` retorna só notificações dentro do intervalo `[start, end]`; um colaborador notificado duas vezes no período aparece uma vez só, com o `sentAt` mais recente.
  - `markRead` não afeta uma notificação de outro `userId` (tenta marcar como lida um id que pertence a outro usuário, confirma que `readAt` continua `null`).
  - `sendPagamento`/`pagamentoStatus`: `RolesGuard` rejeita quem não é `rh` (gestor e colaborador, ambos 403).
  - `listMine`/`markRead`: qualquer role autenticada tem acesso (sem `RolesGuard`, só `AuthGuard`).
- `employees.controller.spec.ts`/`employees.service.spec.ts`: fixtures existentes ganham `team: null` (ou um valor de teste) onde hoje têm `cargo: null` — sem isso, a suíte quebra assim que `team` vira `.nullable()` no schema (ver 2.1).

### 5.2 Web (`pagamentos.spec.ts`, novo)

- RH vê as 4 categorias fechadas por padrão; gestor e colaborador veem `EmptyState` "Sem permissão" (diferente de `convencoes`/`documentos`, RH-only mesmo para gestor — confirmar isso é intencional, é o único ponto desta spec com essa restrição mais estreita).
- Expandir uma categoria mostra a lista de colaboradores (mock de `/employees`) com o status "Não enviado" quando `pagamentos/status` retorna vazio.
- Um colaborador com uma entrada em `status` mostra "Enviado em DD/MM/AAAA" (fixture com `createdAt`/`sentAt` em UTC-midnight, mesmo cuidado de fuso já registrado nas specs anteriores) e o botão vira "Reenviar".
- Digitar na busca filtra a lista por nome (case-insensitive, substring).
- Selecionar um time no filtro mostra só quem tem aquele `team`; um colaborador sem `team` (`null`) nunca aparece em nenhum filtro de time específico, só em "Todos os times".
- Clicar em "Enviar" num colaborador chama `POST /notifications/pagamentos` com `{ category, userIds: [aquele um userId] }` (via `getRecordedRequests`).
- Clicar em "Enviar para todos" com um filtro de time aplicado chama a mesma rota com `userIds` = só os `userId` que passam no filtro no momento do clique, não todos os colaboradores da categoria.
- `enviar para todos` fica desabilitado quando a lista filtrada está vazia.

### 5.3 `test-session.ts`

Nenhuma mudança ao tipo de `mockApi`'s `data`: a chave `employees` já existe (semeia `/employees`, hoje reaproveitada pelos testes de `colaboradores.spec.ts`) e serve sem alteração para esta spec também. O status por categoria usa `seedResponse` diretamente — um `POST` ao `__seed` por categoria testada, mesmo padrão já usado para outras rotas dinâmicas por id (ex.: `/atestados/:id/photo` em `documentos.spec.ts`), o que só funciona de forma independente por categoria **porque** a seção 2.4 já move `category` para o path (`/notifications/pagamentos/status/:category`) em vez de query string — `fake-api-server.mjs` casa rotas só por `method` + `pathname`, ignorando query string (`seedKey` usa só `url.pathname`), então um `?category=salario` vs `?category=vale_transporte` na mesma pathname colidiriam no mesmo seed se a categoria não estivesse no path:

```typescript
await seedResponse(request, {
  method: "GET",
  path: "/notifications/pagamentos/status/salario",
  response: [{ userId: "colaborador-1", sentAt: "2026-09-01T12:00:00.000Z" }],
});
```

**`fake-api-server.mjs` precisa de uma rota nova:** confirmado que o fallback padrão do servidor fake para qualquer rota não semeada é `404` (`no fake-api handler for ...`), não `200 []`. Como `PagamentosPage` busca o status das 4 categorias em paralelo a cada carregamento (`Promise.all` na seção 3.1), **todo** teste que visita `/pagamentos` — mesmo um que só quer testar uma categoria — precisaria semear as 4 rotas de status manualmente sem esse fallback, o que é ruído repetido em todo teste do arquivo. Mesmo tratamento já dado a `/atestados/team` e às rotas `/solicitacoes/*/todas`: adicionar em `fake-api-server.mjs`, antes do fallback final de 404,

```javascript
if (req.method === "GET" && /^\/notifications\/pagamentos\/status\/[^/]+$/.test(url.pathname)) {
  return sendJson(res, 200, []);
}
```

Testes que precisam de um status não-vazio para uma categoria específica continuam usando `seedResponse` (que roda antes deste fallback na ordem de checagem — `seeded[...]` é conferido primeiro, no topo do handler) para sobrescrever só aquela categoria.

## 6. Global Constraints

- Sem valor em R$ na notificação — todas as quatro categorias usam um texto de status fixo, sem valor monetário. Adicionar valores é fora de escopo (seção 7).
- `team` é texto livre (`z.string().min(1).nullable()`), não um enum fixo como `cargo`/`nivel` — a lista de times no filtro vem dos valores já cadastrados, não de uma constante no código.
- `Notification.type` é uma string livre (não um enum do Prisma) para que o próximo item do roadmap (detecção automática de ponto perdido) reaproveite esta mesma tabela sem migration nova.
- `/pagamentos` é **RH-only**, não `["gestor", "rh"]` como a maioria das páginas administrativas deste portal — confirmar esse detalhe explicitamente na implementação e nos testes, é uma exceção ao padrão mais comum do resto do app.
- "Já enviado este mês" é derivado só da tabela `Notification` via intervalo de datas calculado pelo cliente (mesmo padrão de `/banco-de-horas/equipe`) — nenhuma tabela de status separada.
- O acordeão de categoria segue o padrão de `EmployeeBenefitsGroup` (botão + chevron) — nunca `<details>` nativo, mesma razão já registrada na spec de Benefícios.
- `sendPagamento` (a Server Action) é chamada diretamente do Client Component, não via `<form action={...}>` — primeira vez nesta base de código, documentado explicitamente na seção 3.3 para não ser confundido com um desvio acidental do padrão.
- Nenhuma UI nesta spec consome `GET /notifications/mine`/`POST /notifications/:id/read` — eles existem só para os sub-projetos 2 e 3.

## 7. Fora de escopo

- Sininho de notificações do colaborador (web) — sub-projeto 2, spec própria, consome a API desta spec sem mudá-la.
- Sininho de notificações do colaborador (mobile) — sub-projeto 3, spec própria.
- Valores em R$ nas notificações de pagamento (exigiria cadastrar Auxílio Home Office/Vale Transporte/Vale Alimentação por colaborador — nenhuma plataforma tem esses campos hoje).
- Mensagem customizada pelo RH ao enviar — o texto é fixo por categoria, sem campo de texto livre no envio.
- Notificações de outros tipos além de "pagamento" (ex.: ponto perdido) — a tabela já está pronta para isso, mas nenhum outro produtor é implementado aqui.
- Desfazer um envio (não existe "cancelar notificação" — uma vez criada, a `Notification` só pode ser marcada como lida, nunca removida ou revertida).
- Qualquer alteração ao `GET /employees` existente além de o campo `team` passar a vir preenchido — a rota já retorna o `Employee` inteiro, nenhuma mudança de shape além do dado novo.
