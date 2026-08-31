# Histórico de Pontos + Folha de Ponto — Colaborador — Web

**Status:** Proposto
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)
**Spec anterior (mesmo portal):** [`docs/superpowers/specs/2026-08-31-bater-ponto-colaborador-web-design.md`](2026-08-31-bater-ponto-colaborador-web-design.md)

## 1. Objetivo e escopo

Segundo sub-projeto do portal de autoatendimento do colaborador na web (o primeiro, Bater Ponto, já está em `master`). O colaborador consegue bater o ponto em `/`, mas não tem como consultar o próprio histórico nem exportar a folha de ponto pela web — ambos já existem no mobile (`historico.tsx`, `folha.tsx`) e usam o mesmo endpoint (`GET /time-entries`) que a Sub-projeto A já provou funcionar no web.

Fora de escopo (seção 7 tem a lista completa): ajustar ponto, solicitações de ajuste, férias — cada um fica pra um sub-projeto seguinte.

## 2. Modelo de dados e backend

Nenhuma mudança. `GET /time-entries` (já usado por `/` desde a Sub-projeto A) retorna todas as entradas do usuário autenticado, ordenadas por `clockedAt` asc — é o único dado que estas duas páginas precisam, sem filtro adicional (ao contrário do card de bater ponto, que filtra pra "só hoje", aqui queremos o histórico completo).

## 3. Web (`apps/web`)

### 3.1 Guarda de acesso invertida

Diferente de toda página existente hoje (que bloqueia `colaborador` e libera gestor/RH), estas duas páginas são pessoais — bloqueiam quem **não** é colaborador:

```typescript
const session = await getSession();
if (!session || session.role !== "colaborador") {
  return (
    <EmptyState
      title="Sem permissão"
      description="Esta página é pessoal, restrita a colaboradores."
    />
  );
}
```

### 3.2 Nova página `/historico`

`apps/web/src/app/(app)/historico/page.tsx` — Server Component puro (sem interatividade, não precisa de `"use client"`):

- Busca `GET /time-entries`.
- Ordena por `clockedAt` desc (mais recente primeiro) — inverso da ordem em que a API já entrega.
- Lista cada entrada: data (`dd de mês`) + hora, mesmo formato do `historico.tsx` do mobile.
- Lista vazia → `EmptyState` "Nenhum ponto registrado ainda".

Arquivos: `page.tsx`, `historico.module.css` (layout mirror de `documentos.module.css`: `.page`, `.heading`, `.list`, `.item`).

### 3.3 Nova página `/folha`

`apps/web/src/app/(app)/folha/page.tsx` — Server Component busca os dados; `exportar-pdf-button.tsx` — Client Component só pro botão.

- Busca `GET /time-entries`, agrupa por dia usando `dateOnlyInSaoPaulo` (mesmo helper colocado em `page.tsx` da Sub-projeto A — copiado localmente aqui de novo, mesmo padrão de duplicação já estabelecido).
- **Divergência deliberada do mobile:** `folha.tsx` (mobile) agrupa por dia com `clockedAt.slice(0,10)` (UTC ingênuo) — o mesmo tipo de bug que a revisão final da Sub-projeto A pegou e corrigiu para "hoje" no card de bater ponto. Esta página usa o agrupamento correto (São-Paulo-aware) desde o início; não altera o mobile (fora de escopo — mobile continua com o comportamento antigo até uma correção própria, decidida separadamente).
- Para cada dia (mais recente primeiro): calcula horas trabalhadas com a mesma lógica de pareamento sequencial já usada em `meu-ponto-card.tsx` (reimplementada localmente aqui — mesmo raciocínio de não compartilhar entre arquivos de ~15 linhas sem estado).
- Lista vazia → `EmptyState` "Nenhum dia registrado ainda".
- Botão "Exportar PDF" (`exportar-pdf-button.tsx`, client): `onClick={() => window.print()}`. Sem dependência nova, sem geração de PDF no servidor — usa o diálogo nativo de impressão do navegador ("Salvar como PDF").

Arquivos: `page.tsx`, `folha.module.css`, `exportar-pdf-button.tsx`.

### 3.4 CSS de impressão

`apps/web/src/components/app-shell.module.css` ganha:

```css
@media print {
  .sidebar,
  .topbar {
    display: none;
  }
}
```

Escondendo a sidebar e a topbar ao imprimir — regra global no shell, reutilizável por qualquer página futura que precise de exportação via impressão, não só a folha.

### 3.5 `nav-sections.ts` e `nav-links.tsx`

Duas novas entradas em `NAV_SECTIONS`:

```typescript
{ href: "/historico", label: "Histórico de Pontos", roles: ["colaborador"] },
{ href: "/folha", label: "Folha de Ponto", roles: ["colaborador"] },
```

A sidebar (`nav-links.tsx`) hoje renderiza todos os itens pra todo mundo, sem filtrar por `roles` — só a busca filtra. Mantém esse comportamento (mesmo padrão já existente pra "Convenções", que aparece pro gestor mas dá "Sem permissão" se clicado); não é escopo desta spec mudar a sidebar.

### 3.6 Sem mudança em `meu-ponto-card.tsx` / `ponto-actions.ts` / `/`

O card de bater ponto continua mostrando só o resumo de hoje; estas duas páginas novas são as visões de histórico completo, acessadas separadamente.

## 4. Mobile

Nenhuma mudança de código.

## 5. Testes

Só e2e (mesmo padrão das specs anteriores desta sessão):

- **`historico.spec.ts`**: RBAC (gestor/RH veem "Sem permissão"; colaborador vê a lista), lista vazia mostra `EmptyState`, entradas aparecem em ordem decrescente.
- **`folha.spec.ts`**: RBAC, lista vazia, agrupamento por dia mostra horas corretas, o mesmo caso de fronteira UTC-vs-São-Paulo já usado na Sub-projeto A (uma entrada que é "hoje" em SP mas outro dia em UTC cai no dia certo), botão "Exportar PDF" presente (não dá pra testar o diálogo de impressão do navegador via Playwright — o teste cobre só que o botão existe e que `window.print` é chamado ao clicar, via mock).
- **`search.spec.ts`**: colaborador buscando "histórico" e "folha" encontra os dois novos resultados.
- **`app-shell.spec.ts`**: sem mudança — os dois novos itens de nav não quebram os testes existentes (que checam nav items específicos, não a lista inteira).

## 6. Global Constraints (herdadas + novas)

- "Hoje"/agrupamento por dia deve ser São-Paulo-aware, não UTC-ingênuo (herdada da Sub-projeto A, aplicada aqui ao agrupamento por dia da folha).
- Sem geração de PDF real (nem lib nova, nem backend) — só `window.print()`.
- Guarda de acesso destas duas páginas é o oposto de todas as outras: bloqueia quem não é colaborador, não quem é.

## 7. Fora de escopo

- Ajustar ponto (`ajustar.tsx` no mobile) e solicitações de ajuste (`solicitacoes.tsx`) — sub-projetos seguintes.
- Geração de PDF real via lib (jsPDF) ou backend (Puppeteer/API) — decisão tomada em conversa: `window.print()` cobre a necessidade sem dependência nova.
- Filtro de sidebar por role — a sidebar continua mostrando todos os itens pra todo mundo, mesmo comportamento pré-existente.
- Corrigir o agrupamento UTC-ingênuo do `folha.tsx` no mobile — fica registrado como pendência própria, decidida separadamente.
- Paginação/filtro por período em `/historico` — a spec assume o volume atual de registros é pequeno o suficiente pra listar tudo; DoD é o mesmo do "fetch sem limite" já aceito como Minor na Sub-projeto A.
