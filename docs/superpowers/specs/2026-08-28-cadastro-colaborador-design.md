# Cadastro de Colaborador — Ponto DCIT

**Status:** Implementado
**Spec funcional de referência:** [`docs/spec-funcional.md`](../../spec-funcional.md) (v2) — não cobre cadastro de colaborador diretamente; esta spec preenche uma lacuna operacional identificada durante o uso do painel de presença (não havia como criar um `Employee` pela aplicação, só via seed).
**Spec relacionada:** [`docs/superpowers/specs/2026-08-28-mapa-de-presenca-design.md`](2026-08-28-mapa-de-presenca-design.md) — introduziu a tela `/colaboradores` (RH) que esta spec estende.

## 1. Objetivo e escopo

Hoje não existe nenhum caminho, dentro da aplicação, para criar um `Employee` — a única forma é o script de seed (`apps/api/prisma/seed.ts`), que insere 3 contas fixas de desenvolvimento. `Employee.userId` é hoje o mesmo `sub` usado no login (OIDC), mas sem nenhuma restrição de banco que force essa igualdade.

Esta spec adiciona:
- Um ícone "+" em `/colaboradores` que abre um diálogo de cadastro completo (nome, cargo, data de admissão, e dados pessoais: CPF, RG, data de nascimento, estado civil, endereço).
- Um novo endpoint `POST /employees` (RH) que gera um `userId` aleatório no servidor e cria o registro — **decisão confirmada com o usuário:** o cadastro não fica vinculado a nenhuma conta de login existente; é um registro de RH independente. Reconciliar esse registro com um login real de SSO no futuro (se a pessoa cadastrada vier a ter acesso ao sistema) fica fora do escopo — ver seção 12.
- Novos campos pessoais no modelo `Employee`, todos opcionais (nome/cargo/admissão continuam obrigatórios, como já são hoje).

**Decisão confirmada:** os novos dados pessoais (CPF, RG, nascimento, estado civil, endereço) **não são mascarados** para gestor — `GET /employees` retorna tudo igual para gestor e RH. Isso é diferente do padrão de mascaramento usado em `atestados` (CID/médico/CRM só para RH); aqui foi uma escolha explícita do usuário, registrada para não ser "corrigida" por engano numa iteração futura.

## 2. Modelo de dados (`apps/api/prisma/schema.prisma`)

```prisma
model Employee {
  userId            String   @id
  name              String
  role              String
  hireDate          DateTime
  expectedStartTime String?  // "HH:mm", 24h, América/São_Paulo. null = never "atrasado".
  cpf               String?  @unique // 11 dígitos, sem pontuação
  rg                String?
  dataNascimento    DateTime?
  estadoCivil       String?  // "solteiro" | "casado" | "divorciado" | "viuvo" | "uniao_estavel"
  enderecoRua       String?
  enderecoNumero    String?
  enderecoBairro    String?
  enderecoCidade    String?
  enderecoEstado    String?  // UF, 2 letras
  enderecoCep       String?  // 8 dígitos, sem hífen
  deletedAt         DateTime? // null = ativo. Não-nulo = na lixeira.
}
```

Migração Prisma adiciona as 11 colunas (todas nullable, sem default) e o índice único em `cpf`. Colaboradores existentes (já seedados) ficam com todos os campos novos `null` (ativos).

## 3. `packages/shared-types`

Novo arquivo `employee-create.ts`:

