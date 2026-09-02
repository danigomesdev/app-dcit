# Gestão de Carreiras (PDI, Trilhas e Avaliações de Desempenho)

**Status:** Proposto
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)

## 1. Objetivo e escopo

Novo item de menu **apenas para o gestor** — "Gestão de Carreiras" — cobrindo três pilares pedidos originalmente: (A) Trilha de Carreira & Requisitos de Promoção, (B) PDI & Entregas, (C) Avaliações de Desempenho & Feedbacks. Todo o recurso é consumido pelo gestor sobre os colaboradores; não há, nesta versão, nenhuma tela equivalente para o colaborador ver seu próprio PDI/avaliação.

Decisões de escopo fechadas em conversa antes deste documento:

- **Apenas `gestor`, não `rh`.** Diferente da maioria das outras telas de equipe deste app (que são `gestor`+`rh`), o pedido original foi explícito: "Apenas Gestor". RBAC (backend e frontend) usa só `@Roles('gestor')`.
- **Sem vínculo formal gestor→liderado.** Mesma limitação já documentada na spec de Ponto Perdido: `Employee.role` é texto solto e `Employee.team` é texto livre, sem relação com gestor nenhum. O gestor vê **todos os colaboradores da empresa**, exatamente como a tela `/colaboradores` já funciona hoje — não escopamos por "minha equipe".
- **Avaliação só do gestor.** Sem autoavaliação, sem avaliação por pares. O gestor avalia cada colaborador diretamente — remove toda a complexidade de coleta/agregação de múltiplas respostas que um "360° completo" exigiria.
- **Nine Box: os dois eixos (desempenho e potencial) são definidos manualmente pelo gestor**, não calculados a partir de outra fonte.
- **Requisitos de trilha (certificações/cursos) são cadastro livre por colaborador** — sem catálogo fixo de regras por cargo/nível. O gestor lança o que julgar necessário para aquele colaborador específico.
- **Elegibilidade de promoção é calculada automaticamente**, com tempo mínimo fixo de **3 meses** no cargo atual (ver §5).
- **Metas do PDI e "entregas" são uma lista simples com status** (pendente/andamento/concluída) — sem estrutura formal de OKR (Objetivo + Key Results mensuráveis).
- **Registros de 1:1 são estruturados**: pauta + itens de ação (cada um com seu próprio status), não só um campo de texto livre.
- **Estrutura de código**: um domínio único `carreira` com 3 abas, não três features independentes — compartilha a seleção de colaborador entre elas, seguindo o padrão de abas por query param já usado em Documentos (`?categoria=`).

**Simplificação que precisa ficar explícita**: o pedido original fala em "tempo no cargo atual", mas o schema não tem um campo que registre quando o colaborador mudou de cargo/nível — só `Employee.hireDate` (data de contratação). Esta versão usa `hireDate` como proxy de tempo de casa; rastrear mudança de cargo/nível como evento separado fica fora de escopo (§7).

## 2. Modelo de dados (`apps/api/prisma/schema.prisma`)

Seguindo a convenção já estabelecida no schema inteiro: **nenhum `@relation`/FK do Prisma** — toda referência cruzada é um `String` solto (`userId`, `gestorId`, etc.), resolvido manualmente na camada de serviço (mesmo padrão de `convencaoId`, "sem FK — resolvido na camada de serviço"). Enums são `String` com o conjunto de valores válidos documentado em comentário, igual `nivel`/`estadoCivil`.

