# Sininho de Notificações + Push Real — Mobile

**Status:** Proposto
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)
**Spec anterior (mesma série):** [`2026-09-02-notificacoes-web-design.md`](2026-09-02-notificacoes-web-design.md)

## 1. Objetivo e escopo

Terceiro e último sub-projeto da série de notificações anunciada na spec de Pagamentos:

1. ~~Infraestrutura de notificações + `/pagamentos` (RH)~~ — feito.
2. ~~Sininho de notificações — colaborador web~~ — feito.
3. **Esta spec** — sininho de notificações no app mobile (todos os papéis) + envio de push de verdade quando o app está fechado/bloqueado.

**Duas partes independentes, mas que só fazem sentido juntas:**

- **`apps/api`** — hoje `NotificationsService.sendPagamento` cria as linhas em `Notification`, mas nunca aciona `ExpoPushService.sendToUser`, que já existe, já está testado, e já faz a chamada HTTP real pro serviço de push da Expo. Só falta ligar os dois. Zero mudança de schema.
- **`apps/mobile`** — hoje não existe nenhum consumidor de `GET /notifications/mine`/`POST /notifications/:id/read`. A tela `/notificacoes` já existe, mas mostra só avisos computados no cliente (férias vencendo, pontos offline, alertas de jornada, solicitações pendentes) — nenhuma noção do histórico persistido no servidor. Sem badge de não lidas em lugar nenhum.

**Teste de dispositivo real, decidido em conversa:** iPhone físico via Expo Go (push remoto funciona lá sem dev client — a Expo cuida do APNs). Android fica **sem verificação em dispositivo real nesta rodada** — o Expo Go não suporta mais push remoto no Android desde o SDK 53 (limitação já documentada no comentário de `apps/mobile/src/lib/push.ts`), e um dev client (build EAS) fica fora de escopo. O código do lado Android segue exatamente a mesma filosofia best-effort já estabelecida (nunca quebra o app, falha silenciosamente) — só não é testado ponta a ponta.

**`Notification.link` continua `null` no único produtor real hoje (`sendPagamento`)** — mesma decisão já registrada na spec web (§1 de lá): não existe destino sensato pra pagamentos no portal do colaborador. O caminho de toque em push/notificação com `link` é construído aqui (mesmo assim, já pronto pro próximo produtor real — detecção automática de ponto perdido, com `link: "/historico"`), mas hoje na prática todo toque só marca como lida, sem navegar. Não é uma limitação desta spec, é o mesmo estado já aceito no web.

## 2. Backend (`apps/api`)

### 2.1 `apps/api/src/push/expo-push.service.ts` (modificado)

```typescript
export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

async sendToUser(userId: string, message: PushMessage): Promise<void> {
  try {
    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return;

    await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(
        tokens.map((t) => ({
          to: t.token,
          title: message.title,
          body: message.body,
          ...(message.data ? { data: message.data } : {}),
        })),
      ),
    });
  } catch (error) {
    this.logger.warn(`Failed to send push notification to user ${userId}: ${String(error)}`);
  }
}
```

`data` é opcional e só entra no payload quando fornecido — nenhum call site existente muda de comportamento sem passar `data` explicitamente (não há nenhum hoje, mas mantém o método genérico pra qualquer produtor futuro que não precise dele).

### 2.2 `apps/api/src/notifications/notifications.service.ts` (modificado)

