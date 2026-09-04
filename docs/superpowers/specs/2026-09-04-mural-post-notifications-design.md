# Publicar no Mural + Notificação para Todos

**Status:** Proposto
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)
**Specs relacionadas:** [`2026-09-01-mural-colaborador-web-design.md`](2026-09-01-mural-colaborador-web-design.md) (mural somente-leitura, como existe hoje), [`2026-09-02-notificacoes-web-design.md`](2026-09-02-notificacoes-web-design.md) / [`2026-09-02-notificacoes-mobile-design.md`](2026-09-02-notificacoes-mobile-design.md) (infraestrutura de sino/inbox), [`2026-09-02-ponto-perdido-design.md`](2026-09-02-ponto-perdido-design.md) (padrão de broadcast mais recente, mesmo idioma de código)

## 1. Objetivo e escopo

Hoje o Mural é só leitura: `MuralPost` existe no schema e é visível pra todo mundo (`GET /mural/posts`, sem restrição de role), mas não existe nenhum jeito de criar um post pelo app — o conteúdo atual é só seed. Esta spec adiciona:

1. Um endpoint pra criar um post no mural.
2. Um botão/diálogo "+ Novo post" na página web do Mural.
3. Uma notificação (sino/inbox já existente) pra todo mundo, exceto quem postou, quando um post é criado.

**Quem pode postar:** `gestor` e `rh` (decidido em conversa — mesmo público que já cria holerites/convenções/documentos administrativos no app).

**Quem recebe a notificação:** todo funcionário ativo (`Employee.deletedAt === null`), de qualquer role, exceto o autor do post (decidido em conversa — bate com o Mural já ser visível a todo mundo sem recorte de time/departamento hoje).

**Zero tela nova de notificação.** Reaproveita o sino/inbox que já existe nas duas plataformas (mesma decisão de escopo das specs de notificação anteriores).

**Só web por enquanto.** O Mural no mobile continua somente-leitura — nenhuma tela de app mobile hoje tem uma ação administrativa (criar/editar/excluir), então adicionar a primeira lá seria escopo novo por si só, não pedido nesta conversa.

## 2. Backend (`apps/api`)

### 2.1 `packages/shared-types/src/mural.ts` (novo)

```typescript
import { z } from "zod";

export const MuralPostInputSchema = z.object({
  glyph: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
});
export type MuralPostInput = z.infer<typeof MuralPostInputSchema>;
```

`packages/shared-types/src/index.ts` (modificado) — adiciona ao final:
```typescript
export { MuralPostInputSchema } from "./mural";
export type { MuralPostInput } from "./mural";
```

### 2.2 `NotificationsService.sendMural` (novo método, `apps/api/src/notifications/notifications.service.ts`)

```typescript
const muralMessage = (title: string) => `"${title}" foi publicado no mural.`;

async sendMural(postTitle: string, posterUserId: string): Promise<void> {
  const recipients = await this.prisma.employee.findMany({
    where: { deletedAt: null, userId: { not: posterUserId } },
  });

  const created = await this.prisma.notification.createManyAndReturn({
    data: recipients.map((r) => ({
      userId: r.userId,
      type: 'mural',
      category: null,
      message: muralMessage(postTitle),
      link: '/mural',
    })),
  });

  void Promise.all(
    created.map((n) =>
      this.expoPush.sendToUser(n.userId, {
        title: 'Ponto DCIT',
        body: n.message,
        data: { notificationId: n.id, link: n.link },
      }),
    ),
  );
}
```

Mesmo padrão de `sendPontoPerdido`/`sendPagamento`: `createManyAndReturn` primeiro (uma linha por destinatário), depois `void Promise.all(...)` fire-and-forget pro push — **nunca `await` o push**, só a criação das linhas de notificação.

`recipients` não filtra por `role` — ao contrário de `sendPontoPerdido` (que separa colaborador vs. gestor/rh com mensagens diferentes), aqui todo mundo recebe a mesma mensagem, porque o Mural em si não tem esse recorte hoje.

### 2.3 `MuralService.createPost` (novo método, `apps/api/src/mural/mural.service.ts`)

```typescript
async createPost(input: MuralPostInput, posterUserId: string) {
  const post = await this.prisma.muralPost.create({ data: input });
  await this.notifications.sendMural(post.title, posterUserId);
  return post;
}
```

