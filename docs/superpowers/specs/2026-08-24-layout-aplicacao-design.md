# Layout da Aplicação — Ponto DCIT

**Status:** Aprovado para implementação
**Spec funcional de referência:** [`docs/spec-funcional.md`](../../spec-funcional.md) (v2)
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)

## 1. Objetivo e escopo

Definir a casca de navegação e o esqueleto visual do app mobile (colaborador) e do painel web (RH/gestor), a partir do MVP scaffold já existente (`docs/superpowers/plans/2026-08-19-mvp-scaffold.md`), que hoje só tem uma tela única em cada app.

Este layout entrega a **estrutura de navegação e telas placeholder**, não a lógica de negócio de cada seção. Seções cujo módulo de backend ainda não existe (banco de horas, férias, documentos, mural, aprovações) recebem um estado vazio padronizado; a lógica real de cada uma é escopo de planos futuros dedicados, seguindo o mesmo padrão que o MVP scaffold já usou para deixar offline-sync e auth como "fora de escopo" explícito.

Fora de escopo desta spec:
- Autenticação/SSO real (módulo `auth` ainda não existe — ver spec de arquitetura, seção 4).
- Qualquer lógica de dados das seções além de Ponto (que já tem `POST /time-entries` real).
- Um design system compartilhado entre mobile e web (decisão explícita: não introduzir Tamagui/NativeWind/Tailwind agora — ver seção 4).

## 2. Decisões de partida

- **Sem dependências novas de estilo.** Mobile usa `StyleSheet` + o objeto `Colors` já existente em `apps/mobile/src/constants/theme.ts`. Web usa CSS Modules, como o `create-next-app` já gerou. Motivo: só há 2 telas placeholder hoje — não há dor concreta que justifique adotar um design system compartilhado (Tamagui/NativeWind) antes de ter mais telas reais para validar a necessidade.
- **Mobile e web navegam para públicos diferentes.** Mobile é o app do colaborador (bater ponto, consultar seus próprios dados). Web é o painel do RH (aprovações, documentos de outros colaboradores) — a spec funcional já descreve o "Portal do Gestor" como um dashboard *mobile*, não web; o web fica reservado para RH/admin.

## 3. Navegação mobile (`apps/mobile`)

`apps/mobile/src/app/_layout.tsx` passa a renderizar um `Tabs` do expo-router (em vez do `Stack` atual), mantendo o `ThemeProvider` existente (dark mode via `useColorScheme`, já funcional).

5 abas, uma rota por aba em `apps/mobile/src/app/(tabs)/`:

| Aba | Rota | Conteúdo no MVP |
|---|---|---|
| Ponto | `index.tsx` | Botão "Bater Ponto" (já existe, dado real via `POST /time-entries`) + espelho de ponto do dia |
| Banco de Horas | `banco-de-horas.tsx` | Saldo e histórico de horas — `EmptyState` (sem backend ainda) |
| Férias | `ferias.tsx` | Solicitação de férias/justificativas e status — `EmptyState` |
| Documentos | `documentos.tsx` | Repositório pessoal + upload de atestados — `EmptyState` |
| Mural | `mural.tsx` | Feed de avisos/comunicados — `EmptyState` |

Cada tela reaproveita `themed-view.tsx`/`themed-text.tsx` já existentes em `apps/mobile/src/components/`. O ícone de cada aba é decisão do plano de implementação (não estrutural aqui) — `expo-symbols` está disponível mas é SF Symbols/iOS-only, então precisa de uma estratégia de fallback para Android definida na hora de implementar.

## 4. Navegação web (`apps/web`)

`apps/web/src/app/layout.tsx` passa a renderizar um componente `AppShell` (sidebar fixa à esquerda + área de conteúdo à direita) em vez de `{children}` diretamente. Sidebar escolhida em vez de top nav por ser o padrão mais adequado a um painel administrativo de uso desktop.

2 seções na sidebar, cada uma sua própria rota:

