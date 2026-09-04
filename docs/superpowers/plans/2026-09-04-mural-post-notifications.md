# Publicar no Mural + Notificação para Todos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let gestor/rh publish a new Mural post through the web app, and notify every other active employee via the existing notification bell/inbox when they do.

**Architecture:** A new `POST /mural/posts` endpoint (role-guarded, Zod-validated) creates the `MuralPost` row then calls a new `NotificationsService.sendMural` method that writes one `Notification` row per active employee (excluding the poster) and fires push, mirroring the existing `sendPontoPerdido` broadcast pattern exactly. The web Mural page gets a "+ Novo post" dialog (gestor/rh only) that POSTs to the new endpoint via a server action, following the same dialog/action pattern already used by `/holerites`.

**Tech Stack:** NestJS + Prisma (SQLite in tests) on the backend, Zod for request validation (`@ponto-dcit/shared-types`), Next.js App Router server actions + `<dialog>` on the frontend, Jest (backend/shared-types unit+integration tests) and Playwright (web e2e).

**Spec:** [`docs/superpowers/specs/2026-09-04-mural-post-notifications-design.md`](../specs/2026-09-04-mural-post-notifications-design.md)

## Global Constraints

- `sendMural` must dispatch push with `void Promise.all(...)`, never `await` — the notification rows themselves ARE awaited by the caller, only push delivery is fire-and-forget.
- Recipients = every `Employee` with `deletedAt: null`, excluding the poster (`userId: { not: posterUserId }`) — no role filter.
- `POST /mural/posts` is restricted to `gestor` and `rh` via `@UseGuards(AuthGuard, RolesGuard)` + `@Roles('gestor', 'rh')`.
- No Prisma schema changes — `MuralPost` and `Notification` already have every field this feature needs.
- No mobile changes — Mural stays read-only on `apps/mobile`.
- The web "+ Novo post" form has no audience/recipient field — every post always notifies everyone.

---

### Task 1: `MuralPostInputSchema` (shared-types)

**Files:**
- Create: `packages/shared-types/src/mural.ts`
- Create: `packages/shared-types/src/mural.test.ts`
- Modify: `packages/shared-types/src/index.ts` (append 2 export lines at the end)

**Interfaces:**
- Produces: `MuralPostInputSchema: ZodObject<{ glyph: string; title: string; body: string }>`, `type MuralPostInput = { glyph: string; title: string; body: string }` — both imported later by Task 4 (`apps/api/src/mural/mural.controller.ts`) via `@ponto-dcit/shared-types`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared-types/src/mural.test.ts`:
```typescript
import { MuralPostInputSchema } from "./mural";

const VALID_INPUT = {
  glyph: "🎉",
  title: "Boas-vindas!",
  body: "Damos as boas-vindas ao novo time de suporte.",
};