```prisma
model CareerGoal {
  id          String    @id @default(uuid())
  userId      String    // colaborador dono da meta
  tipo        String    // "pdi" | "entrega" — mesma tabela para Plano de Ação (PDI)
                         // e Histórico de Entregas/Metas, filtrável por tipo
  title       String
  description String?
  dueDate     DateTime?
  status      String    @default("pendente") // "pendente" | "andamento" | "concluida"
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model TrackRequirement {
  id        String   @id @default(uuid())
  userId    String   // colaborador para quem este requisito foi cadastrado
  title     String   // ex: "Certificação AWS Solutions Architect" — texto livre,
                      // cadastrado pelo gestor, sem catálogo fixo por cargo/nível
  status    String   @default("pendente") // "pendente" | "andamento" | "concluido"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model PerformanceEvaluation {
  id             String   @id @default(uuid())
  userId         String   // colaborador avaliado
  evaluatorId    String   // gestor que avaliou — sem FK, mesma convenção de convencaoId
  date           DateTime @default(now())
  proatividade   Int      // 1-5
  trabalhoEquipe Int      // 1-5
  comunicacao    Int      // 1-5
  lideranca      Int      // 1-5
  comentario     String?
  createdAt      DateTime @default(now())
}

model NineBoxPlacement {
  id         String   @id @default(uuid())
  userId     String   // colaborador posicionado
  gestorId   String   // gestor que definiu a posição
  desempenho String   // "baixo" | "medio" | "alto"
  potencial  String   // "baixo" | "medio" | "alto"
  date       DateTime @default(now())
  createdAt  DateTime @default(now())
}

model OneOnOne {
  id          String    @id @default(uuid())
  userId      String    // colaborador
  gestorId    String
  date        DateTime  @default(now())
  pauta       String
  proximaData DateTime?
  createdAt   DateTime  @default(now())
}

model OneOnOneAcao {
  id         String   @id @default(uuid())
  oneOnOneId String   // sem FK — resolvido na camada de serviço
  descricao  String
  status     String   @default("pendente") // "pendente" | "concluido"
  createdAt  DateTime @default(now())
}
```

`NineBoxPlacement` e `PerformanceEvaluation` guardam histórico completo (nunca fazem update in-place) — a posição/nota "atual" é sempre a de `date` mais recente por `userId`. Isso dá de graça um histórico de evolução, sem custo extra de modelagem.

## 3. Backend (`apps/api/src/carreira/`)

Um módulo, múltiplos controllers/services (um por sub-recurso), todos com `@UseGuards(AuthGuard, RolesGuard) @Roles('gestor')`:

- `metas.controller.ts` / `metas.service.ts` — `CareerGoal`.
  - `GET /carreira/metas?userId=` · `POST /carreira/metas` · `PATCH /carreira/metas/:id` · `DELETE /carreira/metas/:id`
- `trilha.controller.ts` / `trilha.service.ts` — `TrackRequirement`.
  - `GET /carreira/trilha?userId=` · `POST /carreira/trilha` · `PATCH /carreira/trilha/:id` · `DELETE /carreira/trilha/:id`
- `avaliacoes.controller.ts` / `avaliacoes.service.ts` — `PerformanceEvaluation`.
  - `GET /carreira/avaliacoes?userId=` (histórico) · `POST /carreira/avaliacoes` (`evaluatorId` vem da sessão autenticada, nunca do body)
- `nine-box.controller.ts` / `nine-box.service.ts` — `NineBoxPlacement`.
  - `GET /carreira/nine-box?userId=` (histórico + posição atual) · `POST /carreira/nine-box`
- `one-on-ones.controller.ts` / `one-on-ones.service.ts` — `OneOnOne` + `OneOnOneAcao`.
  - `GET /carreira/one-on-ones?userId=` (cada item já vem com suas `acoes`, join manual no service) · `POST /carreira/one-on-ones` (cria o registro e suas ações numa única chamada, `createMany` para as ações) · `PATCH /carreira/one-on-ones/acoes/:id` (só alterna status)
- `promotabilidade.controller.ts` / `promotabilidade.service.ts` — não tem model próprio, lê dos outros quatro. Ver §5.
  - `GET /carreira/promotabilidade` (todos os colaboradores de uma vez — usado para popular o badge em `/colaboradores` sem N+1 requisições)
  - `GET /carreira/promotabilidade/:userId` (detalhe: quais critérios faltam, para exibir na própria tela de Gestão de Carreiras)

`CarreiraModule` declara os 6 controllers/services acima; nenhum outro módulo precisa ser modificado (diferente da spec de Ponto Perdido, aqui não há necessidade de injetar `NotificationsService`).

### 3.1 Validação (`packages/shared-types/src/carreira.ts`, novo)