`await` aqui (não `void`) — a criação das notificações deve ter terminado antes da resposta HTTP voltar, mesmo padrão de `PontoPerdidoService.run` chamando `await this.notifications.sendPontoPerdido(...)`. O `void` fire-and-forget vive só dentro de `sendMural`, na parte do push.

Construtor de `MuralService` (modificado) — adiciona `NotificationsService`:
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly notifications: NotificationsService,
) {}
```

### 2.4 `MuralController` (modificado, `apps/api/src/mural/mural.controller.ts`)

Novo handler, mesmo padrão de decorators de `POST /documentos/holerites`:
```typescript
@UseGuards(AuthGuard, RolesGuard)
@Roles('gestor', 'rh')
@Post('posts')
@HttpCode(201)
async createPost(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
  const result = MuralPostInputSchema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException(result.error.flatten());
  }
  return this.mural.createPost(result.data, req.user.sub);
}
```

Novos imports: `BadRequestException`, `HttpCode` de `@nestjs/common`; `RolesGuard` de `../auth/roles.guard`; `Roles` de `../auth/roles.decorator`; `MuralPostInputSchema` de `@ponto-dcit/shared-types`.

Rota final: `POST /mural/posts` — mesmo path base das rotas de leitura já existentes (`GET /mural/posts`), só que restrito por role.

### 2.5 `MuralModule` (modificado, `apps/api/src/mural/mural.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { MuralController } from './mural.controller';
import { MuralService } from './mural.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [MuralController],
  providers: [MuralService],
})
export class MuralModule {}
```

`NotificationsModule` já exporta `NotificationsService` hoje (diferente da spec de Ponto Perdido, que precisou adicionar esse export) — nenhuma mudança necessária em `notifications.module.ts`.

## 3. Frontend web (`apps/web`)

### 3.1 `apps/web/src/app/(app)/mural/actions.ts` (modificado — arquivo já existe, hoje só com `toggleMuralReaction`)

Novo export:
```typescript
export type MuralPostState = { error: string | null; success: boolean; successToken: number };

