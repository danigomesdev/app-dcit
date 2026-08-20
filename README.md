# Ponto DCIT

MVP scaffold: NestJS API + Next.js web + Expo mobile, in a pnpm/Turborepo monorepo.

For the full architecture and functional spec, see
[`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md)
and [`docs/spec-funcional.md`](docs/spec-funcional.md).

## Prerequisites

- Node 24 (see `.nvmrc`)
- [corepack](https://nodejs.org/api/corepack.html) enabled (`corepack enable`), which provides the
  pinned `pnpm` version declared in the root `package.json`

## Getting started

```bash
# 1. Install dependencies (also runs `prisma generate` for apps/api via postinstall)
pnpm install

# 2. Configure the API's database
cp apps/api/.env.example apps/api/.env

# 3. Apply Prisma migrations
pnpm --filter @ponto-dcit/api exec prisma migrate deploy
# (use `migrate dev` instead of `migrate deploy` if you're actively developing schema changes)

# 4. Build and test everything
pnpm turbo run build
pnpm turbo run test
```

> If `turbo` fails to spawn on your machine (some Windows AV/EDR setups block `turbo.exe`), fall
> back to running the same script per package, e.g. `pnpm --filter @ponto-dcit/api run build`.

## Running each app in development

```bash
pnpm --filter @ponto-dcit/api start:dev     # NestJS API, http://localhost:3000
pnpm --filter @ponto-dcit/web dev           # Next.js web app, http://localhost:3001
pnpm --filter @ponto-dcit/mobile start      # Expo dev server (scan the QR code or press w)
```

## Database

The API uses SQLite via Prisma for local development (`apps/api/.env` → `apps/api/prisma/dev.db`,
gitignored). A Postgres setup via Docker Compose is already written at
`infra/docker/docker-compose.yml` for a future move to a shared database, but it isn't wired up
yet — Docker isn't installed on the reference dev machine for this project.

## Repo layout

- `apps/api` — NestJS API (Prisma + SQLite)
- `apps/web` — Next.js web app
- `apps/mobile` — Expo/React Native app
- `packages/shared-types` — shared TypeScript types/schemas (zod) used by API and mobile
- `infra/docker` — Postgres docker-compose (not yet activated)