```typescript
import { z } from "zod";

export const CAREER_GOAL_TIPOS = ["pdi", "entrega"] as const;
export const STATUS_TAREFA = ["pendente", "andamento", "concluida"] as const;
export const STATUS_REQUISITO = ["pendente", "andamento", "concluido"] as const;
export const NIVEL_NINE_BOX = ["baixo", "medio", "alto"] as const;
export const STATUS_ACAO = ["pendente", "concluido"] as const;

export const CareerGoalCreateSchema = z.object({
  userId: z.string().min(1),
  tipo: z.enum(CAREER_GOAL_TIPOS),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});
export const CareerGoalUpdateSchema = z.object({
  status: z.enum(STATUS_TAREFA),
});

export const TrackRequirementCreateSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1),
});
export const TrackRequirementUpdateSchema = z.object({
  status: z.enum(STATUS_REQUISITO),
});

export const PerformanceEvaluationCreateSchema = z.object({
  userId: z.string().min(1),
  proatividade: z.number().int().min(1).max(5),
  trabalhoEquipe: z.number().int().min(1).max(5),
  comunicacao: z.number().int().min(1).max(5),
  lideranca: z.number().int().min(1).max(5),
  comentario: z.string().optional(),
});

export const NineBoxPlacementCreateSchema = z.object({
  userId: z.string().min(1),
  desempenho: z.enum(NIVEL_NINE_BOX),
  potencial: z.enum(NIVEL_NINE_BOX),
});

export const OneOnOneCreateSchema = z.object({
  userId: z.string().min(1),
  pauta: z.string().min(1),
  proximaData: z.string().datetime().optional(),
  acoes: z.array(z.object({ descricao: z.string().min(1) })).default([]),
});
export const OneOnOneAcaoUpdateSchema = z.object({
  status: z.enum(STATUS_ACAO),
});

export type CareerGoalCreateInput = z.infer<typeof CareerGoalCreateSchema>;
export type TrackRequirementCreateInput = z.infer<typeof TrackRequirementCreateSchema>;
export type PerformanceEvaluationCreateInput = z.infer<typeof PerformanceEvaluationCreateSchema>;
export type NineBoxPlacementCreateInput = z.infer<typeof NineBoxPlacementCreateSchema>;
export type OneOnOneCreateInput = z.infer<typeof OneOnOneCreateSchema>;
```

## 4. Frontend (`apps/web`)

### 4.1 Sidebar (`apps/web/src/lib/nav-sections.ts` + `apps/web/src/components/nav-links.tsx`)

Hoje `NavLinks` só monta grupos colapsáveis (`SidebarGroup`/`NavGroupItem`) para `role === "colaborador"`; gestor e rh sempre recebem a lista flat de `NAV_SECTIONS`. Como este item é **gestor-only** (nem rh, nem colaborador), a mudança fica isolada num novo branch:

```typescript
// nav-sections.ts — novo, ao lado de COLABORADOR_SIDEBAR
export const GESTOR_CAREER_GROUP: SidebarGroup = {
  href: "/gestao-carreiras",
  label: "Gestão de Carreiras",
  children: [
    { href: "/gestao-carreiras?aba=pdi", label: "PDI & Metas" },
    { href: "/gestao-carreiras?aba=trilha", label: "Matriz de Promoção / Trilhas de Carreira" },
    { href: "/gestao-carreiras?aba=avaliacoes", label: "Avaliações de Desempenho" },
  ],
};
```

```typescript
// nav-links.tsx — NavLinks(), novo branch entre o de colaborador e o retorno flat existente
if (role === "gestor") {
  const flatEntries = NAV_SECTIONS.filter((section) => section.roles.includes("gestor"));
  return (
    <nav className={styles.navSections}>
      <ul className={styles.nav}>
        {flatEntries.map((link) => (
          <NavLinkItem key={link.href} link={link} pathname={pathname} />
        ))}
      </ul>
      <NavGroupItem group={GESTOR_CAREER_GROUP} pathname={pathname} />
    </nav>
  );
}
```

`rh` continua exatamente como está hoje (não entra nesse branch, não ganha o item). Nota de UX menor: como os 3 filhos do grupo apontam todos para o mesmo `pathname` (`/gestao-carreiras`, variando só a query `?aba=`), o destaque individual de "item ativo" do `NavLinkItem` (que compara só `pathname`) não distingue qual sub-aba está aberta — mesma limitação que Documentos já aceita hoje (lá a seleção de categoria também não é destacada na sidebar, só no tab in-page). A aba ativa fica clara pelos tabs dentro da própria página (§4.2), não na sidebar.

### 4.2 Página (`apps/web/src/app/(app)/gestao-carreiras/`)

