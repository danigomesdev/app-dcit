# Login por email/senha (com recuperação) — Web e Mobile

**Status:** Proposto
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)

## 1. Objetivo e escopo

Hoje o único jeito de entrar no app (web e mobile) é via SSO/OIDC contra o mock-idp — não existe senha, não existe conta local. Decidido em conversa: o login principal passa a ser email/senha, com recuperação de senha (por email ou telefone). O SSO **não é removido** — fica no código, só sem botão nenhum apontando pra ele, pra poder voltar depois se for o caso.

Modo dev/local (decidido em conversa, sem provedor de email/SMS real configurado): "enviar" o código de recuperação é só devolvê-lo na própria resposta da API (mesmo padrão que o mock-idp já usa pro "login" — sem simular envio de verdade).

Fora de escopo (seção 7 tem a lista completa): envio real de email/SMS, hashing/rotação de segredos além do necessário pro ambiente dev, 2FA, políticas de expiração/complexidade de senha além do mínimo razoável.

## 2. Modelo de dados

`Employee` (`apps/api/prisma/schema.prisma`) ganha três campos novos:

```prisma
model Employee {
  // ...campos existentes...
  email        String?   @unique
  phone        String?
  passwordHash String?
}
```

Todos opcionais no schema (times existentes sem senha continuam válidos), mas o login por senha exige `email` + `passwordHash` presentes — ausência de qualquer um dos dois é tratada como "credenciais inválidas" (mesma mensagem genérica de uma senha errada, pra não vazar quais contas têm login por senha habilitado).

`passwordHash`: bcrypt (`bcryptjs`, já não é dependência do projeto — precisa adicionar; puro-JS, sem binário nativo, evita dor de compilação no Windows).

Um `PasswordResetCode` novo:

```prisma
model PasswordResetCode {
  id        String   @id @default(uuid())
  userId    String
  code      String   // 6 dígitos, texto — não é segredo de longa duração, não precisa hash
  expiresAt DateTime // 15 minutos a partir da criação
  usedAt    DateTime?
  createdAt DateTime @default(now())
}
```

## 3. `packages/shared-types`

Novo arquivo `password-auth.ts`:

```typescript
import { z } from "zod";

export const PasswordLoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type PasswordLoginInput = z.infer<typeof PasswordLoginInputSchema>;

export const ForgotPasswordInputSchema = z.object({
  // Aceita email OU telefone — a service decide qual usar pra achar a conta.
  identifier: z.string().min(1),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;

export const ResetPasswordInputSchema = z.object({
  identifier: z.string().min(1),
  code: z.string().length(6),
  newPassword: z.string().min(8),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;
```

## 4. Backend (`apps/api/src/auth`)

### 4.1 `AuthService` — três métodos novos

- `loginWithPassword(email, password): Promise<{sessionToken, role, name}>` — busca `Employee` por email, compara `password` com `bcrypt.compare`, lança `UnauthorizedException` genérica se não bater (email não encontrado OU senha errada OU sem passwordHash cadastrado — mesma mensagem nos três casos). Sucesso: mesmo `jwt.sign({sub, role, name})` que o fluxo OIDC já usa — o resto do sistema (AuthGuard, decodificação client-side) não muda nada.
- `requestPasswordReset(identifier)` — acha o `Employee` por `email` OU `phone`. Sempre responde com sucesso genérico (não revela se a conta existe — só não cria o código se não achar ninguém). Gera código de 6 dígitos aleatório, grava `PasswordResetCode` com `expiresAt = now + 15min`. **Modo dev**: retorna `{ devCode: "123456" }` na resposta em vez de mandar por email/SMS de verdade — flag explícita, não hard-coded pra sempre (ver seção 7).
- `resetPassword(identifier, code, newPassword)` — acha o código mais recente não-usado e não-expirado pro usuário resolvido de `identifier`; se não bater, `BadRequestException` genérica ("código inválido ou expirado"). Sucesso: marca `usedAt`, grava novo `passwordHash`.

### 4.2 `AuthController` — três rotas novas

