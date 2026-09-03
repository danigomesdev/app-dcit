# Horas (Trabalhadas vs. Lançadas em Tickets)

**Status:** Proposto
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)

## 1. Objetivo e escopo

Novo item de menu **apenas para o gestor** — "Horas" — para conferir, por colaborador, duas quantidades que hoje só existem fora do ponto-dcit: quantas horas o colaborador de fato trabalhou num período, e quantas horas ele lançou em tickets na ferramenta interna da empresa (Movidesk ou equivalente). Não é um conceito de "meta"/alvo de jornada — são duas métricas reais, lado a lado, para o gestor perceber divergências (ex: trabalhou 8h mas só lançou 2h em tickets).

Decisões de escopo fechadas em conversa antes deste documento:

- **Apenas `gestor`, não `rh`, não `colaborador`.** Mesma decisão já usada em Gestão de Carreiras — RBAC (backend e frontend) usa só `@Roles('gestor')`.
- **As duas métricas são lançadas manualmente pelo gestor nesta versão.** Não há integração com Movidesk (nem qualquer outra ferramenta) agora — o gestor confere os números na ferramenta externa e digita os dois valores no ponto-dcit. **Explicitamente fora de escopo agora, mas desejado para o futuro**: puxar "horas lançadas em tickets" automaticamente via API do Movidesk — o modelo de dados abaixo foi pensado para não precisar de migração de schema quando essa integração vier (§7).
- **Não é meta vs. realizado.** As duas quantidades (`horasTrabalhadas`, `horasTickets`) são igualmente "realizado" — nenhuma delas é um alvo. O gráfico as compara lado a lado, sem julgar qual "deveria" ser maior.
- **Um lançamento por colaborador por dia**, cobrindo as duas métricas juntas num único formulário (o gestor confere os dois números na mesma hora, faz sentido lançar juntos). Lançar de novo no mesmo dia **atualiza** o valor existente, não duplica.
- **Sem vínculo formal gestor→liderado** — mesma limitação já documentada em Ponto Perdido e Gestão de Carreiras. O gestor lança/vê para **todos os colaboradores ativos da empresa**, igual `/colaboradores` hoje.
- **Três granularidades de visualização — Dia / Semana / Mês — mudam apenas qual janela de datas é somada**, mantendo sempre o mesmo formato de gráfico (uma barra por colaborador). Não são duas telas diferentes.

## 2. Modelo de dados (`apps/api/prisma/schema.prisma`)

Seguindo a convenção já estabelecida no schema inteiro: nenhum `@relation`/FK do Prisma — toda referência cruzada é um `String` solto, resolvido manualmente na camada de serviço.

```prisma
model WorkedHoursEntry {
  id               String   @id @default(uuid())
  userId           String   // colaborador a quem o lançamento se refere
  gestorId         String   // gestor que lançou — sempre da sessão autenticada, nunca do body
  date             DateTime // dia do lançamento, data-only (meia-noite UTC) — mesma convenção de VacationRequest.startDate
  horasTrabalhadas Float    // horas de fato trabalhadas naquele dia
  horasTickets     Float    // horas lançadas em tickets na ferramenta interna (hoje: Movidesk, conferido manualmente)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([userId, date])
}
```

`@@unique([userId, date])` é o que dá o upsert "um lançamento por colaborador por dia" de graça — o service faz `prisma.workedHoursEntry.upsert` por essa chave composta, sem precisar checar existência manualmente antes.

## 3. Backend (`apps/api/src/horas/`)

Módulo novo e independente (não faz parte de `carreira/` — é um domínio diferente, mesmo sendo gestor-only), `HorasModule` com um controller/service:

- `horas.controller.ts` / `horas.service.ts` — todos os endpoints com `@UseGuards(AuthGuard, RolesGuard) @Roles('gestor')`:
  - `POST /horas` — lança/atualiza um dia: `{ userId, date, horasTrabalhadas, horasTickets }` → upsert por `(userId, date)`. `gestorId` vem de `req.user.sub`, nunca do body.
  - `GET /horas/resumo?periodo=dia|semana|mes` — para **todos os colaboradores ativos**, soma `horasTrabalhadas` e `horasTickets` de `WorkedHoursEntry` dentro da janela de datas resolvida a partir de `periodo` (ver §5). Colaborador sem nenhum lançamento no período entra com `0`/`0` (não é omitido) — o gráfico sempre mostra a equipe inteira.
  - `GET /horas?userId=&periodo=` — lista os lançamentos individuais (por dia) de um colaborador dentro do período, para o gestor conferir/corrigir o que já foi digitado.
  - `DELETE /horas/:id` — remove um lançamento (correção de erro de digitação).

### 3.1 Validação (`packages/shared-types/src/horas.ts`, novo)

```typescript
import { z } from "zod";

export const PERIODOS_HORAS = ["dia", "semana", "mes"] as const;

export const WorkedHoursEntryCreateSchema = z.object({
  userId: z.string().min(1),
  date: z.string().datetime(),
  horasTrabalhadas: z.number().min(0),
  horasTickets: z.number().min(0),
});

export type WorkedHoursEntryCreateInput = z.infer<typeof WorkedHoursEntryCreateSchema>;
```

## 4. Frontend (`apps/web`)

### 4.1 Sidebar

`apps/web/src/lib/nav-sections.ts` — nova entrada em `NAV_SECTIONS`, papel só `gestor` (flat, sem sub-itens — diferente de Gestão de Carreiras, esta tela não tem sub-rotas, os períodos são tabs dentro da própria página, igual Banco de Horas):

