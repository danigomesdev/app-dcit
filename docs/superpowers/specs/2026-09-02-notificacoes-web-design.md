# Sininho de Notificações — Colaborador Web

**Status:** Proposto
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)
**Spec anterior (mesmo portal):** [`2026-09-01-pagamentos-notificacoes-design.md`](2026-09-01-pagamentos-notificacoes-design.md)

## 1. Objetivo e escopo

Segundo dos três sub-projetos anunciados na spec de Pagamentos:

1. ~~Infraestrutura de notificações + `/pagamentos` (RH)~~ — feito.
2. **Esta spec** — sininho de notificações no topbar (todos os papéis) + página de histórico completo, consumindo `GET /notifications/mine` e `POST /notifications/:id/read`, já prontos e sem nenhum consumidor até agora.
3. Sininho de notificações — **mobile** (spec própria, depois desta), incluindo o envio de push de verdade (ver seção 4).

**Zero mudança em `apps/api`** — os dois endpoints já existem, já autenticam qualquer papel (`AuthGuard`, sem `RolesGuard`), e já retornam exatamente o formato usado aqui. Esta spec é inteiramente `apps/web`.

**O que qualquer usuário logado ganha:** um sino no topbar (ao lado do menu de usuário), com um badge de contagem de não lidas. Clicar abre um painel com as últimas 10 notificações, cada uma clicável — o clique marca como lida e, se a notificação tiver um `link`, navega pra lá. Um link "Ver todas" no fim do painel leva pra `/notificacoes`, uma página com o histórico completo, mesmo comportamento de clique.

**Decisão explícita: o campo `link` continua nulo por enquanto.** O único produtor real de notificações hoje (`sendPagamento`, da spec de Pagamentos) não preenche `link` — não existe nenhuma página no portal do colaborador pra visualizar pagamentos/holerites (`/holerites` é só gestor/RH). Preencher `link` com algo sem sentido (ex.: `/banco-de-horas`) seria pior que deixar nulo. Na prática, hoje toda notificação de pagamento marca como lida ao clicar e não navega pra lugar nenhum — comportamento correto e esperado, não uma limitação desta spec. O próximo produtor real (detecção automática de ponto perdido, item seguinte do roadmap) tem um destino óbvio (`/historico`) e vai preencher `link` normalmente.

## 2. Web — sino no topbar (`AppShell`)

### 2.1 `apps/web/src/app/(app)/layout.tsx` (modificado)

```tsx
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { apiFetchJson } from "@/lib/api";
import { requireSession } from "@/lib/session";
import type { NotificationRecord } from "@/components/notification-list";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireSession();
  // Best-effort: uma falha aqui não pode derrubar o layout que envolve
  // toda página do portal — pior caso, o sino abre vazio até a próxima
  // navegação bem-sucedida buscar de novo.
  const notifications = await apiFetchJson<NotificationRecord[]>("/notifications/mine").catch(
    () => [] as NotificationRecord[],
  );
  return (
    <AppShell user={user} notifications={notifications}>
      {children}
    </AppShell>
  );
}
```

Busca em **todo** carregamento de página sob `(app)` — não só uma vez por sessão. Mesma característica de `requireSession()` (que já roda em todo request), agora com uma chamada de rede real a mais por navegação. Aceito deliberadamente: não existe cache/dedupe de fetch nesta base (`apiFetch` sempre usa `cache: "no-store"`, mesmo padrão de toda outra chamada do app), o volume de notificações por usuário é baixo, e adicionar um endpoint de contagem só pra evitar isso seria otimização prematura sem problema de performance observado. Registrado aqui como troca consciente, não descoberta de bug.

### 2.2 `apps/web/src/components/notification-list.tsx` (novo)

Tipo compartilhado + hook de estado/comportamento, usado tanto pelo painel do sino quanto pela página `/notificacoes` — evita duplicar a lógica de "marcar como lida ao clicar, navegar se houver link" nos dois lugares.

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { markNotificationRead } from "./notification-actions";
import styles from "./notification-list.module.css";