- `page.tsx` — Server Component. Guarda `session.role !== "gestor"` → `<EmptyState>`. Lê `searchParams` (`aba`, default `"pdi"`; `userId`, opcional). Busca lista de colaboradores (`GET /employees`, mesma fonte que `/colaboradores`) para o seletor. Sem `userId` selecionado, mostra só o seletor + empty state ("Selecione um colaborador"). Com `userId`, renderiza tabs (`Link href="/gestao-carreiras?aba=X&userId=Y"`, mesmo padrão de `?categoria=` do Documentos) e a aba ativa:
  - `aba=pdi` → `MetasSection` (lista `CareerGoal` tipo `pdi` e `entrega`, formulário de criação, toggle de status).
  - `aba=trilha` → `TrilhaSection` (indicador de tempo de casa, checklist de `TrackRequirement`, formulário de criação, toggle de status).
  - `aba=avaliacoes` → sub-tabs internas (`?sub=ciclos|1a1|ninebox`, default `ciclos`) — `CiclosSection` (histórico de `PerformanceEvaluation` + formulário de nova avaliação), `OneOnOneSection` (histórico de `OneOnOne` com suas ações + formulário), `NineBoxSection` (grid 3x3 + formulário de novo posicionamento).
- `actions.ts` — Server Actions por sub-recurso (`createCareerGoal`, `updateCareerGoalStatus`, `createTrackRequirement`, ..., `createEvaluation`, `createNineBoxPlacement`, `createOneOnOne`, `updateOneOnOneAcaoStatus`), cada uma um `fetch` para o endpoint correspondente + `revalidatePath("/gestao-carreiras")`.
- Componentes de seção como Client Components quando precisam de `useActionState` (mesmo padrão de `colaboradores-row.tsx`), CSS Module próprio (`gestao-carreiras.module.css`).

### 4.3 Badge de promotabilidade em `/colaboradores`

`apps/web/src/app/(app)/colaboradores/page.tsx`: quando `session.role === "gestor"` (só gestor — RH continua vendo a lista exatamente como hoje, sem chamada extra nem badge, preservando o "apenas gestor" do pedido), busca `GET /carreira/promotabilidade` em paralelo com `GET /employees` e passa o mapa `userId -> status` para `ColaboradoresRow`. `colaboradores-row.tsx` ganha uma prop opcional `promotabilidade?: "verde" | "amarelo" | "branco"` e renderiza um badge (🟢/🟡/⚪) ao lado do nome quando presente.

## 5. Regra de negócio: cálculo de promotabilidade

Roda inteiramente em `PromotabilidadeService`, nunca no banco. Para cada colaborador ativo:

```typescript
type Status = "verde" | "amarelo" | "branco";

function calcularStatus(input: {
  hireDate: Date;
  now: Date;
  requisitos: { status: string }[];       // TrackRequirement do colaborador
  metasPdi: { status: string }[];         // CareerGoal tipo "pdi" do colaborador
  ultimaAvaliacao: PerformanceEvaluation | null;
}): Status {
  const mesesDeCasa = diffInMonths(input.hireDate, input.now);
  if (mesesDeCasa < 3) return "branco";

  const semTrilhaIniciada = input.requisitos.length === 0 && input.metasPdi.length === 0;
  if (semTrilhaIniciada && !input.ultimaAvaliacao) return "branco";

  const todosRequisitosOk = input.requisitos.every((r) => r.status === "concluido");
  const todasMetasOk = input.metasPdi.every((m) => m.status === "concluida");
  const mediaAvaliacao = input.ultimaAvaliacao
    ? (input.ultimaAvaliacao.proatividade +
       input.ultimaAvaliacao.trabalhoEquipe +
       input.ultimaAvaliacao.comunicacao +
       input.ultimaAvaliacao.lideranca) / 4
    : 0;

  if (todosRequisitosOk && todasMetasOk && mediaAvaliacao >= 4) return "verde";
  return "amarelo";
}
```

