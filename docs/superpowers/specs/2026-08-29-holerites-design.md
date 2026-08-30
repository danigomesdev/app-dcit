# Holerites — cadastro de gestor/RH — Ponto DCIT

**Status:** Aprovado para implementação
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)

## 1. Objetivo e escopo

O modelo `Payslip` (`apps/api/prisma/schema.prisma`) já existe com o breakdown completo de um holerite (bruto, INSS, IRRF, benefícios), e o colaborador já tem uma tela de autoatendimento no mobile (`fetchPayslips`, via `GET /documentos/holerites`) para ver os próprios holerites. Mas não existe nenhum jeito de criar um `Payslip` — não há endpoint de escrita, não há seed, não há tela em lugar nenhum. Na prática, a tela mobile está sempre vazia: o ciclo self-service existe só pela metade.

Esta spec fecha esse ciclo dando a gestor/RH um cadastro de holerites — criar, editar e excluir — igual em espírito ao que já existe para Convenções coletivas.

Fora de escopo (seção 8 tem a lista completa): geração automática de holerite a partir de folha de pagamento, upload de PDF do holerite real, e os outros três buracos do mesmo tipo encontrados durante o levantamento desta spec (Mural sem criação de post, Benefícios sem crédito de saldo/cadastro de parceiro, Onboarding sem edição da lista de tarefas) — cada um fica registrado como pendência própria, decidida separadamente.

## 2. Modelo de dados

Nenhuma mudança. `Payslip` já tem tudo que este cadastro precisa:

```prisma
model Payslip {
  id       String @id @default(uuid())
  userId   String
  label    String
  gross    Float
  inss     Float
  irrf     Float
  benefits Float
}
```

`label` continua um campo de texto livre (ex: "Agosto/2026", "13º salário") — sem campo de competência estruturado, sem unicidade por período. RH digita do jeito que quiser; a lista ordena por `id` de criação (não há `createdAt` no modelo hoje, e adicionar um está fora do escopo mínimo desta spec — a ordem de inserção via `findMany` sem `orderBy` explícito já reflete a ordem de criação no SQLite usado neste projeto).

## 3. `packages/shared-types`

Novo arquivo `payslip.ts`:

```typescript
import { z } from "zod";

export const PayslipInputSchema = z.object({
  userId: z.string().min(1),
  label: z.string().min(1),
  // z.coerce.number() (não z.number()): o formulário web manda esses campos
  // via FormData → Server Action → JSON.stringify, chegam como string —
  // mesmo raciocínio de salarioMensal em convencao.ts / employee-create.ts.
  gross: z.coerce.number().nonnegative(),
  inss: z.coerce.number().nonnegative(),
  irrf: z.coerce.number().nonnegative(),
  benefits: z.coerce.number().nonnegative(),
});
export type PayslipInput = z.infer<typeof PayslipInputSchema>;

// Sem userId: um holerite não muda de dono depois de criado.
export const PayslipUpdateSchema = PayslipInputSchema.omit({ userId: true });
export type PayslipUpdate = z.infer<typeof PayslipUpdateSchema>;
```

Ambos exportados de `index.ts`.

## 4. Backend (`apps/api/src/documentos`)

Estende o módulo existente (mesmo módulo que já hospeda `AdmissionDocument`/`Certification`) — não é um módulo novo.

### 4.1 `DocumentosService` — três métodos novos

```typescript
createPayslip(input: PayslipInput) {
  return this.prisma.payslip.create({ data: input });
}

updatePayslip(id: string, input: PayslipUpdate) {
  return this.prisma.payslip.update({ where: { id }, data: input });
}

// Idempotente — chamar duas vezes com o mesmo id não lança erro, mesmo
// padrão já usado em ConvencoesService.delete e em deleteShift.
deletePayslip(id: string) {
  return this.prisma.payslip.deleteMany({ where: { id } });
}

async listAllPayslips() {
  const payslips = await this.prisma.payslip.findMany();
  return this.withRequesterNames(payslips);
}
```

`listAllPayslips` reaproveita o `withRequesterNames` privado que já existe no service (usado por `listAllAdmissionDocuments`/`listAllCertifications`) — nenhuma duplicação de lógica de join.

### 4.2 `DocumentosController` — quatro rotas novas

- `POST /documentos/holerites` — `AuthGuard, RolesGuard`, `@Roles('gestor', 'rh')`, body validado por `PayslipInputSchema`.
- `GET /documentos/holerites/equipe` — `AuthGuard, RolesGuard`, `@Roles('gestor', 'rh')`.
- `PATCH /documentos/holerites/:id` — `AuthGuard, RolesGuard`, `@Roles('gestor', 'rh')`, body validado por `PayslipUpdateSchema`.
- `DELETE /documentos/holerites/:id` — `AuthGuard, RolesGuard`, `@Roles('gestor', 'rh')`, `@HttpCode(204)`.