export type NotificationRecord = {
  id: string;
  type: string;
  category: string | null;
  message: string;
  link: string | null;
  createdAt: string;
  readAt: string | null;
};

function formatNotificationDate(iso: string): string {
  // createdAt é um instante ISO completo (Prisma DateTime → JSON), não uma
  // data-only — ao contrário do padrão formatDateOnly (que fixa UTC pra
  // evitar deslocar o dia em campos date-only), aqui o relógio de parede
  // real em São Paulo é o que importa: "às 21:32" precisa refletir o
  // horário local de verdade, não meia-noite UTC.
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Estado local + ação de clique compartilhados entre o painel do sino
// (lista truncada) e /notificacoes (lista completa) — cada instância desta
// hook tem sua própria cópia local, sincronizada de forma otimista.
export function useNotificationInbox(initial: NotificationRecord[]) {
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const unreadCount = items.filter((n) => n.readAt === null).length;

  function handleClick(notification: NotificationRecord) {
    if (notification.readAt === null) {
      const readAt = new Date().toISOString();
      setItems((current) => current.map((n) => (n.id === notification.id ? { ...n, readAt } : n)));
      startTransition(() => {
        // Melhor esforço: marcar como lida é um efeito colateral do clique,
        // não a intenção principal do usuário — se falhar, a navegação
        // (se houver link) segue normalmente e nenhum erro é mostrado. Na
        // pior hipótese a notificação volta a aparecer como não lida na
        // próxima vez que /notifications/mine for buscado.
        markNotificationRead(notification.id).catch(() => {});
      });
    }
    if (notification.link) {
      router.push(notification.link);
    }
  }

  return { items, unreadCount, handleClick };
}

export function NotificationList({
  notifications,
  onItemClick,
}: {
  notifications: NotificationRecord[];
  onItemClick: (notification: NotificationRecord) => void;
}) {
  if (notifications.length === 0) {
    return <p className={styles.empty}>Nenhuma notificação.</p>;
  }
  return (
    <ul className={styles.list}>
      {notifications.map((notification) => (
        <li key={notification.id}>
          <button
            type="button"
            className={
              notification.readAt === null
                ? `${styles.item} ${styles.itemUnread}`
                : styles.item
            }
            onClick={() => onItemClick(notification)}
          >
            <span className={styles.message}>{notification.message}</span>
            <span className={styles.date}>{formatNotificationDate(notification.createdAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

`NotificationList` é puramente apresentacional (recebe a lista já pronta + o handler de clique) — quem decide QUAL lista passar (as últimas 10, ou todas) e QUAL estado usar é cada consumidor (`NotificationBell`, `/notificacoes/page.tsx`), via `useNotificationInbox`.

### 2.3 `apps/web/src/components/notification-actions.ts` (novo)

```typescript
"use server";

import { apiFetch } from "@/lib/api";

export async function markNotificationRead(id: string): Promise<void> {
  const res = await apiFetch(`/notifications/${id}/read`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`/notifications/${id}/read responded with ${res.status}`);
  }
}
```

Chamada diretamente do Client Component (mesmo padrão de `sendPagamento`, já registrado na spec anterior — não é a primeira vez, então não repete a justificativa completa aqui). **Diferença deliberada:** esta Server Action **não** chama `revalidatePath`. `sendPagamento` revalida porque a UI de Pagamentos depende do servidor recalcular "já enviado este mês". Aqui o estado de leitura já é refletido de forma otimista no cliente (`useNotificationInbox`) — revalidar forçaria um round-trip ao servidor a cada clique só pra re-buscar dado que o cliente já tem correto localmente.

### 2.4 `apps/web/src/components/notification-bell.tsx` (novo)

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";

import { NotificationList, useNotificationInbox, type NotificationRecord } from "./notification-list";
import styles from "./notification-bell.module.css";

export function NotificationBell({ notifications }: { notifications: NotificationRecord[] }) {
  const [open, setOpen] = useState(false);
  const { items, unreadCount, handleClick } = useNotificationInbox(notifications);

  return (
    <div className={styles.bell}>
      <button
        type="button"
        className={styles.bellButton}
        onClick={() => setOpen((current) => !current)}
        aria-label="Notificações"
        aria-expanded={open}
      >
        <svg className={styles.bellIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.73 21a2 2 0 01-3.46 0"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 ? (
          <span className={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
        ) : null}
      </button>
      {open ? (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>Notificações</div>
          <NotificationList
            notifications={items.slice(0, 10)}
            onItemClick={(notification) => {
              handleClick(notification);
              setOpen(false);
            }}
          />
          <Link href="/notificacoes" className={styles.viewAll} onClick={() => setOpen(false)}>
            Ver todas
          </Link>
        </div>
      ) : null}
    </div>
  );
}
```

`useState` + botão próprio (não `<details>` nativo, ao contrário do menu de usuário vizinho) — decisão já tomada na conversa: o badge de não-lidas precisa refletir o estado local (`items`) instantaneamente após um clique, o que já obriga a componente a ser controlado por JS; usar `<details>` só pra abrir/fechar o painel, com um `useState` paralelo pro badge, criaria duas fontes de verdade pro "aberto/fechado" sem necessidade.

### 2.5 `apps/web/src/components/app-shell.tsx` (modificado)

```tsx
// ...imports existentes, +:
import { NotificationBell } from "./notification-bell";
import type { NotificationRecord } from "./notification-list";

export function AppShell({
  children,
  user,
  notifications,
}: {
  children: ReactNode;
  user: Session;
  notifications: NotificationRecord[];
}) {
  return (
    <div className={styles.shell}>
      {/* ...sidebar inalterado... */}
      <div className={styles.main}>
        <header className={styles.topbar}>
          <SearchOverlay role={user.role} />
          <div className={styles.topbarActions}>
            <NotificationBell notifications={notifications} />
            <details className={styles.userMenu}>{/* ...inalterado... */}</details>
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
```

Único ajuste em `app-shell.module.css`: um `.topbarActions { display: flex; align-items: center; gap: 8px; }` novo, envolvendo o sino + menu de usuário, pra manter `.topbar`'s `justify-content: space-between` empurrando a busca pra esquerda e o par sino+usuário pra direita, com espaçamento entre os dois.

### 2.6 `notification-bell.module.css` / `notification-list.module.css` (novos)

Reaproveitam os valores exatos já usados por `.userMenuButton`/`.userMenuPanel` em `app-shell.module.css` (36×36 o botão, painel com `background: #1c2230`, `box-shadow: 0 8px 24px rgba(0,0,0,0.45)`, `z-index: 10`, `position: absolute; top: calc(100% + 8px); right: 0;`) — mesmo desenho visual do menu vizinho, só mais largo (`width: 320px` em vez de `220px`, pra caber mensagem + data por linha). Classes novas específicas do sino: `.badge` (círculo pequeno posicionado absoluto no canto superior direito do botão, fundo de destaque, texto branco, `font-size: 11px`). Classes específicas da lista: `.item`/`.itemUnread` (não-lida com um indicador visual — ex.: um ponto à esquerda ou `font-weight: 600` na mensagem — e leve diferença de fundo), `.message`, `.date`, `.empty`.

## 3. Web — página `/notificacoes` (histórico completo)

### 3.1 `apps/web/src/app/(app)/notificacoes/page.tsx` (novo)

```tsx
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";
import type { NotificationRecord } from "@/components/notification-list";

import { NotificationHistoryList } from "./notification-history-list";
import styles from "./notificacoes.module.css";

export default async function NotificacoesPage() {
  const session = await getSession();
  const notifications = session
    ? await apiFetchJson<NotificationRecord[]>("/notifications/mine").catch(() => [] as NotificationRecord[])
    : [];

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Notificações</h1>
      <NotificationHistoryList notifications={notifications} />
    </div>
  );
}
```

Sem `EmptyState`/gate de permissão — qualquer usuário autenticado vê seu próprio histórico (decisão já tomada: o sino/histórico existe pra todos os papéis, mesmo que hoje só colaboradores tenham notificações reais).

### 3.2 `apps/web/src/app/(app)/notificacoes/notification-history-list.tsx` (novo, Client Component)

```tsx
"use client";

import { NotificationList, useNotificationInbox, type NotificationRecord } from "@/components/notification-list";

export function NotificationHistoryList({ notifications }: { notifications: NotificationRecord[] }) {
  const { items, handleClick } = useNotificationInbox(notifications);
  return <NotificationList notifications={items} onItemClick={handleClick} />;
}
```

Wrapper fino: só existe porque `useNotificationInbox` precisa de um Client Component pra rodar, e a página em si (`page.tsx`) continua Server Component (busca os dados, sem estado próprio). Reaproveita o mesmo `NotificationList` do sino, sem truncar (`items` completo, não `.slice(0, 10)`).

### 3.3 `notificacoes.module.css` (novo)

Reaproveita `.page`/`.heading` já estabelecidos em outras páginas simples do portal (ex.: `pagamentos.module.css`). Sem paginação — volume esperado é baixo o suficiente pra uma lista única rolável.

### 3.4 `nav-sections.ts`

```typescript
{ href: "/notificacoes", label: "Notificações", roles: ["colaborador", "gestor", "rh"] },
```

Adicionado ao final de `NAV_SECTIONS` — torna a página buscável via Ctrl+K. **Correção pós-implementação (achado da revisão final):** ao contrário do que esta seção originalmente afirmava, `NAV_SECTIONS` não é só um índice de busca — para gestor/RH, `NavLinks` usa exatamente essa lista como a própria sidebar (só colaborador tem uma sidebar curada, via `COLABORADOR_SIDEBAR`, que continua sem ganhar entrada nova). Na prática, gestor e RH passam a ver "Notificações" na sidebar deles; colaborador só tem o sino. Decisão (ruling do controlador na revisão final): manter como está — é inofensivo e até faz sentido: gestor/RH ainda não recebem notificações reais hoje, mas devem passar a receber assim que um produtor futuro (ex.: detecção automática de ponto perdido) os incluir, e a entrada na sidebar já preparada custa nada.

## 4. Mobile

Fora de escopo desta spec — sub-projeto 3, spec própria. Vai incluir, além do sino/histórico equivalente no app mobile:

- **Envio de push de verdade**, decidido em conversa como pertencente a esse sub-projeto (não a este): `expo-server-sdk` no backend + disparo em `NotificationsService` (ex.: `sendPagamento`) sempre que uma `Notification` é criada, usando os `PushToken`s já registrados hoje (`apps/api/src/push/`, `apps/mobile/src/lib/push.ts`) — infraestrutura de coleta de token já existe e já tem um comentário no código antecipando exatamente este uso ("status-change notifications... can reach this device"), só falta a metade que envia.

## 5. Testes

### 5.1 `apps/web/e2e/notificacoes.spec.ts` (novo)

- Badge não aparece quando não há notificações não lidas; aparece com a contagem certa quando há (fixture com 3 notificações, 2 com `readAt: null`).
- Badge mostra "9+" quando a contagem de não lidas passa de 9.
- Abrir o sino mostra até as últimas 10 notificações (fixture com mais de 10, confirma que só 10 aparecem no painel — mas todas aparecem em `/notificacoes`).
- Clicar numa notificação não lida: marca como lida (some o indicador visual de não-lida, badge decrementa) e chama `POST /notifications/:id/read` (via `getRecordedRequests`).
- Clicar numa notificação com `link` navega pra lá (fixture com `link: "/historico"`, confirma `page.url()` depois do clique).
- Clicar numa notificação com `link: null` marca como lida e não navega (URL continua a mesma).
- Painel mostra "Nenhuma notificação." quando a lista vem vazia.
- `/notificacoes` mostra a lista completa (mais de 10 itens, todos visíveis, ao contrário do painel do sino).
- Sino e `/notificacoes` aparecem pros 3 papéis (colaborador, gestor, rh) — sem gate de permissão, ao contrário de `/pagamentos`.

### 5.2 `test-session.ts`

`mockApi`'s `data` ganha uma chave nova, `notifications?: unknown[]`, semeando `GET /notifications/mine` (mesmo padrão de toda outra chave existente).

**`fake-api-server.mjs` precisa de um fallback novo, e ele é crítico desta vez — não só uma conveniência de teste.** Diferente de `/notifications/pagamentos/status/:category` (só chamado por uma página), `/notifications/mine` agora é chamado pelo **`(app)/layout.tsx`**, ou seja, por **toda página sob `(app)` em toda spec existente do repositório** assim que esta spec for implementada. Sem um fallback incondicional, todo teste e2e já existente (não só os novos) passaria a ver esse fetch retornar 404, cair no `.catch(() => [])` do layout (então não quebra — ver 2.1), mas isso significa que nenhum teste precisa ser tocado só por causa disso. Ainda assim, o fallback precisa existir pra não sujar `recordedRequests`/comportamento de nenhum teste que não é sobre notificações:

```javascript
if (req.method === "GET" && url.pathname === "/notifications/mine") {
  return sendJson(res, 200, []);
}
```

Adicionado antes do fallback final de 404, mesmo lugar/padrão de `/notifications/pagamentos/status/:category` (spec anterior) e `/atestados/team`.

## 6. Global Constraints

- Zero mudança em `apps/api` ou `packages/shared-types` — os dois endpoints consumidos já existem exatamente no formato usado aqui.
- `Notification.link` continua `null` em todo produtor real hoje — nenhum destino de clique existe ainda pra notificações de pagamento (seção 1). Notificação sem link ainda marca como lida ao clicar, só não navega.
- O painel do sino é controlado por `useState`/botão, nunca `<details>` nativo — precisa refletir o badge de não-lidas instantaneamente após um clique (seção 2.4).
- `markNotificationRead` (a Server Action) **não** chama `revalidatePath` — o estado de leitura é local/otimista no cliente, revalidar seria um round-trip desnecessário (seção 2.3).
- Sem gate de permissão em `/notificacoes` nem no sino — todo usuário autenticado vê seu próprio histórico, independente do papel.
- `createdAt` é formatado com `timeZone: "America/Sao_Paulo"` e mostra hora, não `formatDateOnly` (que é só pra campos date-only) — é um instante real, o horário de parede importa (seção 2.2).
- `(app)/layout.tsx` busca `/notifications/mine` em toda navegação, sem cache — troca deliberada de simplicidade por uma chamada de rede extra por página, registrada como aceita (seção 2.1), não uma otimização pendente.

## 7. Fora de escopo

- Envio de push (mobile/app fechado) — sub-projeto 3 (seção 4).
- Polling/atualização em tempo real do badge enquanto a página está aberta — decidido em conversa: só busca no load/navegação.
- Preencher `Notification.link` para o produtor de pagamentos existente — não há destino sensato hoje (seção 1); revisitar quando/se `/holerites` (ou equivalente) ganhar uma visão do colaborador.
- Paginação em `/notificacoes` — lista única, volume baixo esperado.
- "Marcar todas como lidas" em lote — decidido em conversa: só marca ao clicar em cada uma.
- Deletar/arquivar notificações — não existe essa operação na API (`Notification` só pode ganhar `readAt`, nunca ser removida — mesma restrição já registrada na spec anterior).
- Notificações de outros tipos além de "pagamento" — a tabela e o sino já suportam qualquer `type`/`category` sem mudança, mas nenhum outro produtor é implementado aqui.