- 🟢 **Verde** — tempo de casa ≥ 3 meses, todos os `TrackRequirement` `concluido`, todas as `CareerGoal` tipo `pdi` `concluida`, e média das 4 notas da última `PerformanceEvaluation` ≥ 4.
- 🟡 **Amarelo** — tempo ≥ 3 meses e já existe algum progresso registrado (trilha ou avaliação iniciada), mas nem todos os critérios acima estão completos.
- ⚪ **Branco** — tempo de casa < 3 meses, **ou** tempo ≥ 3 meses mas nada foi registrado ainda (nenhum requisito, nenhuma meta de PDI, nenhuma avaliação) — trilha "não iniciada".

`GET /carreira/promotabilidade` roda essa função para todos os colaboradores ativos numa única passada (busca em lote de `TrackRequirement`/`CareerGoal`/`PerformanceEvaluation` por `userId in [...]`, sem N+1 queries).

## 6. Testes

- `promotabilidade.service.spec.ts` (novo) — casos: < 3 meses de casa → branco mesmo com tudo completo; ≥ 3 meses sem nada cadastrado → branco; ≥ 3 meses com requisito pendente → amarelo; ≥ 3 meses com tudo completo mas nota média 3.75 → amarelo; ≥ 3 meses com tudo completo e média ≥ 4 → verde; nota exata 4.0 conta como "≥ 4" (não estritamente maior).
- `metas.service.spec.ts`, `trilha.service.spec.ts` (novos) — CRUD básico + transição de status.
- `avaliacoes.service.spec.ts` (novo) — criação grava `evaluatorId` da sessão, não do body; histórico ordenado por `date` desc.
- `nine-box.service.spec.ts` (novo) — criação de novo posicionamento não sobrescreve o anterior (histórico); "posição atual" é sempre a de `date` mais recente.
- `one-on-ones.service.spec.ts` (novo) — criação em lote das `acoes` junto com o `OneOnOne`; toggle de status de uma ação não afeta as demais do mesmo registro.
- Controllers (todos os 6) — `RolesGuard` rejeita `colaborador` e **`rh`** (diferente do resto do app, este módulo é `gestor`-only) com 403.
- `apps/web`: nenhum e2e novo obrigatório; se `/colaboradores` ganhar o badge, checar que o Playwright existente da listagem não quebra (RH não deve ver badge nem sofrer requisição extra).

## 7. Global Constraints

- RBAC deste módulo inteiro é `@Roles('gestor')` — **nunca** inclui `'rh'`, diferente da convenção usual deste app onde gestor e rh compartilham a maioria das telas de equipe. Isso foi uma decisão explícita do pedido original ("Apenas Gestor").
- Nenhum novo `@relation`/FK do Prisma — todas as referências cruzadas (`userId`, `evaluatorId`, `gestorId`, `oneOnOneId`) são `String` soltos resolvidos manualmente no service, mesma convenção do resto do schema.
- `evaluatorId`/`gestorId` sempre vêm da sessão autenticada (`request.user`), nunca do body do request — um gestor não pode atribuir a avaliação/1:1 a outro gestor.
- `hireDate` é reaproveitado como proxy de "tempo no cargo atual" — não existe (e não será criado nesta versão) um campo separado para data de início no cargo/nível atual.
- O badge de promotabilidade em `/colaboradores` só aparece e só dispara requisição extra quando `session.role === "gestor"` — zero mudança de comportamento para `rh`.
- `NineBoxPlacement` e `PerformanceEvaluation` são sempre inserção (nunca update in-place) — histórico completo é uma propriedade do modelo, não uma feature extra.

## 8. Fora de escopo

- Visão do colaborador sobre seu próprio PDI/avaliação/trilha — só o gestor acessa, nesta versão.
- Vínculo formal gestor→liderado ("minha equipe") — gestor vê todos os colaboradores, igual `/colaboradores` hoje.
- Autoavaliação e avaliação por pares (360° completo) — só avaliação do gestor.
- Catálogo fixo de requisitos de trilha por cargo/nível — cadastro livre por colaborador.
- Estrutura formal de OKR (Key Results mensuráveis com progresso percentual) — metas são lista simples com status.
- Cálculo automático do eixo "potencial" do Nine Box — sempre manual.
- Campo/config para tornar o "tempo mínimo de 3 meses" ajustável — fixo no código.
- Rastreamento de data de início por cargo/nível separado de `hireDate` (ex: quando o colaborador foi promovido pela última vez).
- Notificações (ex: lembrete de 1:1 atrasado, aviso de "ficou verde") — nenhum produtor novo na tabela `Notification` nesta versão.
