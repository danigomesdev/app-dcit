# Auth/SSO Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `apps/api` a real, working OIDC login flow — backed by a local mock identity provider — that issues its own signed JWT session and protects `POST /time-entries` with it, replacing today's client-supplied `userId`. No web/mobile UI in this plan; that is a separate follow-up plan once this is merged.

**Architecture:** A new dev-only OIDC provider (`infra/mock-idp`, using `oidc-provider`) simulates the corporate IdP (the real provider — likely Microsoft Entra ID — is not yet confirmed by IT; the module is built against the standard OIDC protocol so swapping providers later is a config change, not a code change). A new `apps/api` `auth` module (`openid-client` as the OIDC client) drives the Authorization Code flow as the sole party that ever talks to the IdP directly (backend-for-frontend pattern), and issues its own JWT (`@nestjs/jwt`) carrying `sub`/`role`/`name`. `POST /time-entries` is protected by a new `AuthGuard` and now takes the authenticated user's id from the JWT instead of trusting the request body.

**Tech Stack:** `oidc-provider` (mock IdP), `openid-client` v5 (OIDC client, CommonJS-compatible — v6 is ESM-only and deliberately avoided here to keep this NestJS/CommonJS codebase's build simple), `@nestjs/jwt`, Jest.

**Spec:** `docs/superpowers/specs/2026-08-24-auth-sso-design.md`

## Global Constraints

- TypeScript ponta a ponta in `apps/api` and `packages/shared-types`; `infra/mock-idp` is plain Node.js (dev-only tooling, not a product app — matches the existing convention of `apps/mobile/eslint.config.js`/`scripts/reset-project.js` being plain JS in an otherwise-TS app).
- Backend-for-frontend: only `apps/api` ever talks to the OIDC provider. No token from the IdP is ever exposed to a client.
- RBAC roles for this pass: exactly `colaborador | gestor | rh` (an enum, extensible later — do not add other roles now).
- This plan does not touch `apps/web` or `apps/mobile`. `packages/shared-types`'s `TimeEntryInputSchema` keeps its current shape (including `userId`) for backward compatibility with the mobile app's existing (unauthenticated) payload — the API now ignores the body's `userId` and uses the authenticated identity instead, but the schema itself is not tightened in this plan (that happens in the follow-up plan, alongside updating the mobile app to stop sending it).
- No refresh-token/session-renewal logic — sessions simply expire and require a new login. Out of scope for this MVP pass.
- Follow existing `apps/api` conventions: single-quote style (Prettier), one `.spec.ts` per source file, `Test.createTestingModule` for unit tests.

---

## File Structure

```
pnpm-workspace.yaml                          # modified — add infra/*
infra/
  mock-idp/
    package.json
    server.js
    server.test.js
    README.md
packages/
  shared-types/
    src/
      role.ts
      role.test.ts
      index.ts                               # modified — export Role
apps/
  api/
    package.json                             # modified — add @nestjs/jwt, openid-client
    .env.example                             # modified — add OIDC_*/JWT_SECRET/WEB_APP_URL
    src/
      auth/
        auth.module.ts
        auth.service.ts
        auth.service.spec.ts
        auth.controller.ts
        auth.controller.spec.ts
        auth-guard.ts
        auth-guard.spec.ts
        authenticated-user.ts
      time-entries/
        time-entries.controller.ts            # modified — AuthGuard + authenticated userId
        time-entries.controller.spec.ts        # modified
        time-entries.module.ts                 # modified — import AuthModule
      app.module.ts                            # modified — import AuthModule
```

---

### Task 1: `infra/mock-idp` — local OIDC provider for development and tests

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `infra/mock-idp/package.json`
- Create: `infra/mock-idp/server.js`
- Test: `infra/mock-idp/server.test.js`
- Create: `infra/mock-idp/README.md`

**Interfaces:**
- Consumes: nothing (leaf service).
- Produces: an OIDC-compliant provider at `http://localhost:9000` (when run standalone via `pnpm --filter @ponto-dcit/mock-idp start`), with one registered client (`ponto-dcit` / `dev-secret`, redirect URI `http://localhost:3000/auth/callback`) and 3 seeded accounts (`colaborador-1`, `gestor-1`, `rh-1`), each exposing a `dcit_role` claim. Task 3 (`apps/api` auth module) is the consumer, via `openid-client`'s discovery against this issuer.

- [ ] **Step 1: Add `infra/*` to the pnpm workspace**

Edit `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "infra/*"
```

- [ ] **Step 2: Write `infra/mock-idp/package.json`**

```json
{
  "name": "@ponto-dcit/mock-idp",
  "version": "0.1.0",
  "private": true,
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "jest"
  },
  "dependencies": {
    "oidc-provider": "^8.5.0"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

- [ ] **Step 3: Write the failing test — `infra/mock-idp/server.test.js`**

```js
const http = require('http');
const { provider, ACCOUNTS, findAccount } = require('./server');

describe('mock IdP', () => {
  let server;
  let baseUrl;

  beforeAll((done) => {
    server = http.createServer(provider.callback());
    server.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('exposes OIDC discovery metadata', async () => {
    const response = await fetch(`${baseUrl}/.well-known/openid-configuration`);
    expect(response.status).toBe(200);

    const metadata = await response.json();
    expect(metadata.authorization_endpoint).toContain('/auth');
    expect(metadata.token_endpoint).toContain('/token');
    expect(metadata.scopes_supported).toEqual(
      expect.arrayContaining(['openid', 'profile', 'email']),
    );
  });

  it('resolves claims for each seeded account', async () => {
    for (const [id, expectedClaims] of Object.entries(ACCOUNTS)) {
      const account = await findAccount(null, id);
      expect(account).toBeDefined();
      expect(account.accountId).toBe(id);
      await expect(account.claims()).resolves.toEqual(expectedClaims);
    }
  });

  it('returns undefined for an unknown account id', async () => {
    const account = await findAccount(null, 'does-not-exist');
    expect(account).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @ponto-dcit/mock-idp test`
Expected: FAIL — `Cannot find module './server'`.

- [ ] **Step 5: Write `infra/mock-idp/server.js`**

```js
'use strict';

const { Provider } = require('oidc-provider');

const PORT = process.env.PORT || 9000;
const ISSUER = `http://localhost:${PORT}`;

const ACCOUNTS = {
  'colaborador-1': {
    sub: 'colaborador-1',
    name: 'Ana Colaboradora',
    email: 'colaborador@dev.local',
    dcit_role: 'colaborador',
  },
  'gestor-1': {
    sub: 'gestor-1',
    name: 'Bruno Gestor',
    email: 'gestor@dev.local',
    dcit_role: 'gestor',
  },
  'rh-1': {
    sub: 'rh-1',
    name: 'Carla RH',
    email: 'rh@dev.local',
    dcit_role: 'rh',
  },
};

async function findAccount(_ctx, id) {
  const claims = ACCOUNTS[id];
  if (!claims) {
    return undefined;
  }
  return {
    accountId: id,
    async claims() {
      return claims;
    },
  };
}

const configuration = {
  clients: [
    {
      client_id: 'ponto-dcit',
      client_secret: 'dev-secret',
      redirect_uris: ['http://localhost:3000/auth/callback'],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
    },
  ],
  features: {
    devInteractions: { enabled: true },
  },
  claims: {
    openid: ['sub'],
    profile: ['name', 'dcit_role'],
    email: ['email'],
  },
  findAccount,
};

const provider = new Provider(ISSUER, configuration);

if (require.main === module) {
  provider.listen(PORT, () => {
    console.log(`Mock IdP listening at ${ISSUER}`);
    console.log('Seeded accounts (type the sub on the dev sign-in screen): colaborador-1, gestor-1, rh-1');
  });
}

module.exports = { provider, ACCOUNTS, findAccount, ISSUER };
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm install && pnpm --filter @ponto-dcit/mock-idp test`
Expected: PASS — 3 tests green.

- [ ] **Step 7: Write `infra/mock-idp/README.md`**

```markdown
# Mock IdP

A local OIDC provider (`oidc-provider`) standing in for the DCIT corporate IdP
(provider not yet confirmed by IT — likely Microsoft Entra ID, but this mock
speaks the standard OIDC protocol so swapping the real provider in later is a
config change in `apps/api`, not a code change).

## Running

```bash
pnpm --filter @ponto-dcit/mock-idp start
```

Listens on `http://localhost:9000`.

## Seeded accounts

Three accounts, one per role. On the built-in dev sign-in screen (enabled via
`features.devInteractions`), type the account's `sub` (not an email/password —
this is a throwaway dev mock, not a real login):

| sub | role | name |
|---|---|---|
| `colaborador-1` | `colaborador` | Ana Colaboradora |
| `gestor-1` | `gestor` | Bruno Gestor |
| `rh-1` | `rh` | Carla RH |

## Registered client

- `client_id`: `ponto-dcit`
- `client_secret`: `dev-secret`
- `redirect_uris`: `http://localhost:3000/auth/callback` (the API's callback route)

These match `apps/api/.env.example`'s `OIDC_*` values.
```

- [ ] **Step 8: Commit**

```bash
git add pnpm-workspace.yaml infra/mock-idp
git commit -m "feat(mock-idp): add local OIDC provider for development and tests"
```

---

### Task 2: `packages/shared-types` — `Role` schema

**Files:**
- Create: `packages/shared-types/src/role.ts`
- Test: `packages/shared-types/src/role.test.ts`
- Modify: `packages/shared-types/src/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `RoleSchema` (Zod enum) and `Role` (inferred TS type: `"colaborador" | "gestor" | "rh"`), exported from `@ponto-dcit/shared-types`. Task 3 imports `Role` for the JWT payload type and the role-resolution logic.

- [ ] **Step 1: Write the failing test — `packages/shared-types/src/role.test.ts`**

```typescript
import { RoleSchema } from "./role";

describe("RoleSchema", () => {
  it("accepts each known role", () => {
    for (const role of ["colaborador", "gestor", "rh"]) {
      expect(RoleSchema.safeParse(role).success).toBe(true);
    }
  });

  it("rejects an unknown role", () => {
    expect(RoleSchema.safeParse("admin").success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ponto-dcit/shared-types test`
Expected: FAIL — `Cannot find module './role'`.

- [ ] **Step 3: Write `packages/shared-types/src/role.ts`**

```typescript
import { z } from "zod";

export const RoleSchema = z.enum(["colaborador", "gestor", "rh"]);
export type Role = z.infer<typeof RoleSchema>;
```

- [ ] **Step 4: Update `packages/shared-types/src/index.ts`**

```typescript
export { TimeEntryInputSchema } from "./time-entry";
export type { TimeEntryInput } from "./time-entry";
export { RoleSchema } from "./role";
export type { Role } from "./role";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @ponto-dcit/shared-types test`
Expected: PASS — 2 new tests green, plus the 3 existing `TimeEntryInputSchema` tests still green (unchanged).

- [ ] **Step 6: Build the package**

Run: `pnpm --filter @ponto-dcit/shared-types build`
Expected: no errors; `dist/role.js`/`dist/role.d.ts` created.

- [ ] **Step 7: Commit**

```bash
git add packages/shared-types
git commit -m "feat(shared-types): add Role schema"
```

---

### Task 3: `apps/api` — `auth` module (OIDC login, JWT session)

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/.env.example`
- Create: `apps/api/src/auth/authenticated-user.ts`
- Create: `apps/api/src/auth/auth-guard.ts`
- Test: `apps/api/src/auth/auth-guard.spec.ts`
- Create: `apps/api/src/auth/auth.service.ts`
- Test: `apps/api/src/auth/auth.service.spec.ts`
- Create: `apps/api/src/auth/auth.controller.ts`
- Test: `apps/api/src/auth/auth.controller.spec.ts`
- Create: `apps/api/src/auth/auth.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `Role` from `@ponto-dcit/shared-types` (Task 2); the mock IdP from Task 1 (only at real app boot / manual verification, never in unit tests — see Step 12).
- Produces: `AuthGuard` (exported from `AuthModule`) — a NestJS `CanActivate` that reads `Authorization: Bearer <jwt>`, verifies it, and sets `request.user: AuthenticatedUser`. `AuthenticatedUser = { sub: string; role: Role; name: string }`. Task 4 consumes both directly.

- [ ] **Step 1: Add dependencies to `apps/api`**

Run:
```bash
pnpm --filter @ponto-dcit/api add @nestjs/jwt openid-client@^5.6.5
```

- [ ] **Step 2: Add auth config to `apps/api/.env.example`**

```
DATABASE_URL="file:./dev.db"
OIDC_ISSUER_URL="http://localhost:9000"
OIDC_CLIENT_ID="ponto-dcit"
OIDC_CLIENT_SECRET="dev-secret"
OIDC_REDIRECT_URI="http://localhost:3000/auth/callback"
JWT_SECRET="dev-only-change-me"
WEB_APP_URL="http://localhost:3001"
```

(These match `infra/mock-idp`'s registered client from Task 1. Also copy these into your local `apps/api/.env` — gitignored, not committed — before running the manual verification in Step 12.)

- [ ] **Step 3: Write `apps/api/src/auth/authenticated-user.ts`**

```typescript
import type { Role } from '@ponto-dcit/shared-types';

export type AuthenticatedUser = {
  sub: string;
  role: Role;
  name: string;
};
```

- [ ] **Step 4: Write the failing test — `apps/api/src/auth/auth-guard.spec.ts`**

```typescript
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth-guard';

describe('AuthGuard', () => {
  const jwtMock = { verify: jest.fn() };
  const guard = new AuthGuard(jwtMock as unknown as JwtService);

  function contextWithHeader(header?: string): ExecutionContext {
    const request: Record<string, unknown> = {
      headers: header ? { authorization: header } : {},
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => jest.clearAllMocks());

  it('allows the request and attaches the decoded user when the token is valid', () => {
    jwtMock.verify.mockReturnValue({
      sub: 'user-1',
      role: 'colaborador',
      name: 'Ana',
    });
    const context = contextWithHeader('Bearer good-token');

    expect(guard.canActivate(context)).toBe(true);
    const request = context.switchToHttp().getRequest() as { user: unknown };
    expect(request.user).toEqual({ sub: 'user-1', role: 'colaborador', name: 'Ana' });
  });

  it('rejects a request with no Authorization header', () => {
    expect(() => guard.canActivate(contextWithHeader())).toThrow(UnauthorizedException);
  });

  it('rejects a request whose token fails verification', () => {
    jwtMock.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    expect(() => guard.canActivate(contextWithHeader('Bearer bad-token'))).toThrow(
      UnauthorizedException,
    );
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm --filter @ponto-dcit/api test -- auth-guard.spec.ts`
Expected: FAIL — `Cannot find module './auth-guard'`.

- [ ] **Step 6: Write `apps/api/src/auth/auth-guard.ts`**

```typescript
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthenticatedUser } from './authenticated-user';

type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      request.user = this.jwt.verify<AuthenticatedUser>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter @ponto-dcit/api test -- auth-guard.spec.ts`
Expected: PASS — 3 tests green.

- [ ] **Step 8: Write the failing test — `apps/api/src/auth/auth.service.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OIDC_CLIENT } from './auth.module';

describe('AuthService', () => {
  let service: AuthService;
  let jwt: { sign: jest.Mock };

  const clientMock = {
    authorizationUrl: jest.fn(),
    callback: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: OIDC_CLIENT, useValue: clientMock },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('builds an authorization URL requesting openid/profile/email', () => {
    clientMock.authorizationUrl.mockReturnValue('https://mock-idp/auth?state=abc');

    const url = service.buildAuthorizationUrl('web');

    expect(url).toBe('https://mock-idp/auth?state=abc');
    expect(clientMock.authorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'openid profile email' }),
    );
  });

  it('exchanges a valid callback and issues a session JWT with the resolved role', async () => {
    clientMock.authorizationUrl.mockReturnValue('https://mock-idp/auth');
    service.buildAuthorizationUrl('mobile');
    const { state } = clientMock.authorizationUrl.mock.calls[0][0];

    clientMock.callback.mockResolvedValue({
      claims: () => ({ sub: 'user-1', name: 'Ana Colaboradora', dcit_role: 'colaborador' }),
    });

    const result = await service.handleCallback('http://localhost:3000/auth/callback', {
      state,
      code: 'auth-code-123',
    });

    expect(result).toEqual({ sessionToken: 'signed.jwt.token', origin: 'mobile' });
    expect(jwt.sign).toHaveBeenCalledWith({
      sub: 'user-1',
      role: 'colaborador',
      name: 'Ana Colaboradora',
    });
  });

  it('rejects a callback with an unknown or expired state', async () => {
    await expect(
      service.handleCallback('http://localhost:3000/auth/callback', {
        state: 'never-issued',
        code: 'x',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a callback whose role claim is not one of the known roles', async () => {
    clientMock.authorizationUrl.mockReturnValue('https://mock-idp/auth');
    service.buildAuthorizationUrl('web');
    const { state } = clientMock.authorizationUrl.mock.calls[0][0];

    clientMock.callback.mockResolvedValue({
      claims: () => ({ sub: 'user-2', name: 'X', dcit_role: 'admin' }),
    });

    await expect(
      service.handleCallback('http://localhost:3000/auth/callback', { state, code: 'y' }),
    ).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 9: Run the test to verify it fails**

Run: `pnpm --filter @ponto-dcit/api test -- auth.service.spec.ts`
Expected: FAIL — `Cannot find module './auth.service'` (and `./auth.module`).

- [ ] **Step 10: Write `apps/api/src/auth/auth.service.ts`**

```typescript
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { generators, type Client } from 'openid-client';
import type { Role } from '@ponto-dcit/shared-types';
import { OIDC_CLIENT } from './auth.module';

type LoginOrigin = 'web' | 'mobile';
type PendingLogin = { nonce: string; origin: LoginOrigin };

@Injectable()
export class AuthService {
  private readonly pendingLogins = new Map<string, PendingLogin>();

  constructor(
    @Inject(OIDC_CLIENT) private readonly client: Client,
    private readonly jwt: JwtService,
  ) {}

  buildAuthorizationUrl(origin: LoginOrigin): string {
    const state = generators.state();
    const nonce = generators.nonce();
    this.pendingLogins.set(state, { nonce, origin });

    return this.client.authorizationUrl({
      scope: 'openid profile email',
      state,
      nonce,
    });
  }

  async handleCallback(
    redirectUri: string,
    params: Record<string, string>,
  ): Promise<{ sessionToken: string; origin: LoginOrigin }> {
    const pending = params.state ? this.pendingLogins.get(params.state) : undefined;
    if (!pending) {
      throw new BadRequestException('Unknown or expired login attempt');
    }
    this.pendingLogins.delete(params.state);

    const tokenSet = await this.client.callback(redirectUri, params, {
      state: params.state,
      nonce: pending.nonce,
    });
    const claims = tokenSet.claims() as { sub: string; name?: string; dcit_role?: unknown };
    const role = this.resolveRole(claims.dcit_role);

    const sessionToken = this.jwt.sign({
      sub: claims.sub,
      role,
      name: claims.name,
    });

    return { sessionToken, origin: pending.origin };
  }

  private resolveRole(claim: unknown): Role {
    if (claim === 'colaborador' || claim === 'gestor' || claim === 'rh') {
      return claim;
    }
    throw new BadRequestException(`Unrecognized role claim: ${String(claim)}`);
  }
}
```

- [ ] **Step 11: Write `apps/api/src/auth/auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Issuer, type Client } from 'openid-client';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth-guard';

export const OIDC_CLIENT = Symbol('OIDC_CLIENT');

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    {
      provide: OIDC_CLIENT,
      useFactory: async (): Promise<Client> => {
        const issuer = await Issuer.discover(process.env.OIDC_ISSUER_URL as string);
        return new issuer.Client({
          client_id: process.env.OIDC_CLIENT_ID as string,
          client_secret: process.env.OIDC_CLIENT_SECRET as string,
          redirect_uris: [process.env.OIDC_REDIRECT_URI as string],
          response_types: ['code'],
        });
      },
    },
  ],
  exports: [AuthGuard],
})
export class AuthModule {}
```

`JwtModule.registerAsync` (not `.register`) is deliberate: `.register` reads `process.env.JWT_SECRET` at module-decorator-evaluation time, which — same root cause as the existing `apps/api/src/main.ts` `.env` fix (see `git log --oneline -- apps/api/src/main.ts`) — runs *before* `main.ts`'s `process.loadEnvFile(envPath)` call, since `import`/`require` of `AppModule` happens before that line executes. `registerAsync`'s factory runs later, during Nest's DI instantiation inside `NestFactory.create()`, by which point the env file is already loaded.

- [ ] **Step 12: Run the test to verify it passes**

Run: `pnpm --filter @ponto-dcit/api test -- auth.service.spec.ts`
Expected: PASS — 4 tests green. (This test never triggers the `OIDC_CLIENT` factory's real `Issuer.discover()` call — it's replaced by `clientMock` via `useValue` — so the mock IdP does not need to be running for this test.)

- [ ] **Step 13: Write the failing test — `apps/api/src/auth/auth.controller.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  const authServiceMock = {
    buildAuthorizationUrl: jest.fn(),
    handleCallback: jest.fn(),
  };

  function mockResponse(): Response {
    return {
      redirect: jest.fn(),
      json: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as Response;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    }).compile();

    controller = module.get(AuthController);
  });

  it('redirects to the authorization URL for a web login', () => {
    authServiceMock.buildAuthorizationUrl.mockReturnValue('https://mock-idp/auth');
    const res = mockResponse();

    controller.login('web', res);

    expect(authServiceMock.buildAuthorizationUrl).toHaveBeenCalledWith('web');
    expect(res.redirect).toHaveBeenCalledWith('https://mock-idp/auth');
  });

  it('defaults to web origin when none is given', () => {
    authServiceMock.buildAuthorizationUrl.mockReturnValue('https://mock-idp/auth');
    const res = mockResponse();

    controller.login(undefined as unknown as string, res);

    expect(authServiceMock.buildAuthorizationUrl).toHaveBeenCalledWith('web');
  });

  it('sets a session cookie and redirects for a web callback', async () => {
    authServiceMock.handleCallback.mockResolvedValue({ sessionToken: 'jwt-1', origin: 'web' });
    const req = { query: { state: 's', code: 'c' } } as unknown as Request;
    const res = mockResponse();

    await controller.callback(req, res);

    expect(res.cookie).toHaveBeenCalledWith(
      'ponto_session',
      'jwt-1',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(res.redirect).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('returns the token as JSON for a mobile callback', async () => {
    authServiceMock.handleCallback.mockResolvedValue({ sessionToken: 'jwt-2', origin: 'mobile' });
    const req = { query: { state: 's', code: 'c' } } as unknown as Request;
    const res = mockResponse();

    await controller.callback(req, res);

    expect(res.json).toHaveBeenCalledWith({ token: 'jwt-2' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('clears the session cookie on logout', () => {
    const res = mockResponse();

    controller.logout(res);

    expect(res.clearCookie).toHaveBeenCalledWith('ponto_session');
  });
});
```

- [ ] **Step 14: Run the test to verify it fails**

Run: `pnpm --filter @ponto-dcit/api test -- auth.controller.spec.ts`
Expected: FAIL — `Cannot find module './auth.controller'`.

- [ ] **Step 15: Write `apps/api/src/auth/auth.controller.ts`**

```typescript
import { Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login')
  login(@Query('origin') origin: string, @Res() res: Response) {
    const safeOrigin = origin === 'mobile' ? 'mobile' : 'web';
    const url = this.authService.buildAuthorizationUrl(safeOrigin);
    res.redirect(url);
  }

  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    const { sessionToken, origin } = await this.authService.handleCallback(
      process.env.OIDC_REDIRECT_URI as string,
      req.query as Record<string, string>,
    );

    if (origin === 'mobile') {
      res.json({ token: sessionToken });
      return;
    }

    res.cookie('ponto_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });
    res.redirect(process.env.WEB_APP_URL ?? 'http://localhost:3001');
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('ponto_session');
  }
}
```

- [ ] **Step 16: Run the test to verify it passes**

Run: `pnpm --filter @ponto-dcit/api test -- auth.controller.spec.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 17: Register `AuthModule` in `apps/api/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [AuthModule, TimeEntriesModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 18: Run the full `apps/api` test suite**

Run: `pnpm --filter @ponto-dcit/api test`
Expected: PASS — every spec green, including the pre-existing `health`/`time-entries` specs (unaffected by this task).

- [ ] **Step 19: Commit**

```bash
git add apps/api/package.json apps/api/.env.example apps/api/src/auth apps/api/src/app.module.ts pnpm-lock.yaml
git commit -m "feat(api): add auth module with OIDC login and JWT sessions"
```

---

### Task 4: `apps/api` — protect `POST /time-entries` with `AuthGuard`

**Files:**
- Modify: `apps/api/src/time-entries/time-entries.controller.ts`
- Modify: `apps/api/src/time-entries/time-entries.controller.spec.ts`
- Modify: `apps/api/src/time-entries/time-entries.module.ts`

**Interfaces:**
- Consumes: `AuthGuard`, `AuthenticatedUser` from `../auth/*` (Task 3).
- Produces: `POST /time-entries` now requires `Authorization: Bearer <jwt>`; the persisted `userId` comes from the JWT's `sub`, never from the request body (a `userId` field in the body, if sent, is parsed but discarded — this keeps the mobile app's current payload shape working without a breaking change, while removing the actual trust issue).

- [ ] **Step 1: Write the failing test — replace `apps/api/src/time-entries/time-entries.controller.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './time-entries.service';
import { AuthGuard } from '../auth/auth-guard';
import type { AuthenticatedUser } from '../auth/authenticated-user';

describe('TimeEntriesController', () => {
  let controller: TimeEntriesController;
  const serviceMock = { create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimeEntriesController],
      providers: [{ provide: TimeEntriesService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(TimeEntriesController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return {
      user: { sub, role: 'colaborador', name: 'Test User' },
    } as Request & { user: AuthenticatedUser };
  }

  it('delegates a valid payload to the service using the authenticated user id', async () => {
    serviceMock.create.mockResolvedValue({
      id: '1',
      userId: 'user-123',
      clockedAt: new Date(),
      createdAt: new Date(),
    });

    await controller.create(
      { userId: 'user-123', clockedAt: '2026-08-19T13:00:00.000Z' },
      requestAs('user-123'),
    );

    expect(serviceMock.create).toHaveBeenCalledWith({
      userId: 'user-123',
      clockedAt: '2026-08-19T13:00:00.000Z',
    });
  });

  it('ignores a userId in the request body and uses the authenticated user instead', async () => {
    serviceMock.create.mockResolvedValue({
      id: '2',
      userId: 'authenticated-user',
      clockedAt: new Date(),
      createdAt: new Date(),
    });

    await controller.create(
      { userId: 'someone-else', clockedAt: '2026-08-19T13:00:00.000Z' },
      requestAs('authenticated-user'),
    );

    expect(serviceMock.create).toHaveBeenCalledWith({
      userId: 'authenticated-user',
      clockedAt: '2026-08-19T13:00:00.000Z',
    });
  });

  it('rejects an invalid payload before calling the service', async () => {
    await expect(
      controller.create(
        { userId: '', clockedAt: 'not-a-date' },
        requestAs('user-123'),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ponto-dcit/api test -- time-entries.controller.spec.ts`
Expected: FAIL — `controller.create` still has the old 1-argument signature (TS compile error) / `Cannot find module '../auth/auth-guard'` is already resolved from Task 3, so the failure here is a type mismatch on `create`'s signature, not a missing module.

- [ ] **Step 3: Update `apps/api/src/time-entries/time-entries.controller.ts`**

```typescript
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TimeEntryInputSchema } from '@ponto-dcit/shared-types';
import { TimeEntriesService } from './time-entries.service';
import { AuthGuard } from '../auth/auth-guard';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('time-entries')
export class TimeEntriesController {
  constructor(private readonly timeEntries: TimeEntriesService) {}

  @UseGuards(AuthGuard)
  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = TimeEntryInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.timeEntries.create({
      userId: req.user.sub,
      clockedAt: result.data.clockedAt,
    });
  }
}
```

- [ ] **Step 4: Update `apps/api/src/time-entries/time-entries.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './time-entries.service';
import { PrismaService } from './prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService, PrismaService],
})
export class TimeEntriesModule {}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @ponto-dcit/api test -- time-entries.controller.spec.ts`
Expected: PASS — 3 tests green (the middle one is new; the other two match the pre-existing behavior, now with an authenticated request).

- [ ] **Step 6: Run the full `apps/api` test suite**

Run: `pnpm --filter @ponto-dcit/api test`
Expected: PASS — every spec green, including `time-entries.service.spec.ts` (unchanged — the service's `create` signature was never touched, only the controller changed which value it passes as `userId`).

- [ ] **Step 7: Manual end-to-end verification**

The interactive OIDC dance (the mock IdP's sign-in screen) isn't exercised by the automated suite — verify it once by hand:

```bash
# Terminal 1
pnpm --filter @ponto-dcit/mock-idp start

# Terminal 2 — make sure apps/api/.env has the OIDC_*/JWT_SECRET values from Step 2 of Task 3
pnpm --filter @ponto-dcit/api start:dev
```

Open `http://localhost:3000/auth/login?origin=mobile` in a browser. On the mock IdP's sign-in screen, enter `colaborador-1` as the account, and accept the consent screen. Expected: the browser lands on a JSON response `{"token":"<a long JWT string>"}`.

Copy that token and verify the protected endpoint:

```bash
curl -X POST http://localhost:3000/time-entries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <paste the token here>" \
  -d '{"userId":"ignored-by-the-server","clockedAt":"2026-08-24T13:00:00.000Z"}'
```

Expected: `201` with a JSON body whose `userId` is `colaborador-1` (the JWT's `sub`), **not** `"ignored-by-the-server"` from the request body. Then verify the guard itself rejects an unauthenticated request:

```bash
curl -i -X POST http://localhost:3000/time-entries \
  -H "Content-Type: application/json" \
  -d '{"userId":"x","clockedAt":"2026-08-24T13:00:00.000Z"}'
```

Expected: `401 Unauthorized`.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/time-entries
git commit -m "feat(api): protect POST /time-entries with AuthGuard"
```

---

## Self-Review Notes

- **Spec coverage:** Design spec section 3 (backend: login/callback/logout endpoints, JWT issuance, `AuthGuard` protecting `time-entries`, `userId` no longer trusted from the client) → Tasks 3–4. Section 6 (RBAC — `colaborador`/`gestor`/`rh` enum) → Task 2. Section 7 (IdP mock, `infra/mock-idp`, `oidc-provider`, 3 seeded accounts) → Task 1. Section 8/"fora de escopo" (web/mobile UI, RBAC per sensitive field, roles beyond the 3, refresh tokens) → explicitly not touched by any task here, matching the Global Constraints.
- **No placeholders:** every step has literal file contents or exact commands; the one place real interactivity can't be automated (the mock IdP's sign-in screen) is called out explicitly as a manual verification step with concrete expected output, not skipped silently.
- **Type/name consistency:** `AuthenticatedUser` (Task 3 Step 3) is the exact type used in Task 3's `auth-guard.ts`/`auth.controller.ts` and Task 4's `time-entries.controller.ts`. `OIDC_CLIENT` token (Task 3 Step 11) matches the import in Task 3 Step 10 (`auth.service.ts`) and Step 8's test. `handleCallback`'s return shape (`{ sessionToken, origin }`, Task 3 Step 10) matches exactly how Task 3 Step 15's `auth.controller.ts` destructures it. `TimeEntriesService.create`'s parameter shape (`{ userId, clockedAt }`) is unchanged from before this plan — Task 4 only changes what the *controller* passes as `userId`, not the service's contract, which is why `time-entries.service.ts`/`time-entries.service.spec.ts` need no changes at all.
- **Env-loading order bug avoided:** `JwtModule.registerAsync` (not `.register`) in Task 3 Step 11, with an inline rationale comment pointing at the repo's own prior fix for the same class of bug (`apps/api/src/main.ts`'s `.env` loading commit) — deliberately chosen so this plan doesn't reintroduce a bug this codebase already hit once.