```typescript
async sendPagamento(category: PagamentoCategoria, userIds: string[]) {
  const message = PAGAMENTO_MESSAGE[category];
  const created = await this.prisma.notification.createManyAndReturn({
    data: userIds.map((userId) => ({ userId, type: 'pagamento', category, message })),
  });
  await Promise.all(
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

`createManyAndReturn` (suportado no Prisma 6.19, incluindo SQLite) troca por `createMany` só pra recuperar o `id` gerado de cada linha — necessário porque o payload de push carrega `notificationId` (usado pelo app pra marcar como lida ao tocar, sem precisar buscar a lista inteira primeiro). `Promise.all` em vez de sequencial: envios são independentes entre si, e `sendToUser` já é best-effort (nunca rejeita — todo erro é engolido e logado dentro dele), então nada aqui precisa de tratamento de erro adicional.

Título fixo `"Ponto DCIT"` (nome do app) pra todo push, corpo = mesma mensagem já usada na `Notification` — não existe hoje nenhuma necessidade de título por categoria.

### 2.3 `apps/api/src/notifications/notifications.module.ts` (modificado)

```typescript
@Module({
  imports: [AuthModule, PushModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
```

`PushModule` já exporta `ExpoPushService` (`exports: [ExpoPushService]`) — só precisa ser importado aqui. `NotificationsService` ganha `ExpoPushService` no construtor.

## 3. Mobile — estado compartilhado do inbox

### 3.1 `apps/mobile/src/lib/notifications-api.ts` (novo)

Espelha `apps/mobile/src/lib/push-api.ts` — funções finas de fetch, best-effort (retornam `null`/não lançam em falha, mesmo padrão de `time-entries-api.ts` e afins):

```typescript
export type NotificationRecord = {
  id: string;
  type: string;
  category: string | null;
  message: string;
  link: string | null;
  createdAt: string;
  readAt: string | null;
};

export async function fetchNotifications(sessionToken: string): Promise<NotificationRecord[] | null> { /* GET /notifications/mine */ }
export async function markNotificationRead(sessionToken: string, id: string): Promise<void> { /* POST /notifications/:id/read, best-effort */ }
```

### 3.2 `apps/mobile/src/context/notification-context.tsx` (novo)

Mesma motivação já validada na revisão final da spec web: badge (tela inicial) e lista (`/notificacoes`) não podem manter cópias independentes de estado, ou marcar como lida num lugar deixa o outro mostrando contagem errada. Diferente do web (que recebe os dados iniciais de um Server Component já autenticado), o mobile não tem essa divisão — o Provider busca sozinho, condicionado à existência de um token de sessão:

```tsx
type NotificationContextValue = {
  items: NotificationRecord[];
  unreadCount: number;
  refresh: () => Promise<void>;
  handlePress: (notification: NotificationRecord) => void;
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const router = useRouter();

  const refresh = useCallback(async () => {
    const token = await getSessionToken();
    if (!token) return;
    const fetched = await fetchNotifications(token);
    if (fetched) setItems(fetched);
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  function handlePress(notification: NotificationRecord) {
    if (notification.readAt === null) {
      setItems((current) =>
        current.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      getSessionToken().then((token) => {
        if (token) markNotificationRead(token, notification.id).catch(() => {});
      });
    }
    if (notification.link) router.push(notification.link as Href);
  }

  const unreadCount = items.filter((n) => n.readAt === null).length;
  return (
    <NotificationContext.Provider value={{ items, unreadCount, refresh, handlePress }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() { /* useContext + throw se fora do Provider, mesmo padrão do web */ }
```

Busca no mount, e de novo sempre que o app volta pro primeiro plano (`AppState` — não existe equivalente mobile de "toda navegação re-executa o Server Component", então o gatilho aqui é "o usuário pode ter recebido algo enquanto o app estava em background"). Sem polling contínuo — mesma decisão já tomada no web (§7 de lá: sem tempo real, só busca em pontos de re-entrada).

### 3.3 `apps/mobile/src/app/_layout.tsx` (modificado)

```tsx
export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PontoProvider>
        <NotificationProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </NotificationProvider>
      </PontoProvider>
    </ThemeProvider>
  );
}
```

`NotificationProvider` dentro de `PontoProvider`, envolvendo toda a `Stack` — inclusive `login.tsx`, onde `refresh()` simplesmente no-opa (sem token ainda). Ver §5 para o listener de toque em push, que também vive aqui.

## 4. Mobile — badge e tela `/notificacoes`

### 4.1 Badge no ícone do sino (`apps/mobile/src/app/(tabs)/index.tsx`, modificado)

O `HeaderIconButton` de `notifications-outline` ganha um badge — mesma linguagem visual do web (círculo vermelho, número, `9+` acima de 9):

```tsx
const { unreadCount } = useNotificationContext();
// ...
<HeaderIconButton icon="notifications-outline" accessibilityLabel="Notificações" onPress={() => router.push("/notificacoes")}>
  {unreadCount > 0 ? (
    <View style={styles.badge}>
      <ThemedText type="small" style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</ThemedText>
    </View>
  ) : null}
</HeaderIconButton>
```

`HeaderIconButton` precisa aceitar `children` opcional (hoje só renderiza o `Ionicons`) — mudança mínima de assinatura, sem afetar o outro uso existente (`Buscar`, sem badge). `styles.badge`: `position: "absolute", top: -2, right: -2`, fundo de destaque (`theme.accent`, mesmo tom já usado nos avisos de `notificacoes.tsx`), `borderRadius` circular.

### 4.2 Tela `/notificacoes` (`apps/mobile/src/app/notificacoes.tsx`, modificado)

Nova seção no topo, antes da lista de avisos computados já existente:

```tsx
const { items, handlePress } = useNotificationContext();
// ...
<ScrollView contentContainerStyle={styles.list}>
  {items.length > 0 ? (
    <>
      <ThemedText type="smallBold" themeColor="textSecondary">Notificações</ThemedText>
      {items.map((n) => (
        <Pressable key={n.id} onPress={() => handlePress(n)} style={[styles.row, n.readAt === null && styles.rowUnread, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">{n.message}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{formatNotificationDate(n.createdAt)}</ThemedText>
        </Pressable>
      ))}
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionGap}>Avisos</ThemedText>
    </>
  ) : null}
  {/* ...notices.map(...) já existente, inalterado... */}
</ScrollView>
```

`formatNotificationDate`: mesma função (copiada, não importada de `apps/web` — projetos separados) já validada na spec web, `toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", ... })`, porque `createdAt` é um instante ISO completo, não date-only.

Estado vazio (`EmptyState` "Tudo em dia") só aparece quando **as duas** listas (`items` do servidor e `notices` computados) estão vazias — condição do `notices.length === 0` existente passa a ser `items.length === 0 && notices.length === 0`.

## 5. Mobile — recebimento e toque em push

### 5.1 `apps/mobile/src/lib/push.ts` (modificado)

`registerForPushNotifications`/`unregisterPushNotifications` continuam iguais. Duas funções novas, mesmo padrão de lazy-load do `expo-notifications` já estabelecido no arquivo (evita o crash de import no Expo Go Android):

```typescript
export function configureNotificationHandler(): void {
  try {
    const Notifications = loadNotifications();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Best-effort — sem handler explícito, o app só não mostra banner em
    // primeiro plano; a notificação ainda chega ao tocar (fora do app).
  }
}

export function addNotificationTapListener(onTap: (data: unknown) => void): () => void {
  try {
    const Notifications = loadNotifications();
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      onTap(response.notification.request.content.data);
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) onTap(response.notification.request.content.data);
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
```

Sem `setNotificationHandler`, o comportamento padrão do Expo SDK atual é **não** mostrar banner em primeiro plano — precisa ser explícito pra o usuário ver o push chegando com o app aberto. `shouldSetBadge: false`: o badge nativo do ícone do app (contador sobre o ícone, fora do app) fica fora de escopo — o badge desta spec é só o interno, no sino (§4.1); não há pedido por badge nativo e adicionar um exigiria também zerá-lo em algum momento (mais um estado pra manter sincronizado), sem necessidade demonstrada.

`getLastNotificationResponseAsync()` cobre o caso de cold start (app estava fechado, o toque no push é o que abre o app) — sem isso, um toque nesse cenário simplesmente abriria o app na tela inicial, ignorando o `link`.

### 5.2 `apps/mobile/src/app/_layout.tsx` (modificado, continuação de §3.3)

```tsx
function NotificationTapHandler() {
  const { handlePress, items, refresh } = useNotificationContext();
  useEffect(() => {
    configureNotificationHandler();
    return addNotificationTapListener(async (data) => {
      const payload = data as { notificationId?: string; link?: string | null };
      if (!payload.notificationId) return;
      await refresh();
      handlePress({ id: payload.notificationId, link: payload.link ?? null } as NotificationRecord);
    });
  }, [handlePress, refresh]);
  return null;
}
```

Chama `refresh()` antes de `handlePress` pra garantir que a notificação tocada já está em `items` (ela pode ter chegado com o app fechado, nunca passando pelo fetch inicial do Provider) — sem isso, `handlePress` receberia um objeto parcial (só `id`/`link`, sem `message`/`createdAt`) que nunca apareceria de fato na lista, só marcaria como lida no servidor. `NotificationTapHandler` é montado dentro de `NotificationProvider` em `_layout.tsx`, como um filho sem UI (`return null`) — só existe pra rodar o `useEffect` com acesso ao contexto.

## 6. Testes

### 6.1 Backend

- `expo-push.service.spec.ts`: novo caso — `data` presente no payload de `fetch` quando passado, ausente quando omitido.
- `notifications.service.spec.ts`: novo caso — `sendPagamento` chama `ExpoPushService.sendToUser` uma vez por `userId`, com `title`/`body`/`data.notificationId` corretos (mock do `ExpoPushService` injetado, `id`s reais vindos do `createManyAndReturn` contra o SQLite de teste).

### 6.2 Mobile

- `notificacoes.test.tsx` (existente, estendido): nova seção "Notificações" aparece com fixture de `/notifications/mine`; tocar numa notificação não lida marca como lida (chamada a `POST /notifications/:id/read` capturada no mock de `fetch`) e navega quando há `link`; estado vazio só quando as duas listas estão vazias.
- Novo teste para `NotificationProvider`/`useNotificationContext`: badge reflete `unreadCount`, atualiza depois de `handlePress`, refaz fetch em `AppState` voltando a `"active"`.
- Novo teste para o listener de toque (`addNotificationTapListener`): mock de `expo-notifications` (mesmo padrão já usado em `push.test.ts`) confirma que um toque em background chama `handlePress` com os dados certos, e que `getLastNotificationResponseAsync` resolvido cobre o caso de cold start.

## 7. Global Constraints

- Zero mudança de schema Prisma — `Notification`/`PushToken` já têm todos os campos necessários.
- `ExpoPushService.sendToUser` continua best-effort — nenhuma falha de push (token inválido, Expo fora do ar, rede) pode derrubar a criação da `Notification` nem ser visível pro remetente (RH).
- `Notification.link` continua `null` no único produtor real hoje — mesma decisão já registrada na spec web (§1); o caminho de navegação por toque existe, mas não tem destino ainda.
- Um único `NotificationProvider` no `_layout.tsx` raiz é a única fonte de verdade do inbox no mobile — nenhuma tela busca `/notifications/mine` por conta própria (mesma lição da revisão final da spec web).
- Toda interação com `expo-notifications` usa lazy-load (`require`/`import` dinâmico dentro de função, nunca no topo do módulo) — import estático quebra no Expo Go Android (SDK 53+), padrão já estabelecido em `push.ts`/`reminders.ts`.
- Push real testado ponta a ponta só em iPhone físico via Expo Go. Android roda o mesmo código, sem verificação em dispositivo real nesta rodada — revisitar quando/se um dev client (build EAS) entrar em escopo.

## 8. Fora de escopo

- Dev client Android (build EAS) — mencionado acima, decisão explícita de deixar pra depois.
- Badge nativo no ícone do app (contador fora do app) — só o badge interno no sino (§5.1).
- Polling/tempo real enquanto o app está aberto — mesma decisão do web, busca só em pontos de re-entrada (mount + volta ao primeiro plano).
- Preencher `Notification.link` pro produtor de pagamentos — sem destino sensato hoje, mesma justificativa da spec web.
- "Marcar todas como lidas" em lote, paginação em `/notificacoes`, deletar/arquivar notificações — mesmas exclusões já registradas na spec web, aplicam-se igualmente aqui.
- Detecção automática de ponto perdido (próximo item do roadmap, produtor futuro com `link: "/historico"`) — spec própria, depois desta.