export async function createMuralPost(
  _prevState: MuralPostState,
  formData: FormData
): Promise<MuralPostState> {
  const glyph = formData.get("glyph");
  const title = formData.get("title");
  const body = formData.get("body");
  if (typeof glyph !== "string" || typeof title !== "string" || typeof body !== "string") {
    return { error: "Dados do formulário inválidos.", success: false, successToken: _prevState.successToken };
  }

  const res = await apiFetch("/mural/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ glyph, title, body }),
  });
  if (!res.ok) {
    return {
      error: `Não foi possível publicar (código ${res.status}).`,
      success: false,
      successToken: _prevState.successToken,
    };
  }

  revalidatePath("/mural");
  return { error: null, success: true, successToken: Date.now() };
}
```

Mesmo padrão de `createHolerite` (`apps/web/src/app/(app)/holerites/actions.ts`) — `useActionState`-compatível, `successToken: Date.now()` como gatilho pro dialog fechar/resetar via `useEffect`.

### 3.2 `apps/web/src/app/(app)/mural/novo-post-dialog.tsx` (novo)

Mesma estrutura de `novo-holerite-dialog.tsx`: botão que abre um `<dialog>`, formulário com `useActionState(createMuralPost, ...)`, fecha e reseta ao `state.success`.

Campos: `glyph` (texto curto, `maxLength={4}`, placeholder `"🎉"`), `title`, `body` (`<textarea>`). Sem campo de destinatário/audiência — todo post notifica todo mundo, sem escolha no formulário (decidido em §1).

### 3.3 `apps/web/src/app/(app)/mural/page.tsx` (modificado)

Duas mudanças em `TeamView` (a função que já atende gestor e rh):

1. **Remove o early-return de `EmptyState` genérico** (`if (posts.length === 0 && birthdays.length === 0) return <EmptyState ... />`). Cada seção (Aniversariantes, Comunicados) já tem sua própria mensagem de vazio (`"Nenhum aniversariante cadastrado."` / `"Nenhum comunicado publicado ainda."`) — o early-return é redundante hoje e, pior, esconderia o botão "+ Novo post" bem na primeira vez que alguém for usá-lo (mural sem nenhum post ainda). Mesmo raciocínio já aplicado em `/colaboradores` (`"the add-colaborador button is visible even with an empty roster"`).
2. **Adiciona `<NovoPostDialog />`** ao lado do `<h1>`, dentro de um `<div className={styles.headingRow}>` (mesmo padrão de `holerites/page.tsx`). `TeamView` já só é chamada pra `gestor`/`rh` (não `colaborador`), então nenhum guard de role adicional é necessário aqui — o guard de verdade é o do próprio endpoint (§2.4).

`ColaboradorView` não muda — colaborador não ganha botão de postar, e seu early-return de `EmptyState` continua como está (fora de escopo, §5).

### 3.4 `apps/web/src/app/(app)/mural/mural.module.css` (modificado)

Novas classes, copiando exatamente de `holerites.module.css`: `.headingRow`, `.addButton`, `.dialog`, `.dialogTitle`, `.dialogActions`, `.dialogClose`, `.saveButton`, `.error`, `.field`, `.fieldLabel`, `.fieldInput`, mais uma nova `.fieldTextarea` (não existe em `holerites.module.css` porque nenhum formulário existente usa `<textarea>` — mesmas propriedades de `.fieldInput`, só com `resize: vertical` e `min-height`).

## 4. Testes

### 4.1 `apps/api/src/notifications/notifications.service.spec.ts` (estendido)

Novo `describe('sendMural', ...)`, mesmo padrão de mock de `ExpoPushService` já usado em `sendPagamento`/`sendPontoPerdido`:
- Cria uma notificação por funcionário ativo, **exceto** o autor (`posterUserId` nunca aparece como destinatário mesmo sendo um funcionário ativo).
- `type: 'mural'`, `category: null`, `link: '/mural'`, mensagem incluindo o título entre aspas.
- Funcionário com `deletedAt` preenchido não recebe notificação.
- Dispara `sendToUser` pra cada destinatário criado, com `data.notificationId`/`data.link` corretos.

### 4.2 `apps/api/src/mural/mural.service.spec.ts` (estendido, ou novo se não existir)

- `createPost` grava o `MuralPost` com os campos exatos do input.
- `createPost` chama `notifications.sendMural` com `(post.title, posterUserId)` — mockar `NotificationsService` aqui (unit test, não integração; a cobertura de integração real do broadcast já é o §4.1).

### 4.3 `apps/web/e2e/mural.spec.ts` (novo)

- Colaborador não vê o botão "+ Novo post".
- Gestor e RH veem o botão.
- Preencher e submeter o formulário chama `POST /mural/posts` com `{ glyph, title, body }` exatos.
- Uma falha da API (500 simulado) mostra erro inline sem fechar o diálogo — mesmo padrão de `"a duplicate CPF shows an inline error without closing the dialog"` em `colaboradores.spec.ts`.
- Mural sem nenhum post/aniversariante ainda mostra o botão "+ Novo post" visível (a regressão que a mudança do §3.3 item 1 evita).

## 5. Global Constraints

- Zero mudança de schema Prisma — `MuralPost` já tem `glyph`/`title`/`body`; `Notification.type`/`category` já são `String`/`String?` livres, `'mural'` e `null` são só valores novos.
- `sendMural` deve disparar push com `void Promise.all(...)`, nunca `await` — mesma convenção de todo outro produtor de push no código.
- A criação da notificação em si (`createManyAndReturn`, dentro de `sendMural`) é `await`ada por `MuralService.createPost` antes da resposta HTTP voltar — só o push é fire-and-forget.
- Nenhuma mudança na infraestrutura de sino/inbox (web ou mobile) — reaproveita integralmente o que já existe.
- O formulário de novo post não tem campo de audiência/destinatário — todo post sempre notifica todo mundo, sem opção de restringir.

## 6. Fora de escopo

- Criar post pelo mobile — nenhuma tela do app mobile hoje tem ação administrativa; ficaria pra uma spec própria se for pedido depois.
- Editar ou excluir um post depois de criado — só criação nesta spec (mesmo corte inicial que outras specs administrativas, como Convenções, tiveram antes de ganhar edição/exclusão).
- Escolher quem recebe a notificação (por role, por time) — todo post notifica todo mundo ativo, sem exceção além do próprio autor (§1).
- Anexar imagem/arquivo ao post — `MuralPost` só tem `glyph`/`title`/`body` hoje; anexos exigiriam mudança de schema, não pedida.
- Confirmação/preview antes de publicar — o botão "Publicar" já envia direto, mesmo padrão de "Cadastrar" nos outros diálogos administrativos do app.
