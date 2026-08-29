# Convenções Coletivas e Dados de Jornada/Salário — Ponto DCIT

**Status:** Aprovado para implementação
**Spec funcional de referência:** [`docs/spec-funcional.md`](../../spec-funcional.md) (v2), seção 7 ("CLT — cálculo de horas extras, DSR e banco de horas: as regras de cálculo devem ser parametrizáveis por convenção coletiva/acordo da empresa, incluindo variações por CNPJ e categoria sindical") e seção 6 ("parametrização de regras por CNPJ, convenção coletiva e feriados regionais")
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)
**Spec relacionada (depende desta):** Banco de horas real — spec separada, ainda não escrita. Esta spec entrega só os dados-base (convenções + salário/vínculo no colaborador); o motor de cálculo de banco de horas consome esses dados numa spec seguinte.

## 1. Objetivo e escopo

Hoje o app não tem nenhum conceito de convenção coletiva, CNPJ ou categoria sindical — o "banco de horas" do mobile (`apps/mobile/src/lib/banco-de-horas.ts`) usa uma jornada esperada e um valor de hora fixos no código (`EXPECTED_MINUTES_WEEKDAY = 8h`, `HOURLY_RATE_BRL = 35`), iguais para todo mundo. Esta spec entrega o cadastro-base necessário para variar essas regras por grupo de colaboradores:

- **Convenção coletiva**: um registro reutilizável (nome, CNPJ, categoria sindical, jornada esperada por dia, percentual de hora extra), cadastrado por RH e aplicado a vários colaboradores — como uma convenção real, negociada por categoria/sindicato, não por pessoa.
- **Colaborador** ganha `salarioMensal` (para calcular o valor-hora depois) e um vínculo opcional a uma `ConvencaoColetiva`.

Fora de escopo (seção 8 tem a lista completa): o cálculo do banco de horas em si (horas extras, DSR, saldo) — isso é a próxima spec, que consome os dados daqui.

## 2. Modelo de dados (`apps/api/prisma/schema.prisma`)

```prisma
model ConvencaoColetiva {
  id                   String   @id @default(uuid())
  nome                 String
  cnpj                 String?
  categoriaSindical    String?
  expectedDailyMinutes Int      // jornada esperada por dia, em minutos (ex: 480 = 8h)
  overtimePercent      Float    // percentual de acréscimo da hora extra, ex: 50 = 50%
  createdAt            DateTime @default(now())
}
```

`Employee` ganha dois campos novos (mesmo padrão de `cargo`/`nivel` — campo solto, sem `@relation` do Prisma, seguindo a convenção já usada em todo o schema de referenciar por id puro e juntar manualmente na camada de serviço, como `TimeEntry.userId` já faz):

```prisma
  convencaoId   String?  // id de ConvencaoColetiva, sem FK — resolvido na camada de serviço
  salarioMensal Float?   // R$, mesma visibilidade de cpf/rg (RH e gestor)
```

## 3. `packages/shared-types`

Novo arquivo `convencao.ts`:

```typescript
import { z } from "zod";

export const ConvencaoInputSchema = z.object({
  nome: z.string().min(1),
  cnpj: z.string().min(1).nullable(),
  categoriaSindical: z.string().min(1).nullable(),
  // z.coerce (não z.number()): o formulário web manda esses campos via
  // FormData → Server Action → JSON.stringify, então chegam como string
  // ("480", não 480) — mesmo raciocínio do salarioMensal abaixo.
  expectedDailyMinutes: z.coerce.number().int().positive(),
  overtimePercent: z.coerce.number().nonnegative(),
});
export type ConvencaoInput = z.infer<typeof ConvencaoInputSchema>;
```

`packages/shared-types/src/employee-create.ts`: `EmployeeCreateSchema` ganha dois campos, mesmo padrão de `cargo`/`nivel`:

```typescript
  convencaoId: z.string().nullable(),
  // z.coerce.number() (não z.number()): o formulário de colaborador
  // reaproveita o mesmo array OPTIONAL_FIELDS que já monta o payload como
  // string a partir de FormData (apps/web/src/app/(app)/colaboradores/actions.ts)
  // — sem coerção, um salário "5000.50" (string) falharia a validação de
  // z.number(). nullable() intercepta null antes de tentar coagir, então o
  // caso "campo vazio" continua funcionando normalmente.
  salarioMensal: z.coerce.number().nonnegative().nullable(),
```

Ambos exportados de `index.ts`, junto com os demais schemas.

## 4. Backend (`apps/api`)

### 4.1 Novo módulo `apps/api/src/convencoes`

`ConvencoesService`:
- `list()`: `prisma.convencaoColetiva.findMany({ orderBy: { nome: 'asc' } })`.
- `create(input: ConvencaoInput)`: `prisma.convencaoColetiva.create({ data: input })`.
- `update(id: string, input: ConvencaoInput)`: `prisma.convencaoColetiva.update({ where: { id }, data: input })`.
- `delete(id: string)`: `prisma.convencaoColetiva.delete({ where: { id } })`. Sem checagem de uso — um colaborador cujo `convencaoId` aponta pra uma convenção excluída fica, na prática, "sem convenção" (a spec do banco de horas trata `convencaoId` não resolvível como "usa jornada padrão", igual a `convencaoId: null` — ver seção 8).