describe("MuralPostInputSchema", () => {
  it("accepts a fully populated valid payload", () => {
    const result = MuralPostInputSchema.safeParse(VALID_INPUT);
    expect(result.success).toBe(true);
  });

  it("rejects an empty glyph", () => {
    const result = MuralPostInputSchema.safeParse({ ...VALID_INPUT, glyph: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty title", () => {
    const result = MuralPostInputSchema.safeParse({ ...VALID_INPUT, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty body", () => {
    const result = MuralPostInputSchema.safeParse({ ...VALID_INPUT, body: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing title", () => {
    const { title: _title, ...rest } = VALID_INPUT;
    const result = MuralPostInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages/shared-types`): `pnpm exec jest src/mural.test.ts`
Expected: FAIL — `Cannot find module './mural'`

- [ ] **Step 3: Write minimal implementation**

Create `packages/shared-types/src/mural.ts`:
```typescript
import { z } from "zod";

export const MuralPostInputSchema = z.object({
  glyph: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
});
export type MuralPostInput = z.infer<typeof MuralPostInputSchema>;
```

Append to the end of `packages/shared-types/src/index.ts`:
```typescript
export { MuralPostInputSchema } from "./mural";
export type { MuralPostInput } from "./mural";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec jest src/mural.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types/src/mural.ts packages/shared-types/src/mural.test.ts packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add MuralPostInputSchema"
```

---

### Task 2: `NotificationsService.sendMural`

**Files:**
- Modify: `apps/api/src/notifications/notifications.service.ts`
- Modify: `apps/api/src/notifications/notifications.service.spec.ts`

**Interfaces:**
- Consumes: `this.prisma.employee`/`this.prisma.notification` (`PrismaService`, already injected in this class), `this.expoPush.sendToUser(userId: string, { title, body, data }): Promise<void>` (`ExpoPushService`, already injected).
- Produces: `sendMural(postTitle: string, posterUserId: string): Promise<void>` — called by Task 3's `MuralService.createPost`.

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/notifications/notifications.service.spec.ts`, as a new top-level `describe` block (place it after the existing `describe('sendPontoPerdido', ...)` block, before the file's closing):
```typescript
describe('sendMural', () => {
  afterEach(async () => {
    await prisma.employee.deleteMany({ where: { userId: { startsWith: 'user-mural-' } } });
  });

  it('notifies every active employee except the poster', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-mural-poster',
        name: 'Paula Poster',
        role: 'rh',
        hireDate: new Date('2024-01-01'),
      },
    });
    await prisma.employee.create({
      data: {
        userId: 'user-mural-colaborador',
        name: 'Carlos Colaborador',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });
    await prisma.employee.create({
      data: {
        userId: 'user-mural-gestor',
        name: 'Gustavo Gestor',
        role: 'gestor',
        hireDate: new Date('2024-01-01'),
      },
    });
    // Deleted (inactive) employee must never receive a broadcast copy.
    await prisma.employee.create({
      data: {
        userId: 'user-mural-inativo',
        name: 'Inês Inativa',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
        deletedAt: new Date('2026-01-01'),
      },
    });

    await service.sendMural('Boas-vindas!', 'user-mural-poster');

    const notifications = await prisma.notification.findMany({
      where: { type: 'mural' },
      orderBy: { userId: 'asc' },
    });
    expect(notifications.map((n) => n.userId).sort()).toEqual(
      ['user-mural-colaborador', 'user-mural-gestor'].sort(),
    );
    expect(notifications[0]).toMatchObject({
      type: 'mural',
      category: null,
      message: '"Boas-vindas!" foi publicado no mural.',
      link: '/mural',
    });
  });

  it('sends a push to every recipient with the notification id and link in the data payload', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-mural-poster',
        name: 'Paula Poster',
        role: 'rh',
        hireDate: new Date('2024-01-01'),
      },
    });
    await prisma.employee.create({
      data: {
        userId: 'user-mural-recipient',
        name: 'Rita Recipient',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });

    await service.sendMural('Aviso', 'user-mural-poster');
    // Push dispatch is fire-and-forget (`void Promise.all(...)`) — give the
    // microtask queue a turn before asserting, same pattern already used by
    // the sendPagamento push-dispatch test in this file.
    await new Promise((resolve) => setImmediate(resolve));

    const notification = await prisma.notification.findFirstOrThrow({
      where: { type: 'mural', userId: 'user-mural-recipient' },
    });
    expect(sendToUser).toHaveBeenCalledWith('user-mural-recipient', {
      title: 'Ponto DCIT',
      body: '"Aviso" foi publicado no mural.',
      data: { notificationId: notification.id, link: '/mural' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/api`): `pnpm exec jest src/notifications/notifications.service.spec.ts -t sendMural`
Expected: FAIL — `service.sendMural is not a function`

- [ ] **Step 3: Write minimal implementation**

In `apps/api/src/notifications/notifications.service.ts`, add this constant near the other `*_MESSAGE` constants (e.g. right after `PONTO_PERDIDO_MESSAGE_GESTOR`) and this method inside the `NotificationsService` class (e.g. right after `sendPontoPerdido`):
```typescript
const muralMessage = (title: string) => `"${title}" foi publicado no mural.`;
```
```typescript
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec jest src/notifications/notifications.service.spec.ts`
Expected: PASS, all tests in the file (existing + 2 new)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/notifications/notifications.service.ts apps/api/src/notifications/notifications.service.spec.ts
git commit -m "feat(api): add NotificationsService.sendMural broadcast"
```

---

### Task 3: `MuralService.createPost`

**Files:**
- Modify: `apps/api/src/mural/mural.service.ts`
- Modify: `apps/api/src/mural/mural.service.spec.ts`
- Modify: `apps/api/src/mural/mural.module.ts`

**Interfaces:**
- Consumes: `NotificationsService.sendMural(postTitle: string, posterUserId: string): Promise<void>` (Task 2), `MuralPostInput` type (Task 1, for the method's parameter type — import from `@ponto-dcit/shared-types`).
- Produces: `MuralService.createPost(input: MuralPostInput, posterUserId: string): Promise<MuralPost>` — called by Task 4's `MuralController.createPost`.

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/mural/mural.service.spec.ts`. This file's `TestingModule` currently only provides `[MuralService, PrismaService]` — `MuralService`'s constructor is about to require `NotificationsService`, so update the `beforeAll` block's `providers` array too, mocking `ExpoPushService` the same way `notifications.service.spec.ts` does (real `NotificationsService`+`PrismaService`, only the push edge mocked):

```typescript
// Add these imports at the top of the file, alongside the existing ones:
import { NotificationsService } from '../notifications/notifications.service';
import { ExpoPushService } from '../push/expo-push.service';
```
Replace the `beforeAll` block's `providers` array:
```typescript
providers: [
  MuralService,
  PrismaService,
  NotificationsService,
  { provide: ExpoPushService, useValue: { sendToUser: jest.fn() } },
],
```
Add a new `describe` block, e.g. right after the existing `'lists birthdays'` test, before the closing `});` of the outer `describe('MuralService', ...)`:
```typescript
describe('createPost', () => {
  afterEach(async () => {
    await prisma.employee.deleteMany({ where: { userId: { startsWith: 'user-mural-create-' } } });
    await prisma.notification.deleteMany({ where: { type: 'mural' } });
  });

  it('creates the post with the given glyph/title/body', async () => {
    const post = await service.createPost(
      { glyph: '📣', title: 'Aviso importante', body: 'Confira o novo procedimento.' },
      'user-mural-create-poster',
    );

    expect(post).toMatchObject({
      glyph: '📣',
      title: 'Aviso importante',
      body: 'Confira o novo procedimento.',
    });
    const stored = await prisma.muralPost.findUnique({ where: { id: post.id } });
    expect(stored).toMatchObject({ glyph: '📣', title: 'Aviso importante' });
  });

  it('notifies every other active employee about the new post', async () => {
    await prisma.employee.create({
      data: {
        userId: 'user-mural-create-recipient',
        name: 'Rita Recipient',
        role: 'colaborador',
        hireDate: new Date('2024-01-01'),
      },
    });

    await service.createPost(
      { glyph: '🎉', title: 'Boas-vindas!', body: 'Corpo.' },
      'user-mural-create-poster',
    );

    const notification = await prisma.notification.findFirst({
      where: { type: 'mural', userId: 'user-mural-create-recipient' },
    });
    expect(notification).toMatchObject({ message: '"Boas-vindas!" foi publicado no mural.' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/api`): `pnpm exec jest src/mural/mural.service.spec.ts -t createPost`
Expected: FAIL — `service.createPost is not a function`

- [ ] **Step 3: Write minimal implementation**

In `apps/api/src/mural/mural.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { MuralPostInput } from '@ponto-dcit/shared-types';

@Injectable()
export class MuralService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ...existing listPosts/toggleReaction/listBirthdays methods, unchanged...

  async createPost(input: MuralPostInput, posterUserId: string) {
    const post = await this.prisma.muralPost.create({ data: input });
    await this.notifications.sendMural(post.title, posterUserId);
    return post;
  }
}
```
(Only the constructor and the new `createPost` method are new — every other method in this file stays exactly as-is.)

In `apps/api/src/mural/mural.module.ts`:
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec jest src/mural/mural.service.spec.ts`
Expected: PASS, all tests in the file (existing 4 + 2 new)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/mural/mural.service.ts apps/api/src/mural/mural.service.spec.ts apps/api/src/mural/mural.module.ts
git commit -m "feat(api): add MuralService.createPost"
```

---

### Task 4: `POST /mural/posts` endpoint

**Files:**
- Modify: `apps/api/src/mural/mural.controller.ts`
- Modify: `apps/api/src/mural/mural.controller.spec.ts`

**Interfaces:**
- Consumes: `MuralPostInputSchema` (Task 1), `MuralService.createPost(input, posterUserId)` (Task 3).
- Produces: `POST /mural/posts` HTTP route, guarded `gestor`/`rh`.

- [ ] **Step 1: Write the failing test**

In `apps/api/src/mural/mural.controller.spec.ts`:

1. Add `'createPost'` to the existing `GUARDED_HANDLERS` array (this covers the `AuthGuard` check for the new handler via the existing `it.each` loop).
2. Add these imports at the top:
```typescript
import { BadRequestException } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
```
3. Add a new `it.each` block in the `describe('MuralController guard metadata', ...)` block, right after the existing `it.each(GUARDED_HANDLERS)(...)` block:
```typescript
it.each(['createPost'] as const)('applies RolesGuard(gestor, rh) to %s', (handlerName) => {
  const guards = Reflect.getMetadata(
    GUARDS_METADATA,
    // eslint-disable-next-line @typescript-eslint/unbound-method
    MuralController.prototype[handlerName],
  ) as unknown[] | undefined;
  const roles = Reflect.getMetadata(
    ROLES_KEY,
    // eslint-disable-next-line @typescript-eslint/unbound-method
    MuralController.prototype[handlerName],
  ) as unknown[] | undefined;

  expect(guards).toContain(RolesGuard);
  expect(roles).toEqual(['gestor', 'rh']);
});
```
4. Add `createPost: jest.fn()` to the `serviceMock` object in `describe('MuralController', ...)`.
5. Add these tests at the end of the `describe('MuralController', ...)` block, right before its closing `});`:
```typescript
it('creates a post with a valid payload', async () => {
  serviceMock.createPost.mockResolvedValue({ id: 'post-1' });

  await controller.createPost(
    { glyph: '🎉', title: 'Boas-vindas!', body: 'Corpo.' },
    requestAs('user-1'),
  );

  expect(serviceMock.createPost).toHaveBeenCalledWith(
    { glyph: '🎉', title: 'Boas-vindas!', body: 'Corpo.' },
    'user-1',
  );
});

it('rejects a post payload missing a title', async () => {
  await expect(
    controller.createPost({ glyph: '🎉', body: 'Corpo.' }, requestAs('user-1')),
  ).rejects.toThrow(BadRequestException);
  expect(serviceMock.createPost).not.toHaveBeenCalled();
});

it('rejects a post payload with an empty body', async () => {
  await expect(
    controller.createPost(
      { glyph: '🎉', title: 'Boas-vindas!', body: '' },
      requestAs('user-1'),
    ),
  ).rejects.toThrow(BadRequestException);
  expect(serviceMock.createPost).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/api`): `pnpm exec jest src/mural/mural.controller.spec.ts`
Expected: FAIL — `controller.createPost is not a function` (and the guard-metadata test fails since the handler doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

In `apps/api/src/mural/mural.controller.ts`:
```typescript
import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { MuralPostInputSchema } from '@ponto-dcit/shared-types';
import { MuralService } from './mural.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('mural')
export class MuralController {
  constructor(private readonly mural: MuralService) {}

  @UseGuards(AuthGuard)
  @Get('posts')
  listPosts(@Req() req: AuthenticatedRequest) {
    return this.mural.listPosts(req.user.sub);
  }

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

  @UseGuards(AuthGuard)
  @Post('posts/:id/react')
  toggleReaction(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.mural.toggleReaction(id, req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Get('birthdays')
  listBirthdays() {
    return this.mural.listBirthdays();
  }
}
```
(`createPost` is the only new handler — `listPosts`/`toggleReaction`/`listBirthdays` are shown here just to make the file's final shape and import list explicit; their bodies are unchanged from before.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec jest src/mural/mural.controller.spec.ts`
Expected: PASS, all tests in the file

- [ ] **Step 5: Run the full API test suite to check for regressions**

Run: `pnpm exec jest` (from `apps/api`)
Expected: PASS — no other suite touches `mural`/`notifications`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/mural/mural.controller.ts apps/api/src/mural/mural.controller.spec.ts
git commit -m "feat(api): add POST /mural/posts endpoint"
```

---

### Task 5: Web posting UI

**Files:**
- Modify: `apps/web/src/app/(app)/mural/actions.ts`
- Create: `apps/web/src/app/(app)/mural/novo-post-dialog.tsx`
- Modify: `apps/web/src/app/(app)/mural/page.tsx`
- Modify: `apps/web/src/app/(app)/mural/mural.module.css`
- Modify: `apps/web/e2e/mural.spec.ts`

**Interfaces:**
- Consumes: `POST /mural/posts` (Task 4, called via `apiFetch` — no shared-types import needed client-side, the server action builds the JSON body directly from `FormData`, same as `createHolerite`).
- Produces: `<NovoPostDialog />` component (default gestor/rh-only button+dialog, no props), `createMuralPost` server action.

- [ ] **Step 1: Write the failing e2e tests**

Append to `apps/web/e2e/mural.spec.ts` (add `import { seedResponse, getRecordedRequests } from "./test-session";` is unnecessary — `getRecordedRequests` and `seedResponse` are already imported at the top of this file; just add these tests at the end):

```typescript
test("colaborador does not see the Novo post button", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { muralPosts: [], birthdays: [] });

  await page.goto("/mural");

  await expect(page.getByRole("button", { name: "+ Novo post" })).toHaveCount(0);
});

test("gestor sees the Novo post button even when the mural is empty", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, { muralPosts: [], birthdays: [] });

  await page.goto("/mural");

  await expect(page.getByRole("heading", { name: "Mural" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Novo post" })).toBeVisible();
});

test("rh creates a new mural post via the API", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, { muralPosts: [], birthdays: [] });

  await page.goto("/mural");
  await page.getByRole("button", { name: "+ Novo post" }).click();
  await page.getByLabel("Emoji").fill("🎉");
  await page.getByLabel("Título").fill("Boas-vindas!");
  await page.getByLabel("Mensagem").fill("Damos as boas-vindas ao novo time de suporte.");
  await page.getByRole("button", { name: "Publicar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/mural/posts")?.body;
    })
    .toEqual({
      glyph: "🎉",
      title: "Boas-vindas!",
      body: "Damos as boas-vindas ao novo time de suporte.",
    });
});

test("a failed post creation shows an inline error without closing the dialog", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, { muralPosts: [], birthdays: [] });
  await seedResponse(request, {
    method: "POST",
    path: "/mural/posts",
    status: 500,
    response: { message: "Internal server error" },
  });

  await page.goto("/mural");
  await page.getByRole("button", { name: "+ Novo post" }).click();
  await page.getByLabel("Emoji").fill("🎉");
  await page.getByLabel("Título").fill("Boas-vindas!");
  await page.getByLabel("Mensagem").fill("Corpo.");
  await page.getByRole("button", { name: "Publicar" }).click();

  await expect(page.getByText("Não foi possível publicar (código 500).")).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `NEXT_PUBLIC_API_URL=http://localhost:3000 pnpm exec playwright test e2e/mural.spec.ts --reporter=list`
(If port 3000 is occupied by a locally running `apps/api` dev server, stop it first — `netstat -ano | findstr :3000` on Windows / check the background task list — then restart it after this task's final verification.)
Expected: the 4 new tests FAIL (button/dialog don't exist yet); all pre-existing tests in this file still PASS.

- [ ] **Step 3: Write minimal implementation**

Append to `apps/web/src/app/(app)/mural/actions.ts` (the file already has `"use server"`, `apiFetch`/`revalidatePath` imports, and `toggleMuralReaction` — add this at the end):
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

Create `apps/web/src/app/(app)/mural/novo-post-dialog.tsx`:
```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";

import { createMuralPost } from "./actions";
import styles from "./mural.module.css";

export function NovoPostDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createMuralPost, {
    error: null,
    success: false,
    successToken: 0,
  });

  useEffect(() => {
    if (state.success) {
      dialogRef.current?.close();
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.successToken]);

  return (
    <>
      <button
        type="button"
        className={styles.addButton}
        onClick={() => dialogRef.current?.showModal()}
      >
        + Novo post
      </button>

      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Novo post no mural</p>
        <form ref={formRef} action={formAction}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Emoji</span>
            <input type="text" name="glyph" required maxLength={4} placeholder="🎉" className={styles.fieldInput} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Título</span>
            <input type="text" name="title" required className={styles.fieldInput} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Mensagem</span>
            <textarea name="body" required className={styles.fieldTextarea} />
          </label>
          {state.error ? <span className={styles.error}>{state.error}</span> : null}
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={styles.dialogClose}
              onClick={() => {
                dialogRef.current?.close();
                formRef.current?.reset();
              }}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.saveButton} disabled={pending}>
              Publicar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
```

In `apps/web/src/app/(app)/mural/page.tsx`:
1. Add the import: `import { NovoPostDialog } from "./novo-post-dialog";`
2. In `TeamView`, delete the early-return block:
```typescript
if (posts.length === 0 && birthdays.length === 0) {
  return (
    <EmptyState
      title="Mural"
      description="Os comunicados publicados no mural vão aparecer aqui."
    />
  );
}
```
3. In `TeamView`'s returned JSX, replace:
```tsx
<h1 className={styles.heading}>Mural</h1>
```
with:
```tsx
<div className={styles.headingRow}>
  <h1 className={styles.heading}>Mural</h1>
  <NovoPostDialog />
</div>
```
(`ColaboradorView` is untouched — its own early-return `EmptyState` and its own `<h1>Mural</h1>` stay exactly as they are.)

Append to `apps/web/src/app/(app)/mural/mural.module.css`:
```css
.headingRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.addButton {
  appearance: none;
  border: none;
  border-radius: 8px;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-background);
  background: var(--color-text);
  cursor: pointer;
}

.addButton:hover {
  opacity: 0.85;
}

.dialog {
  margin: auto;
  border: none;
  border-radius: 12px;
  padding: 24px;
  width: min(640px, calc(100vw - 48px));
  max-height: 85vh;
  overflow-y: auto;
  background: var(--color-background);
  color: var(--color-text);
}

.dialog::backdrop {
  background: rgba(0, 0, 0, 0.4);
}

.dialogTitle {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px;
}

.dialogActions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.dialogClose {
  appearance: none;
  border: 1px solid var(--color-background-selected);
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  background: transparent;
  cursor: pointer;
}

.dialogClose:hover {
  background: var(--color-background-selected);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.fieldLabel {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.fieldInput {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--color-background-selected);
  background: var(--color-background);
  color: var(--color-text);
  font-size: 14px;
}

.fieldTextarea {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--color-background-selected);
  background: var(--color-background);
  color: var(--color-text);
  font-size: 14px;
  min-height: 80px;
  resize: vertical;
  font-family: inherit;
}

.saveButton {
  appearance: none;
  border: none;
  border-radius: 8px;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-background);
  background: var(--color-text);
  cursor: pointer;
}

.saveButton:hover {
  opacity: 0.85;
}

.saveButton:disabled {
  opacity: 0.5;
  cursor: default;
}

.error {
  font-size: 13px;
  color: var(--color-text);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `NEXT_PUBLIC_API_URL=http://localhost:3000 pnpm exec playwright test e2e/mural.spec.ts --reporter=list`
Expected: PASS, all tests in the file (existing + 4 new)

- [ ] **Step 5: Type-check and lint**

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: no errors
Run: `pnpm exec eslint src/app/\(app\)/mural/ src/app/\(app\)/mural/novo-post-dialog.tsx`
Expected: no errors

- [ ] **Step 6: Run the full web e2e suite to check for regressions**

Run: `NEXT_PUBLIC_API_URL=http://localhost:3000 pnpm exec playwright test --reporter=list`
Expected: PASS, except the pre-existing, unrelated failures already present on `master` before this plan (`auth.spec.ts` SSO test, two `esqueci-senha.spec.ts` tests, `login.spec.ts` wrong-credentials test, and an intermittently-flaky `search.spec.ts` Ctrl+K test under heavy machine load) — if any *other* test fails, investigate before committing.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(app\)/mural/actions.ts apps/web/src/app/\(app\)/mural/novo-post-dialog.tsx apps/web/src/app/\(app\)/mural/page.tsx apps/web/src/app/\(app\)/mural/mural.module.css apps/web/e2e/mural.spec.ts
git commit -m "feat(web): add the Novo post dialog to the Mural page"
```

---

## Final Verification

After all 5 tasks:
- [ ] Run `pnpm exec jest` from `packages/shared-types` — all pass.
- [ ] Run `pnpm exec jest` from `apps/api` — all pass.
- [ ] Run `NEXT_PUBLIC_API_URL=http://localhost:3000 pnpm exec playwright test --reporter=list` from `apps/web` — all pass except the known pre-existing failures listed in Task 5 Step 6.
- [ ] Manually verify in the browser: log in as `rh-1` or a `gestor` account, open `/mural`, click "+ Novo post", submit a post, confirm it appears in the list and (with a second browser/session logged in as a different active employee) that a new unread notification appears in that account's bell.
