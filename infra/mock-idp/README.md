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