| Seção | Rota | Conteúdo no MVP |
|---|---|---|
| Aprovações | `/aprovacoes` | Fila de férias/justificativas pendentes — `EmptyState` (módulo `approvals` não existe ainda) |
| Documentos | `/documentos` | Atestados e documentos enviados pelos colaboradores — `EmptyState` (módulo `documents` não existe ainda). Dado sensível (CID/médico/CRM) conforme RBAC granular da spec funcional (seção 6) — a tela em si não expõe esse dado até o módulo real existir, mas o layout já reserva o espaço visual para quando existir. |

A sidebar reserva um espaço de identidade do usuário logado (nome/placeholder) no topo, mesmo sem login real implementado, para não exigir retrabalho de layout quando o módulo `auth` chegar.

## 5. Linguagem visual compartilhada

- **Paleta**: os hex já definidos em `apps/mobile/src/constants/theme.ts` (`Colors.light`/`Colors.dark`) viram a referência única de cor. O web replica os mesmos valores como custom properties CSS em `apps/web/src/app/globals.css` (`--color-background`, `--color-text`, `--color-background-element`, `--color-background-selected`, `--color-text-secondary`), consumidas pelos CSS Modules do `AppShell`. Não existe um pacote `@ponto-dcit/design-tokens` — replicar os valores nos dois lugares é aceitável para 5 cores; um pacote compartilhado seria over-engineering neste tamanho.
- **Tipografia**: cada app mantém a sua própria (Geist no web via `next/font`, fonte de sistema no mobile via `Fonts` de `theme.ts`). Unificar fonte entre React Native e web não é trivial e não traz benefício real aqui.
- **Dark mode**: mobile já suporta via `useColorScheme` (existente). Web ganha suporte equivalente via `@media (prefers-color-scheme: dark)` sobre as custom properties.

## 6. Estado vazio padronizado (`EmptyState`)

Toda seção sem backend ainda (Banco de Horas, Férias, Documentos e Mural no mobile; Aprovações e Documentos no web) usa um componente `EmptyState` em vez de um placeholder ad-hoc por tela. Composição: título da seção, um ícone/ilustração simples, e uma frase curta descrevendo o que vai aparecer ali (ex.: "Suas solicitações de férias vão aparecer aqui").

Motivo: cada seção já comunica sua função real ao usuário (em vez de um genérico "Em breve" sem contexto), e o esqueleto de tela fica pronto para o próximo plano por módulo preencher com dados reais, sem redesenho de layout.

Implementação: um componente `EmptyState` em `apps/mobile/src/components/` (mobile) e um equivalente em CSS Modules no web — mesma composição visual (título + ícone + frase), sem tentar compartilhar código entre React Native e web para um componente tão pequeno.

## 7. Testes

Segue o padrão já estabelecido no MVP scaffold — nenhuma ferramenta nova.

- **Mobile**: `@testing-library/react-native` (já em uso em `apps/mobile/src/app/__tests__/index.test.tsx`). Um teste por tela nova confirmando que renderiza, mais um teste confirmando que as 5 rotas de aba existem no `Tabs`.
- **Web**: Playwright (já configurado em `apps/web/e2e/`). Estende a suíte para confirmar que o `AppShell` renderiza as 2 seções da sidebar e que a navegação entre `/aprovacoes` e `/documentos` funciona.

Sem teste de integração com backend nesta spec — as seções sem endpoint mostram apenas `EmptyState`, então não há dado real para testar ainda; isso é consistente com o resto do repo, que testa telas isoladamente e só adiciona teste de integração quando o endpoint existe.

## 8. Fora de escopo (referência para não se perder no plano de implementação)

- Lógica de dados de Banco de Horas, Férias, Documentos, Mural (mobile) e Aprovações, Documentos (web) — cada uma vira um plano dedicado quando o módulo de backend correspondente for implementado.
- Autenticação/SSO e o estado real de usuário logado na sidebar do web.
- Ícone específico de cada aba mobile e sua estratégia de fallback Android (decisão de implementação, não de layout).
- Qualquer design system compartilhado entre mobile e web.