```typescript
import { z } from "zod";

import { RoleSchema } from "./role";

export const ESTADOS_CIVIS = [
  "solteiro",
  "casado",
  "divorciado",
  "viuvo",
  "uniao_estavel",
] as const;

// As 27 UFs do Brasil — lista fixa, mesmo raciocínio de ESTADOS_CIVIS (evitar
// dado sujo; "ZZ" não deve ser um estado válido).
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const;

export const EmployeeCreateSchema = z.object({
  name: z.string().min(1),
  role: RoleSchema,
  hireDate: z.string().date(),
  cpf: z.string().regex(/^\d{11}$/).nullable(),
  rg: z.string().min(1).nullable(),
  dataNascimento: z.string().date().nullable(),
  estadoCivil: z.enum(ESTADOS_CIVIS).nullable(),
  enderecoRua: z.string().min(1).nullable(),
  enderecoNumero: z.string().min(1).nullable(),
  enderecoBairro: z.string().min(1).nullable(),
  enderecoCidade: z.string().min(1).nullable(),
  enderecoEstado: z.enum(UFS).nullable(),
  enderecoCep: z.string().regex(/^\d{8}$/).nullable(),
});
export type EmployeeCreateInput = z.infer<typeof EmployeeCreateSchema>;
```

CPF e CEP são validados só por formato (11 e 8 dígitos, sem pontuação) — sem algoritmo de dígito verificador de CPF, consistente com o nível de validação já usado no resto do app (ex: `HH:mm` de `EmployeeScheduleUpdateSchema`). `hireDate`/`dataNascimento` seguem o mesmo `z.string().date()` já usado em `VacationRequestInputSchema`/`EscalaShiftInputSchema` (data sem hora, `"YYYY-MM-DD"`).

Exportado de `index.ts`: `EmployeeCreateSchema`, `EmployeeCreateInput`, `ESTADOS_CIVIS`, `UFS`.

## 4. Backend (`apps/api`)

### 4.1 `apps/api/src/employees/employees.service.ts`

```typescript
import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EmployeeCreateInput, EmployeeScheduleUpdate } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.employee.findMany({
      orderBy: { name: 'asc' },
    }); // sem select explícito: já retorna todos os campos, incluindo os novos
  }

  updateSchedule(userId: string, input: EmployeeScheduleUpdate) {
    return this.prisma.employee.update({
      where: { userId },
      data: { expectedStartTime: input.expectedStartTime },
    });
  }

  async create(input: EmployeeCreateInput) {
    try {
      return await this.prisma.employee.create({
        data: {
          userId: randomUUID(),
          name: input.name,
          role: input.role,
          hireDate: new Date(input.hireDate),
          cpf: input.cpf,
          rg: input.rg,
          dataNascimento: input.dataNascimento ? new Date(input.dataNascimento) : null,
          estadoCivil: input.estadoCivil,
          enderecoRua: input.enderecoRua,
          enderecoNumero: input.enderecoNumero,
          enderecoBairro: input.enderecoBairro,
          enderecoCidade: input.enderecoCidade,
          enderecoEstado: input.enderecoEstado,
          enderecoCep: input.enderecoCep,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe um colaborador cadastrado com esse CPF.');
      }
      throw error;
    }
  }
}
```