`ConvencoesController`:
- `GET /convencoes` — `AuthGuard, RolesGuard`, `@Roles('gestor', 'rh')` — leitura liberada pro gestor porque o formulário de cadastro de colaborador (gestor+rh, já implementado) precisa listar as convenções pra popular o `<select>`.
- `POST /convencoes` — `AuthGuard, RolesGuard`, `@Roles('rh')` — só RH cria/edita/exclui convenções (é decisão de RH/jurídico, não operacional de gestor).
- `PATCH /convencoes/:id` — `AuthGuard, RolesGuard`, `@Roles('rh')`.
- `DELETE /convencoes/:id` — `AuthGuard, RolesGuard`, `@Roles('rh')`, `HttpCode(204)`.

Body de `POST`/`PATCH` validado por `ConvencaoInputSchema`.

`ConvencoesModule`: `imports: [AuthModule]`, `controllers: [ConvencoesController]`, `providers: [ConvencoesService]`. Registrado em `app.module.ts`.

### 4.2 `apps/api/src/employees` (estende o módulo existente)

`EmployeesService.create`/`updatePersonalData` passam a persistir `convencaoId` e `salarioMensal`, mesmo padrão de `cargo`/`nivel` (adiciona aos dois blocos `data: {...}` de `create`/`updatePersonalData`, sem lógica nova).

## 5. Web (`apps/web`)

### 5.1 Nova página `/convencoes` (gestão, RH-only)

- Novo item em `apps/web/src/components/nav-links.tsx`: `{ href: "/convencoes", label: "Convenções" }`, depois de "Alertas".
- Gate de RBAC **mais restrito** que as outras páginas administrativas: `session.role !== "rh"` (não `=== "colaborador"`) → `EmptyState` "Sem permissão", "Esta página é restrita ao RH." — diferente de Colaboradores/Escala/Alertas (gestor+rh), porque gerir convenção é decisão de RH, não operacional.
- Lista as convenções (nome, CNPJ, categoria sindical, jornada esperada formatada em horas, percentual de hora extra), com um dialog "Nova convenção" (criar) e um botão "Editar"/"Excluir" por linha — mesmo padrão visual e de interação (dialogs, Server Actions, `revalidatePath`) já usado em Colaboradores/Escala.

### 5.2 Cadastro de colaborador ganha dois campos

`apps/web/src/app/(app)/colaboradores/page.tsx` passa a buscar `GET /convencoes` em paralelo com `GET /employees` (mesmo padrão do `GET /employees` que `escala/page.tsx` já busca pra popular um `<select>`), e repassa a lista pras duas telas de formulário (`NovoColaboradorDialog`, `EditarColaboradorDialog` → `ColaboradorFormFields`) via uma nova prop `convencoes: { id: string; nome: string }[]`.

`colaborador-form-fields.tsx` ganha, logo depois do campo "Nível":
- `<select name="convencaoId">` com as convenções recebidas via prop (não é mais uma lista fixa local como `CARGOS`/`NIVEIS` — vem do banco, então é passada de fora, com opção "—" pra "sem convenção").
- `<input type="number" name="salarioMensal">` ("Salário mensal", `step="0.01"`, `min="0"`, opcional).

`ColaboradorFormDefaults` ganha `convencaoId: string | null` e `salarioMensal: number | null`. `employee-optional-fields.ts` ganha `"convencaoId"` e `"salarioMensal"` no array `OPTIONAL_FIELDS` (o mesmo array que já dirige `actions.ts` a incluir esses campos no payload automaticamente).

## 6. Mobile (`apps/mobile`)

Sem mudanças nesta spec — a tela de banco de horas do mobile continua com os valores mockados até a spec seguinte (banco de horas real) substituí-los.

## 7. Testes

Mesmo padrão já estabelecido nas specs anteriores desta sessão:

- **`shared-types`**: teste de `ConvencaoInputSchema` (aceita payload válido; rejeita `expectedDailyMinutes` zero/negativo; rejeita `overtimePercent` negativo; aceita `cnpj`/`categoriaSindical` null). `employee-create.test.ts` ganha `convencaoId`/`salarioMensal` no `VALID_PAYLOAD` e no teste "aceita todo campo pessoal como null".
- **API**: Jest cobrindo `ConvencoesService` (CRUD básico), `ConvencoesController` (guard metadata: `GET` gestor/rh; `POST`/`PATCH`/`DELETE` só rh), e `EmployeesService`/`EmployeesController` (os dois campos novos persistem e voltam no `create`/`updatePersonalData` — mesmo padrão dos testes de `cargo`/`nivel`).
- **Web**: Playwright via `fake-api-server.mjs` estendido pra servir `/convencoes` (`GET`/`POST`/`PATCH`/`DELETE`) — cobre RBAC (`/convencoes` bloqueada pra gestor, não só colaborador), CRUD de convenção, e o formulário de colaborador aceitando os dois campos novos.
- **Mobile**: nenhum teste novo (sem mudança de código).

## 8. Fora de escopo (referência para o plano de implementação)

- Cálculo de banco de horas (horas extras, DSR, saldo) usando esses dados — spec separada, "Banco de Horas Real", ainda a escrever.
- Feriados regionais (mencionado na spec funcional, mas é outro subsistema — calendário de feriados por região/CNPJ).
- Hora extra diferenciada por domingo/feriado (só um percentual único por convenção).
- Integridade referencial ao excluir uma convenção em uso — o colaborador fica "sem convenção" (comportamento igual a nunca ter tido uma), sem aviso nem bloqueio de exclusão.
- Múltiplas empresas reais — `cnpj` é só um campo de texto informativo na convenção, não um sistema multi-tenant.
- Histórico/auditoria de mudança de salário ou de convenção — só o valor atual é guardado, sem log de "salário era X antes de Y".
- Qualquer tela de folha de pagamento ou integração de RH — isso é o item "Integrações avançadas (folha de pagamento...)" da Fase 3 do roadmap original, continua fora.