- `POST /auth/password-login` — `PasswordLoginInputSchema`. Sucesso: mesmo shape que o callback OIDC já devolve pro `origin=web` hoje (seta cookie `ponto_session` e devolve 200 com o nome/role — sem redirect, já que quem chama é um fetch de formulário, não navegação de topo) **e** pro mobile (devolve `{token}` no corpo, sem cookie — mobile já sabe guardar isso via `saveSessionToken`).

  Como o mesmo endpoint serve os dois, o corpo da resposta inclui tanto `token` quanto — quando a origem é web — o cookie via `Set-Cookie`. O cliente web usa o cookie; o cliente mobile usa `token` do corpo e ignora o `Set-Cookie` (não roda em navegador). Distinguir por um campo `origin` no corpo da requisição, mesmo padrão do `?origin=` que a rota SSO já usa.

- `POST /auth/forgot-password` — `ForgotPasswordInputSchema`, sempre 200.
- `POST /auth/reset-password` — `ResetPasswordInputSchema`, 200 ou 400.

Nenhuma das três precisa de `AuthGuard` (são a própria porta de entrada).

### 4.3 Seed

`apps/api/prisma/seed.ts` ganha, pros três usuários de teste (`colaborador-1`, `gestor-1`, `rh-1`): `email` (`colaborador@dev.local` etc., mesmos do mock-idp), `phone` fictício, e `passwordHash` = hash de `"dev12345"`.

## 5. Web (`apps/web`)

### 5.1 `/login` reescrita

Formulário: email, senha, botão "Entrar", link "Esqueci minha senha". Sem botão de SSO (a rota `/auth/login?origin=web` continua existindo no backend, só sem link).

Submissão via Server Action (`actions.ts`, mesmo padrão já usado no resto do app): chama `POST /auth/password-login`, e como o Set-Cookie precisa vir de dentro do processo Next (não dá pra setar cookie de terceiros a partir do browser fazendo fetch direto pra API), a Server Action faz o fetch pro backend, lê o `Set-Cookie` da resposta e repassa pro cookie jar do Next via `cookies().set(...)`, depois `redirect("/")`.

Erro (401): mensagem genérica "Email ou senha incorretos." — sem indicar qual campo errou.

### 5.2 `/esqueci-senha` (nova página)

Dois passos na mesma página (estado local, sem trocar de rota):
1. Campo "Email ou telefone" → `POST /auth/forgot-password` → mostra o `devCode` retornado, em destaque, com um aviso "Modo de desenvolvimento — em produção isso chegaria por email/SMS."
2. Campos código + nova senha → `POST /auth/reset-password` → sucesso leva de volta pra `/login` com uma mensagem de confirmação.

## 6. Mobile (`apps/mobile`)

### 6.1 `login.tsx` reescrita

Mesma troca: `TextInput` de email, `TextInput` de senha (`secureTextEntry`), botão "Entrar", link "Esqueci minha senha" (navega pra uma nova rota `/esqueci-senha`). Sem botão de SSO — `handleSignIn` (SSO) e o `WebBrowser`/`expo-auth-session` ficam no arquivo, só sem `onPress` apontando pra eles (mesma decisão do backend: existe, não está exposto).

Chama `POST /auth/password-login` (mesmo `authedFetch`-style já usado em outras libs do app, mas sem token — é o próprio login), recebe `{token}`, `saveSessionToken(token)`, `registerForPushNotifications(token)`, navega pra `/(tabs)`.

### 6.2 `esqueci-senha.tsx` (nova tela)

Mesmo fluxo de dois passos da versão web, adaptado pros componentes do app (`ThemedText`, `ThemedButton`, etc.).

## 7. Fora de escopo

- Envio real de email/SMS — fica como TODO explícito (`devCode` na resposta), decisão tomada em conversa. Trocar por um provedor real é um trabalho separado, que precisa de credenciais que o usuário ainda não forneceu.
- Remoção do fluxo SSO — continua no código, só sem UI apontando pra ele (decisão tomada em conversa, pra poder reativar depois).
- Política de expiração/complexidade de senha além de "mínimo 8 caracteres" — nada de regras de maiúscula/número/símbolo nesta spec.
- 2FA, rate limiting de tentativas de login, bloqueio de conta após N tentativas erradas — todos ficam registrados como pendência de segurança pra produção, fora do escopo deste ambiente de desenvolvimento/demo.
- Alterar `AuthGuard`/verificação de JWT — o token continua exatamente igual (`{sub, role, name}`, mesmo segredo, mesma expiração de 8h); só a forma de obtê-lo muda.