`list()` perde o `select` explícito — a lista de campos selecionados manualmente (`userId, name, expectedStartTime`) ficaria desatualizada a cada novo campo pessoal adicionado; retornar o registro completo é mais simples e já é o padrão usado em outros `findMany` do app (ex: `TimeEntriesService.listTeamToday`'s `employees.findMany` sem select).

`create()` segue exatamente o padrão try/catch de `OperacionalService.createShift` (já existente em `apps/api/src/operacional/operacional.service.ts:139-159`) para traduzir a violação de unicidade do Prisma (`P2002`) em `ConflictException` (409) com mensagem amigável.

### 4.2 `apps/api/src/employees/employees.controller.ts`

Adiciona:

```typescript
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown) {
    const result = EmployeeCreateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.employees.create(result.data);
  }
```

(imports `Post`, `HttpCode` de `@nestjs/common` e `EmployeeCreateSchema` de `@ponto-dcit/shared-types`, adicionados aos já existentes). Mesma role (`rh`) do `PATCH` já existente — cadastro é ação de RH, igual edição de horário.

### 4.3 Exclusão lógica (lixeira)

**Decisão confirmada:** excluir um colaborador é sempre uma exclusão lógica (marca `deletedAt`) — ele some das listas de colaboradores ativos até ser restaurado ou apagado de vez pela lixeira.

**Endpoints novos em `EmployeesController`** (todos `@Roles('rh')`):

```typescript
@Get('trash')
listTrash() {
  return this.employees.listTrash();
}

@Delete(':userId')
@HttpCode(204)
async softDelete(@Param('userId') userId: string) {
  await this.employees.softDelete(userId);
}

@Patch(':userId/restore')
restore(@Param('userId') userId: string) {
  return this.employees.restore(userId);
}

@Delete(':userId/permanent')
@HttpCode(204)
async permanentlyDelete(@Param('userId') userId: string) {
  await this.employees.permanentlyDelete(userId);
}
```

**Métodos novos em `EmployeesService`:**

```typescript
listTrash() {
  return this.prisma.employee.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
  });
}

softDelete(userId: string) {
  return this.prisma.employee.update({
    where: { userId },
    data: { deletedAt: new Date() },
  });
}

restore(userId: string) {
  return this.prisma.employee.update({
    where: { userId },
    data: { deletedAt: null },
  });
}

async permanentlyDelete(userId: string) {
  const employee = await this.prisma.employee.findUnique({ where: { userId } });
  if (!employee || employee.deletedAt === null) {
    throw new BadRequestException(
      'Só é possível excluir permanentemente um colaborador que já está na lixeira.',
    );
  }
  await this.prisma.employee.delete({ where: { userId } });
}
```

`list()` (usado por `GET /employees`, a rota consumida pelo roster de `/colaboradores` e pelo seletor de pessoa da escala) ganha um filtro `where: { deletedAt: null }` — só colaboradores ativos.

**Onde mais um colaborador "ativo" aparece — e onde não precisa mudar.** Uma varredura em `apps/api/src` encontrou 8 lugares que fazem `prisma.employee.findMany(...)`. Só 3 são listas de "quem são os colaboradores" (e por isso precisam do filtro); os outros 5 são buscas de nome para registros que já existem (aprovações, saldos de benefícios, sobreaviso, deslocamentos, escala) e já têm um fallback (`?? record.userId`) para quando o `Employee` não é encontrado — filtrar esses faria um colaborador excluído "sumir do nome" em registros históricos que ele criou antes de ser excluído, o que não é o comportamento pedido (a intenção é ele não aparecer mais como colaborador ativo, não apagar o rastro de coisas que ele já fez). Ganham o filtro `deletedAt: null`:

1. `apps/api/src/employees/employees.service.ts` — `list()` (já citado acima).
2. `apps/api/src/time-entries/time-entries.service.ts` — `listTeamToday()` (painel de presença — um colaborador excluído não pode continuar aparecendo como "Atrasado" para sempre).
3. `apps/api/src/onboarding/onboarding.service.ts` — `listTeamProgress()` (itera todos os `Employee` diretamente para montar o checklist da equipe).

Não ganham o filtro (permanecem exatamente como estão): `documentos.service.ts` (`withRequesterNames`), `beneficios.service.ts` (`listAllBalances`), `solicitacoes.service.ts` (`withRequesterNames`), `operacional.service.ts` (`listActiveSobreaviso`, `listAllDeslocamentos`, `listShifts`).

## 5. Web (`apps/web`)

### 5.1 Botão + diálogo de cadastro

Novo Client Component `apps/web/src/app/(app)/colaboradores/novo-colaborador-dialog.tsx`, seguindo o mesmo padrão de `<dialog>` + `useRef` + `showModal()`/`close()` já usado em `onboarding-row.tsx`, combinado com `useActionState` já usado em `colaboradores-row.tsx`:

- Um botão "+ Novo colaborador" que abre o diálogo.
- Formulário dentro do diálogo com todos os campos da seção 3: nome (texto), cargo (`<select>`: Colaborador/Gestor/RH), data de admissão (`type="date"`), CPF (texto, 11 dígitos), RG (texto), data de nascimento (`type="date"`), estado civil (`<select>` com as 5 opções de `ESTADOS_CIVIS`, rotuladas em português: "Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União estável"), e endereço em 6 campos: rua, número, bairro, cidade, estado (`<select>` com as 27 opções de `UFS`), CEP.
- Campos pessoais (tudo exceto nome/cargo/admissão) são opcionais no formulário — enviados como `null` se vazios, mesmo padrão de `expectedStartTime` em `colaboradores-row.tsx`.
- Em sucesso: fecha o diálogo (`dialogRef.current?.close()`) e a lista é atualizada via `revalidatePath` (o Server Action já cuida disso — o `useActionState` reage ao novo estado, e um `useEffect` fecha o diálogo quando `state.success` fica `true`).
- Em erro: mensagem inline dentro do diálogo (mesmo padrão de `state.error` já usado).

`apps/web/src/app/(app)/colaboradores/page.tsx` importa e renderiza `<NovoColaboradorDialog />` ao lado do `<h1>`.

### 5.2 `apps/web/src/app/(app)/colaboradores/actions.ts`

Adiciona:

```typescript
export type CreateEmployeeState = { error: string | null; success: boolean };

export async function createEmployee(
  _prevState: CreateEmployeeState,
  formData: FormData
): Promise<CreateEmployeeState> {
  const raw = Object.fromEntries(formData.entries());
  const toNullable = (key: string) => (raw[key] === "" ? null : raw[key]);

  const payload = {
    name: raw.name,
    role: raw.role,
    hireDate: raw.hireDate,
    cpf: toNullable("cpf"),
    rg: toNullable("rg"),
    dataNascimento: toNullable("dataNascimento"),
    estadoCivil: toNullable("estadoCivil"),
    enderecoRua: toNullable("enderecoRua"),
    enderecoNumero: toNullable("enderecoNumero"),
    enderecoBairro: toNullable("enderecoBairro"),
    enderecoCidade: toNullable("enderecoCidade"),
    enderecoEstado: toNullable("enderecoEstado"),
    enderecoCep: toNullable("enderecoCep"),
  };

  const res = await apiFetch("/employees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    if (res.status === 409) {
      return { error: "Já existe um colaborador cadastrado com esse CPF.", success: false };
    }
    return { error: `Não foi possível salvar (código ${res.status}).`, success: false };
  }

  revalidatePath("/colaboradores");
  return { error: null, success: true };
}
```

Diferente de `updateSchedule`, a validação de formato (CPF 11 dígitos, UF 2 letras, etc.) **não** é duplicada no cliente — o payload é só normalizado (`"" → null`) e a validação real acontece no `EmployeeCreateSchema.safeParse` do backend; um 400 vira `"Não foi possível salvar (código 400)."`. Isso é uma simplificação deliberada (13 campos com validação client-side duplicada seria muito código repetido do schema do backend); se o feedback de validação por campo for importante depois, é um follow-up natural, não desta entrega.

### 5.3 `apps/web/src/app/(app)/colaboradores/colaboradores.module.css`

Adiciona classes reaproveitando padrões já existentes no app:
- `.dialog`, `.dialog::backdrop`, `.dialogTitle`, `.dialogActions`, `.dialogClose` — copiadas de `onboarding.module.css` (mesmos valores).
- `.addButton` — mesmo estilo de `.saveButton` já existente neste arquivo.
- `.fieldGrid`, `.field`, `.fieldLabel`, `.fieldInput`, `.fieldSelect` — grade de 2 colunas para os 13 campos do formulário, inputs/selects reaproveitando o estilo de `.timeInput` já existente neste arquivo (mesmos `padding`/`border`/`border-radius`/`font-size`).
- `.deleteButton` — contorno e texto em `var(--color-status-danger)` (token já existente, adicionado em `globals.css` pela spec do mapa de presença), preenchido no hover.
- `.trash`, `.trashSummary` — o `<details>` retrátil da lixeira.

### 5.4 Botão de excluir + seção "Lixeira"

**Botão "Excluir" em cada linha do roster** (`colaboradores-row.tsx`): um segundo `<form>` dentro do `<li>`, ao lado do form de horário já existente, com um único campo oculto (`userId`) e um botão que chama a nova Server Action `deleteEmployee`. Sem confirmação — mesmo padrão direto do botão "Remover" já usado em `apps/web/src/app/(app)/escala/page.tsx` (`<form action={removeShift}>`). A ação chama `DELETE /employees/:userId` e revalida `/colaboradores` e `/` (o colaborador precisa sumir do painel de presença também).

**Nova seção "Lixeira"**, novo arquivo `apps/web/src/app/(app)/colaboradores/lixeira-section.tsx` — Server Component (não precisa de estado de cliente), busca `GET /employees/trash` e renderiza dentro de um `<details><summary>Lixeira (N)</summary>...</details>`, cada linha com dois forms: "Restaurar" (`PATCH /employees/:userId/restore`) e "Excluir permanentemente" (`DELETE /employees/:userId/permanent`), ambos sem confirmação — a lixeira já é a camada de segurança contra exclusão acidental. `page.tsx` renderiza `<LixeiraSection />` no fim da página, depois da lista principal.

`actions.ts` ganha três novas Server Actions (`deleteEmployee`, `restoreEmployee`, `permanentlyDeleteEmployee`), todas no mesmo estilo simples de `addShift`/`removeShift` em `escala/actions.ts` (leem `userId` do `FormData`, `throw` em caso de falha — sem `useActionState`, já que não há erro esperado em uso normal).

## 6. Testes

- **`shared-types`**: `employee-create.test.ts` — aceita payload completo válido; aceita todos os campos pessoais como `null`; rejeita CPF com formato errado (com pontuação, menos de 11 dígitos); rejeita UF inválida (3 letras, minúscula); rejeita `estadoCivil` fora da lista fixa; rejeita `role` inválido; rejeita `name`/`hireDate` ausentes.
- **API**:
  - `EmployeesService.create`: persiste com um `userId` gerado (não fornecido no input); persiste com todos os campos pessoais `null`; lança `ConflictException` ao tentar criar um segundo registro com o mesmo CPF (teste real contra Prisma, criando dois registros).
  - `EmployeesController`: guard metadata do `create` (`AuthGuard` + `RolesGuard`, `@Roles(['rh'])`, não `['gestor','rh']`); 400 em corpo inválido antes de chamar o service; delega corpo válido para o service.
- **Web**: estende `apps/web/e2e/colaboradores.spec.ts` (e `fake-api-server.mjs`, adicionando `POST /employees` — sucesso 201 e um caminho de seed para simular 409):
  - Clicar em "+ Novo colaborador" abre o diálogo com todos os campos.
  - Preencher os campos obrigatórios e enviar chama a API com o corpo esperado (campos pessoais vazios viram `null`), fecha o diálogo, e o novo colaborador aparece na lista.
  - CPF duplicado (fake API seedada pra devolver 409) mostra a mensagem de erro inline sem fechar o diálogo.
  - Clicar em "Excluir" numa linha abre o diálogo de confirmação; confirmar chama `DELETE /employees/:userId`; cancelar não chama nada.
  - A seção "Lixeira" lista quem tem `deletedAt`; "Restaurar" chama `PATCH /employees/:userId/restore` direto, sem confirmação; "Excluir permanentemente" abre diálogo de confirmação e só chama `DELETE /employees/:userId/permanent` ao confirmar.
  - `EmployeesService.updatePersonalData`: atualiza todos os campos pessoais de um colaborador existente; mantém o mesmo CPF sem lançar `ConflictException` (atualização idempotente); lança `ConflictException` se o novo CPF já pertence a outro colaborador.
  - `EmployeesController`: guard metadata do `updatePersonalData` (`@Roles(['rh'])`).
  - Clicar em "Editar" abre o diálogo pré-preenchido com os dados atuais; alterar um campo e salvar chama `PATCH /employees/:userId/personal-data` com o corpo completo (13 campos).
  - Preencher um CEP válido (mock da ViaCEP via `page.route`) preenche rua/bairro/cidade/estado automaticamente; CEP não encontrado (`{erro: true}` mockado) não altera os campos.

## 7. Erros e casos de borda

- CPF duplicado (na criação ou na edição) → 409 → mensagem inline, diálogo permanece aberto com os dados preenchidos (usuário pode corrigir o CPF sem redigitar tudo).
- Corpo inválido (ex: UF com 3 letras) → 400 → mensagem genérica de erro (sem detalhamento por campo, ver seção 5.2).
- `role`/`hireDate`/`name` ausentes → mesmo tratamento de 400.
- Tentar excluir permanentemente um colaborador que não está na lixeira (`deletedAt === null`) → 400 (`permanentlyDelete` verifica isso explicitamente antes de apagar).
- Busca de CEP falha (rede, CEP inexistente) → campos de endereço ficam como estavam, sem mensagem de erro bloqueante (falha silenciosa, mesmo espírito do polling do painel de presença).

## 8. Edição de dados pessoais depois de cadastrado

**Decisão confirmada:** todos os campos pessoais são editáveis depois da criação, incluindo cargo e data de admissão — o mesmo conjunto de campos do cadastro.

**Backend:** novo endpoint `PATCH /employees/:userId/personal-data` (`@Roles('rh')`), reaproveitando o mesmo `EmployeeCreateSchema` da criação (mesmo formato, mesmos campos) — não é preciso um schema novo. Novo método `EmployeesService.updatePersonalData(userId, input: EmployeeCreateInput)`:

```typescript
async updatePersonalData(userId: string, input: EmployeeCreateInput) {
  try {
    return await this.prisma.employee.update({
      where: { userId },
      data: {
        name: input.name,
        role: input.role,
        hireDate: new Date(input.hireDate),
        cpf: input.cpf,
        rg: input.rg,
        dataNascimento: input.dataNascimento ? new Date(input.dataNascimento) : null,
        estadoCivil: input.estadoCivil,
        enderecoRua: input.enderecoRua,
        enderecoNumero: input.enderecoNumero,
        enderecoBairro: input.enderecoBairro,
        enderecoCidade: input.enderecoCidade,
        enderecoEstado: input.enderecoEstado,
        enderecoCep: input.enderecoCep,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Já existe um colaborador cadastrado com esse CPF.');
    }
    throw error;
  }
}
```

Não precisa de tratamento especial para "o próprio CPF não deve contar como duplicado consigo mesmo" — um `UPDATE` que mantém o mesmo valor de `cpf` não viola o índice único (nenhuma outra linha passa a ter esse valor); só colide de verdade se o novo valor já pertencer a *outro* registro, que é exatamente o caso que deve dar 409.

**Web:** botão "Editar" em cada linha do roster (`colaboradores-row.tsx`) abre um terceiro diálogo, pré-preenchido com os dados atuais do colaborador. Para não duplicar os ~150 linhas de JSX dos 13 campos, o conjunto de campos do formulário é extraído para um componente compartilhado `colaborador-form-fields.tsx`, usado tanto pelo diálogo de criação quanto pelo de edição (a busca automática de CEP e o validador de CPF, seções 9 e 10, vivem dentro desse componente compartilhado — funcionam nos dois diálogos automaticamente). `GET /employees` já retorna o registro completo (Tarefa 3), então o `Employee` type usado por `page.tsx`/`colaboradores-row.tsx` passa a incluir todos os campos pessoais, não só `userId`/`name`/`expectedStartTime`.

Nova Server Action `updateEmployeePersonalData`, no mesmo formato de `createEmployee` (normaliza `"" → null`, mapeia erro 409/400), mas com `PATCH` em vez de `POST` e incluindo `userId` no payload da URL (`/employees/${userId}/personal-data`).

## 9. Busca automática de endereço por CEP

Ao digitar um CEP válido (8 dígitos) e sair do campo (`onBlur`), o formulário busca o endereço automaticamente na API pública ViaCEP (`https://viacep.com.br/ws/{cep}/json/`, gratuita, sem autenticação, com CORS liberado para chamadas diretas do navegador) e preenche rua/bairro/cidade/estado. O campo de número não é preenchido (a ViaCEP não retorna número de imóvel) — fica para o usuário digitar. Se a busca falhar (CEP não encontrado, erro de rede), os campos ficam como estavam, sem bloquear o preenchimento manual.

Implementado em `colaborador-form-fields.tsx` (compartilhado entre criação e edição, seção 9), via `useRef` nos campos de rua/bairro/cidade e no `<select>` de estado (mesmo padrão de manipulação DOM direta já usado no app para diálogos), sem introduzir um formulário controlado.

## 10. Validador de CPF

O campo de CPF ganha o atributo HTML nativo `pattern="\d{11}"` (mais `title` explicando o formato) — o navegador mostra feedback nativo (contorno vermelho + balão de validação) se o valor não tiver exatamente 11 dígitos, sem bloquear o campo vazio (CPF continua opcional). Não substitui a validação real do backend (`EmployeeCreateSchema`), que continua sendo a fonte de verdade — isto é só feedback antecipado para o usuário, mesmo espírito de "campo com formato claro" já usado no `type="time"` de horário esperado.

## 11. Confirmação antes de excluir

**Decisão confirmada (revisando a decisão anterior):** tanto "Excluir" (mover pra lixeira) quanto "Excluir permanentemente" passam a exigir confirmação antes de executar — um `<dialog>` (mesmo padrão visual já usado no app), não um `window.confirm()` nativo do navegador.

- `colaboradores-row.tsx`: o botão "Excluir" abre um diálogo de confirmação ("Tem certeza que deseja excluir {nome}? Ele irá para a lixeira.") com "Cancelar" e um formulário de confirmação que efetivamente chama `deleteEmployee`.
- A lixeira deixa de ser um Server Component puro: cada linha vira um novo Client Component `lixeira-row.tsx` (extraído de `lixeira-section.tsx`, que continua Server Component só buscando os dados e mapeando `<LixeiraRow />`). Só "Excluir permanentemente" ganha diálogo de confirmação ali ("Tem certeza que deseja excluir PERMANENTEMENTE {nome}? Essa ação não pode ser desfeita.") — "Restaurar" continua uma ação direta, sem confirmação (é reversível e de baixo risco).

## 12. Fora de escopo (referência para o plano de implementação)

- Reconciliar um `Employee` cadastrado por este formulário com uma conta de login real (SSO/OIDC) que apareça depois com o mesmo nome/CPF — hoje são identidades completamente desconectadas (`userId` aleatório vs. `sub` do IdP). Se isso vier a ser necessário, é uma spec própria.
- Validação de dígito verificador de CPF (seção 11 cobre só formato de 11 dígitos, não o algoritmo real de validação).
- Upload de documentos (RG/CPF digitalizados) — já existe `AdmissionDocument` para isso, sem relação direta com os campos estruturados desta spec.
- Máscara de digitação visual nos campos (CPF `000.000.000-00`, CEP `00000-000` conforme o usuário digita) — os campos continuam aceitando/validando dígitos crus; a seção 11 é validação de formato, não formatação visual.
- Esvaziar a lixeira automaticamente depois de um tempo (ex: 30 dias) — a exclusão permanente é sempre manual nesta entrega.
- Confirmação ao restaurar um colaborador da lixeira — só as duas ações de exclusão (seção 12) pedem confirmação.