O `GET /documentos/holerites` existente (autoatendimento, qualquer usuário autenticado) não muda.

Gestor e RH têm o mesmo nível de acesso aqui — decisão de produto tomada nesta spec, já que o `salarioMensal` do colaborador (dado de sensibilidade parecida) também é visível/editável por gestor+RH em Colaboradores.

## 5. Web (`apps/web`)

### 5.1 Nova página `/holerites` (gestão, gestor+RH)

Não entra na página `/documentos` existente — aquela é só leitura, agregando o que o colaborador já enviou pelo mobile; aqui é o gestor/RH que *cria* o dado, então o padrão certo é o de Convenções (lista + diálogo de criação + editar/excluir por linha via Server Actions), não o de Documentos.

- Novo item em `apps/web/src/components/nav-links.tsx`: `{ href: "/holerites", label: "Holerites" }`, depois de "Banco de Horas".
- Gate de RBAC: `session.role === "colaborador"` → `EmptyState` "Sem permissão" (mesmo padrão de Colaboradores/Escala — gestor+rh, não RH-only).
- Busca `GET /holerites/equipe` e `GET /employees` em paralelo (mesmo padrão do `/escala`, que já busca `/employees` pra popular um `<select>`).
- Lista cada holerite (nome do colaborador, rótulo, bruto/INSS/IRRF/benefícios formatados em R$), com:
  - Diálogo "Novo holerite" — `<select>` de colaborador (via `/employees`) + campos numéricos.
  - Botão "Editar" por linha, abrindo diálogo preenchido (sem o seletor de colaborador — não muda de dono).
  - Botão "Excluir" com confirmação.

Arquivos (mirror exato da estrutura de `apps/web/src/app/(app)/convencoes`):
- `page.tsx`, `holerites.module.css`
- `actions.ts` (`createPayslip`, `updatePayslip`, `deletePayslip` — Server Actions chamando a API)
- `holerite-form-fields.tsx`, `novo-holerite-dialog.tsx`, `editar-holerite-dialog.tsx`, `holerites-row.tsx`

### 5.2 Sem mudança em `/documentos` nem em `/colaboradores`

O holerite não aparece na página Documentos (que é só atestados/admissionais/certificações) nem precisa de campo novo no cadastro de colaborador — é uma tela própria.

## 6. Mobile (`apps/mobile`)

Nenhuma mudança de código. A tela de autoatendimento (`fetchPayslips` → `/documentos/holerites`) já existe e já está correta; ela simplesmente passa a mostrar dado de verdade assim que gestor/RH cadastrarem o primeiro holerite pela web.

## 7. Testes

Mesmo padrão já estabelecido nas specs anteriores desta sessão:

- **`shared-types`**: `PayslipInputSchema` (aceita payload válido; rejeita valores negativos em qualquer campo monetário; rejeita `userId`/`label` vazio) e `PayslipUpdateSchema` (mesmas validações, sem `userId`).
- **API**: Jest cobrindo `DocumentosService` (CRUD de holerite + `listAllPayslips` traz `userName`) e `DocumentosController` (guard metadata: as quatro rotas novas exigem `AuthGuard`+`RolesGuard` com `@Roles('gestor', 'rh')`; a rota de autoatendimento existente continua só com `AuthGuard`).
- **Web**: Playwright via `fake-api-server.mjs` estendido pra servir `/holerites/equipe` (`GET`/`POST`/`PATCH`/`DELETE`) — cobre RBAC (bloqueado só pra colaborador), CRUD completo (criar, editar, excluir com confirmação), e o nav item novo no `app-shell.spec.ts`.
- **Mobile**: nenhum teste novo (sem mudança de código).

## 8. Fora de escopo

- Geração automática de holerite a partir de integração de folha de pagamento — isso é o item "Integrações avançadas (folha de pagamento...)" da Fase 3 do roadmap original, continua fora.
- Upload/anexo de PDF do holerite real — o cadastro é só os quatro valores numéricos + rótulo, não um documento.
- Campo de competência estruturado (mês/ano) e unicidade por período — `label` continua texto livre, decisão tomada nesta spec.
- Histórico/auditoria de edição — editar um holerite sobrescreve os valores anteriores, sem log de "valor era X antes de Y" (mesma decisão já tomada para convenção/salário).
- Os outros três buracos do mesmo tipo encontrados durante o levantamento (Mural sem criação de post, Benefícios sem crédito de saldo/cadastro de parceiro, Onboarding sem edição da lista de tarefas) — ficam como pendências registradas, fora desta spec, para decisão separada.