```typescript
{ href: "/horas", label: "Horas", roles: ["gestor"] },
```

`rh` e `colaborador` nunca veem este item (comparar com `banco-de-horas`, que é `["gestor", "rh", "colaborador"]` — este é deliberadamente mais restrito).

### 4.2 Página (`apps/web/src/app/(app)/horas/`)

- `page.tsx` — Server Component. Guarda `session.role !== "gestor"` → `<EmptyState>`. Lê `?periodo=` (default `"mes"`, mesmo padrão de tabs por query param de Banco de Horas). Busca `GET /horas/resumo?periodo=` e `GET /employees` em paralelo. Renderiza:
  - Tabs Dia / Semana / Mês (`?periodo=dia|semana|mes`, mesmo componente visual `periodTab`/`periodTabActive` já usado em Banco de Horas).
  - `HorasChart` — gráfico de barras (uma barra `horasTrabalhadas` + uma linha `horasTickets` conectando os colaboradores), construído em SVG/CSS próprio (sem nova dependência — mesmo approach usado na Matriz Nine Box de Gestão de Carreiras). Paleta e legibilidade seguindo a skill `dataviz` deste projeto.
  - `LancarHorasForm` — colaborador (select) + data + horas trabalhadas + horas em tickets → Server Action `lancarHoras`, `revalidatePath("/horas")`.
  - `HistoricoColaboradorSection` — ao selecionar um colaborador no formulário, lista os lançamentos dele no período corrente com botão de excluir (`DELETE /horas/:id`).
- `actions.ts` — `lancarHoras` (POST /horas) e `excluirLancamento` (DELETE /horas/:id), cada uma com `revalidatePath("/horas")`.

## 5. Regra de negócio: resolução do período

Roda em `HorasService`, reaproveitando `apps/api/src/common/sao-paulo-time.ts` (mesmas funções já usadas por Operacional/Alertas/Ponto Perdido — evita repetir os bugs de fuso horário já documentados nesses módulos):

- **dia** → hoje (`todaySaoPauloDateOnly()`), início = fim = hoje.
- **semana** → segunda a domingo da semana que contém hoje (segunda-feira como primeiro dia — convenção adotada; ajustável depois se o gestor preferir domingo-sábado).
- **mes** → dia 1 ao último dia do mês corrente que contém hoje.

Em todos os casos, o resumo soma apenas os `WorkedHoursEntry.date` dentro do intervalo `[início, fim]`, por `userId`.

## 6. Testes

- `horas.service.spec.ts` (novo):
  - lançar duas vezes o mesmo `(userId, date)` atualiza o registro existente, não cria um segundo;
  - resumo do período soma corretamente `horasTrabalhadas` e `horasTickets` por colaborador, ignorando lançamentos fora da janela;
  - colaborador ativo sem nenhum lançamento no período aparece no resumo com `0`/`0`, não é omitido;
  - resolução de período: "dia" cobre só hoje; "semana" cobre segunda a domingo corrente (caso de borda: hoje é domingo); "mês" cobre do dia 1 ao último dia (caso de borda: mês com 28/30/31 dias).
- `horas.controller.spec.ts` (novo) — `RolesGuard` rejeita `colaborador` e `rh` com 403 nos 4 endpoints.
- `apps/web`: e2e básico (novo `horas.spec.ts`) — gestor lança horas de um colaborador, resumo/gráfico refletem o valor; troca de aba dia/semana/mês não quebra; `rh` e `colaborador` não veem "Horas" na sidebar e recebem `EmptyState` ao acessar `/horas` diretamente.

## 7. Global Constraints

- RBAC é `@Roles('gestor')` em todos os endpoints — nunca inclui `'rh'` nem `'colaborador'`, mesma decisão explícita de Gestão de Carreiras.
- Nenhum novo `@relation`/FK do Prisma — `userId`/`gestorId` são `String` soltos resolvidos no service.
- `gestorId` sempre vem da sessão autenticada (`request.user.sub`), nunca do body.
- `horasTickets` é 100% lançamento manual nesta versão — nenhuma chamada a API externa (Movidesk ou qualquer outra) acontece agora. O campo já está modelado (nome genérico, sem acoplamento a um formato específico do Movidesk) para que uma futura integração automática possa escrever nesse mesmo campo sem migração de schema — mas construir essa integração está fora de escopo deste documento.
- Gráfico sempre mostra todos os colaboradores ativos do período (mesma fonte `GET /employees` de Gestão de Carreiras/Colaboradores), mesmo com valores zerados — nunca omite quem não lançou nada.
- Sem lógica de alerta/flag automática comparando as duas métricas — só exibição lado a lado (ver §8).

## 8. Fora de escopo

- Integração automática com Movidesk (ou qualquer ferramenta externa) via API — desejada para o futuro, não nesta versão.
- Qualquer conceito de meta/alvo de horas — as duas métricas exibidas são ambas "realizado".
- Cálculo automático de divergência entre as duas métricas (ex: alerta se `horasTickets` muito menor que `horasTrabalhadas`) — só exibição lado a lado.
- Acesso de RH ou colaborador a esta tela, em qualquer nível (nem leitura).
- Lançamento em lote (múltiplos colaboradores/dias numa única submissão) — sempre um colaborador + um dia por vez.
- Configuração de início de semana (segunda vs. domingo) — fixo no código como segunda a domingo.
