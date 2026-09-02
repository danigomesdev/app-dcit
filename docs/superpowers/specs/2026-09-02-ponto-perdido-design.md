# Detecção Automática de Ponto Perdido

**Status:** Proposto
**Arquitetura de referência:** [`docs/superpowers/specs/2026-08-19-arquitetura-ponto-dcit-design.md`](2026-08-19-arquitetura-ponto-dcit-design.md)
**Spec relacionada (mesma infraestrutura de notificações):** [`2026-09-02-notificacoes-mobile-design.md`](2026-09-02-notificacoes-mobile-design.md)

## 1. Objetivo e escopo

Último item do roadmap de notificações: o produtor futuro já previsto pra tabela `Notification` genérica desde a spec de Pagamentos, agora que toda a infraestrutura de envio (API + sino/inbox web e mobile + push real) já está pronta e testada.

**O que detecta:** todo dia, de manhã, um job olha o dia São Paulo que acabou de fechar (ontem) pra cada colaborador ativo e identifica dois casos:
1. **Saída esquecida** — bateu ponto de entrada mas não de saída (contagem ímpar de pontos no dia).
2. **Ausência total** — nenhum ponto registrado no dia, sem férias ou atestado aprovado cobrindo a data, e não é fim de semana.

**Quem recebe:** o próprio colaborador (aviso pra regularizar) **e** todo usuário com role `gestor` ou `rh` (broadcast — decidido em conversa: não existe hoje nenhum vínculo "gestor de tal colaborador" no schema, `role` é só um texto solto em `Employee` e `team` é texto livre sem relação com gestor nenhum; a alternativa de só um relatório sob demanda, sem push, foi descartada). Um colaborador que também seja gestor/rh e perca o próprio ponto recebe só a notificação pessoal, não a cópia de broadcast do próprio caso (ver §2.2).

**Zero telas novas.** Reaproveita o sino/inbox que já existe nas duas plataformas — mesma decisão de escopo da spec anterior, aqui ainda mais direta porque não há nem um botão RH pra construir (diferente de Pagamentos): este produtor só roda via cron, sem endpoint HTTP.

**Nova dependência:** `@nestjs/schedule` — não existe hoje nenhuma infraestrutura de job agendado neste backend (`AlertasService`, o único "detector automático" existente, roda de forma reativa a cada ponto batido, não em background). Detecção de ausência/saída esquecida não dá pra fazer só reativo: se a pessoa nunca mais bater ponto, nada dispara.

## 2. Backend (`apps/api`)

### 2.1 `NotificationsService.sendPontoPerdido` (novo método)

```typescript
export type PontoPerdidoTipo = 'saida_esquecida' | 'ausencia';

const PONTO_PERDIDO_MESSAGE_COLABORADOR: Record<
  PontoPerdidoTipo,
  (dateBR: string) => string
> = {
  saida_esquecida: (dateBR) =>
    `Você esqueceu de bater o ponto de saída em ${dateBR}.`,
  ausencia: (dateBR) =>
    `Não identificamos nenhum ponto registrado em ${dateBR}.`,
};

const PONTO_PERDIDO_MESSAGE_GESTOR: Record<
  PontoPerdidoTipo,
  (employeeName: string, dateBR: string) => string
> = {
  saida_esquecida: (name, dateBR) =>
    `${name} esqueceu de bater o ponto de saída em ${dateBR}.`,
  ausencia: (name, dateBR) =>
    `${name} não registrou nenhum ponto em ${dateBR}.`,
};

async sendPontoPerdido(
  tipo: PontoPerdidoTipo,
  employeeUserId: string,
  employeeName: string,
  dateOnly: string, // "YYYY-MM-DD", já resolvido em São Paulo pelo chamador
): Promise<void> {
  const dateBR = formatDateOnlyBR(dateOnly); // "DD/MM/AAAA" — ver §2.1.1
  const managers = await this.prisma.employee.findMany({
    where: {
      role: { in: ['gestor', 'rh'] },
      deletedAt: null,
      userId: { not: employeeUserId }, // exclui o próprio colaborador, caso ele também seja gestor/rh
    },
  });

  const recipients = [
    {
      userId: employeeUserId,
      message: PONTO_PERDIDO_MESSAGE_COLABORADOR[tipo](dateBR),
      link: '/historico',
    },
    ...managers.map((m) => ({
      userId: m.userId,
      message: PONTO_PERDIDO_MESSAGE_GESTOR[tipo](employeeName, dateBR),
      link: null,
    })),
  ];

  const created = await this.prisma.notification.createManyAndReturn({
    data: recipients.map((r) => ({
      userId: r.userId,
      type: 'ponto_perdido',
      category: tipo,
      message: r.message,
      link: r.link,
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

`void Promise.all(...)` — fire-and-forget, mesma convenção já usada por todo outro produtor de push no código (`atestados.service.ts`, `alertas.service.ts`, `solicitacoes.service.ts`, `operacional.service.ts`, e `sendPagamento` desde a correção da revisão final da spec anterior). **Nunca usar `await` aqui** — foi exatamente o bug que a revisão final da spec anterior pegou e corrigiu.

### 2.1.1 `formatDateOnlyBR` (novo helper, `apps/api/src/common/sao-paulo-time.ts`)

```typescript
// "YYYY-MM-DD" -> "DD/MM/AAAA", pra mensagens voltadas a humano. Entrada já é
// date-only (sem componente de hora) — sem necessidade de re-resolver fuso.
export function formatDateOnlyBR(dateOnly: string): string {
  const [year, month, day] = dateOnly.split('-');
  return `${day}/${month}/${year}`;
}
```

### 2.2 `apps/api/src/ponto-perdido/ponto-perdido.service.ts` (novo)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { dateOnlyInSaoPaulo, isWeekend } from '../common/sao-paulo-time';

@Injectable()
export class PontoPerdidoService {
  private readonly logger = new Logger(PontoPerdidoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // 06:00 América/São_Paulo, todo dia — bem depois da virada de dia, dando
  // tempo de qualquer ajuste retroativo same-day (ex: /ajustar aprovado
  // ainda ontem à noite) já estar refletido antes de este job rodar.
  @Cron('0 6 * * *', { timeZone: 'America/Sao_Paulo' })
  async handleCron(): Promise<void> {
    await this.run(new Date());
  }

  // Separado de handleCron pra ser chamável direto nos testes, com uma data
  // fixa, sem depender de mockar o relógio do sistema.
  async run(now: Date): Promise<void> {
    // Best-effort: uma falha aqui (ex: push fora do ar) nunca pode travar o
    // agendador nem impedir a próxima execução diária.
    try {
      const todaySP = dateOnlyInSaoPaulo(now);
      const targetDate = new Date(`${todaySP}T00:00:00.000Z`);
      targetDate.setUTCDate(targetDate.getUTCDate() - 1);
      const targetDateSP = dateOnlyInSaoPaulo(targetDate);

      if (isWeekend(targetDateSP)) return;

      const startOfTarget = new Date(`${targetDateSP}T03:00:00.000Z`); // meia-noite SP = UTC 03:00
      const endOfTarget = new Date(startOfTarget);
      endOfTarget.setUTCDate(endOfTarget.getUTCDate() + 1);
      const targetDateMidnightUTC = new Date(`${targetDateSP}T00:00:00.000Z`);

      // hireDate não filtra na query: é armazenado como meia-noite UTC do dia
      // de contratação (mesma convenção de "new Date('YYYY-MM-DD')" usada em
      // EmployeesService), enquanto endOfTarget é meia-noite de São Paulo (UTC
      // 03:00) — comparar os dois direto na query bateria as convenções
      // erradas (ex: hireDate = 2026-09-02T00:00:00Z passaria como "<=" um
      // endOfTarget de 2026-09-02T03:00:00Z mesmo tendo sido contratado no dia
      // seguinte ao alvo). Normaliza os dois lados pra data-only em São Paulo
      // antes de comparar como string, sem essa ambiguidade.
      const allActiveEmployees = await this.prisma.employee.findMany({
        where: { deletedAt: null },
      });
      const employees = allActiveEmployees.filter(
        (e) => dateOnlyInSaoPaulo(e.hireDate) <= targetDateSP,
      );
      const userIds = employees.map((e) => e.userId);

      const entries = await this.prisma.timeEntry.findMany({
        where: { userId: { in: userIds }, clockedAt: { gte: startOfTarget, lt: endOfTarget } },
      });
      const countByUserId = new Map<string, number>();
      for (const entry of entries) {
        countByUserId.set(entry.userId, (countByUserId.get(entry.userId) ?? 0) + 1);
      }

      const vacations = await this.prisma.vacationRequest.findMany({
        where: {
          userId: { in: userIds },
          status: 'aprovado',
          startDate: { lte: targetDateMidnightUTC },
          endDate: { gte: targetDateMidnightUTC },
        },
      });
      const onVacation = new Set(vacations.map((v) => v.userId));

      // Mesma lógica de cobertura de período que TimeEntriesService.listTeamToday
      // já usa (periodStart/periodEnd calculados a partir de createdAt + dias),
      // só que checando o dia alvo em vez de hoje.
      const atestados = await this.prisma.atestado.findMany({
        where: { userId: { in: userIds }, status: 'aprovado', dias: { not: null } },
      });
      const onAtestado = new Set<string>();
      for (const atestado of atestados) {
        const periodStart = new Date(`${dateOnlyInSaoPaulo(atestado.createdAt)}T00:00:00.000Z`);
        const periodEnd = new Date(periodStart);
        periodEnd.setUTCDate(periodEnd.getUTCDate() + (atestado.dias ?? 0));
        if (periodStart <= targetDateMidnightUTC && targetDateMidnightUTC < periodEnd) {
          onAtestado.add(atestado.userId);
        }
      }

      for (const employee of employees) {
        const count = countByUserId.get(employee.userId) ?? 0;

        if (count === 0) {
          if (onVacation.has(employee.userId) || onAtestado.has(employee.userId)) continue;
          await this.notifications.sendPontoPerdido(
            'ausencia',
            employee.userId,
            employee.name,
            targetDateSP,
          );
        } else if (count % 2 === 1) {
          await this.notifications.sendPontoPerdido(
            'saida_esquecida',
            employee.userId,
            employee.name,
            targetDateSP,
          );
        }
        // count par e >= 2: dia fechado corretamente, nada a fazer.
      }
    } catch (error) {
      this.logger.warn(`Falha ao rodar detecção de ponto perdido: ${String(error)}`);
    }
  }
}
```

`hireDate: { lte: endOfTarget }` exclui quem foi contratado depois do dia alvo (não existia ainda, não pode ter "perdido" um ponto que nunca deveria bater). `isWeekend(targetDateSP)` no topo do `run` pula o dia inteiro num fim de semana — mais barato que checar por funcionário, e sem `expectedStartTime`/escala variável neste MVP, todo mundo tem o mesmo fim de semana.

### 2.3 `apps/api/src/ponto-perdido/ponto-perdido.module.ts` (novo)

```typescript
import { Module } from '@nestjs/common';
import { PontoPerdidoService } from './ponto-perdido.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [PontoPerdidoService],
})
export class PontoPerdidoModule {}
```

`PrismaModule` não precisa ser importado (já é `@Global()`). `NotificationsModule` precisa ser importado (e precisa **exportar** `NotificationsService` — hoje ele não exporta nada, só declara como `provider`; isso muda no §2.4) pra `PontoPerdidoService` conseguir injetar `NotificationsService`.

### 2.4 `apps/api/src/notifications/notifications.module.ts` (modificado)

```typescript
@Module({
  imports: [AuthModule, PushModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService], // novo — PontoPerdidoModule precisa injetar isto
})
export class NotificationsModule {}
```

### 2.5 `apps/api/src/app.module.ts` (modificado)

```typescript
import { ScheduleModule } from '@nestjs/schedule';
// ...
import { PontoPerdidoModule } from './ponto-perdido/ponto-perdido.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    // ...módulos existentes, inalterados...
    NotificationsModule,
    PontoPerdidoModule,
  ],
  // ...
})
export class AppModule {}
```

`ScheduleModule.forRoot()` é o que de fato registra os handlers `@Cron` — sem isso, o decorator em `PontoPerdidoService` não faz nada.

### 2.6 `apps/api/package.json` (modificado)

Adiciona `"@nestjs/schedule": "^5.0.1"` em `dependencies`.

## 3. Testes

### 3.1 `apps/api/src/notifications/notifications.service.spec.ts` (estendido)

Novo `describe('sendPontoPerdido', ...)`, mesmo padrão de mock de `ExpoPushService` já usado em `sendPagamento`:
- Cria notificação pro colaborador com `link: '/historico'` e a mensagem certa por `tipo`.
- Cria uma notificação por gestor/rh ativo, `link: null`, mensagem incluindo o nome do colaborador.
- **Exclui o próprio colaborador da lista de broadcast** quando ele também tem role gestor/rh (fixture: um "gestor" que perde o próprio ponto recebe só 1 notificação, não 2).
- Dispara `sendToUser` pra cada destinatário criado, com `data.notificationId`/`data.link` corretos.
- `formatDateOnlyBR` formata `"2026-09-01"` como `"01/09/2026"`.

### 3.2 `apps/api/src/ponto-perdido/ponto-perdido.service.spec.ts` (novo)

`run(now)` chamado direto com uma `Date` fixa (nunca depende do cron de verdade disparar). `ExpoPushService`/`NotificationsService` — usar o `NotificationsService` real (não mockado) contra o SQLite de teste, mockando só `ExpoPushService` no nível mais baixo (mesmo padrão de "teste de integração real, só a borda externa é mock" já estabelecido em `notifications.service.spec.ts`), pra também validar a criação de `Notification` de ponta a ponta.

Casos (todos com `now` fixo, ex: `2026-09-02T09:00:00.000Z`, então o dia alvo é `2026-09-01`, uma terça-feira):
- Funcionário com 1 ponto no dia alvo → `saida_esquecida` disparado.
- Funcionário com 3 pontos (entrada/saída/entrada, sem fechar) → `saida_esquecida` disparado (ímpar, não importa a contagem exata).
- Funcionário com 0 pontos, sem férias/atestado, dia de semana → `ausencia` disparado.
- Funcionário com 2 ou 4 pontos → nada disparado.
- Funcionário com 0 pontos mas férias aprovada cobrindo o dia → nada disparado.
- Funcionário com 0 pontos mas atestado aprovado cobrindo o dia → nada disparado.
- Dia alvo cai num sábado/domingo (variar `now` pra isso) → nada disparado pra ninguém, função retorna cedo.
- Funcionário contratado depois do dia alvo (`hireDate` > dia alvo) → excluído, nada disparado mesmo com 0 pontos.
- Funcionário com `deletedAt` preenchido → excluído da varredura inteira.
- Uma falha do Prisma no meio da varredura (mock de erro) não deve propagar pra fora de `run` — captura e loga, mesmo padrão de `AlertasService.checkAfterPunch`.

## 4. Global Constraints

- Zero mudança de schema Prisma — `Notification`, `Employee`, `TimeEntry`, `VacationRequest`, `Atestado` já têm todos os campos necessários. `type: 'ponto_perdido'` e `category: 'saida_esquecida' | 'ausencia'` são só valores novos no mesmo campo `String`/`String?` já genérico.
- Zero mudança em `packages/shared-types` — sem endpoint HTTP novo (diferente de `sendPagamento`), então sem schema Zod novo pra validar entrada de usuário.
- `sendPontoPerdido` deve disparar push com `void Promise.all(...)`, nunca `await` — mesma convenção de todo outro produtor de push no código, e a lição direta da revisão final da spec anterior.
- `NotificationsService.sendToUser`/push continuam best-effort — nenhuma falha de push pode propagar. `PontoPerdidoService.run` também é best-effort no nível do job inteiro: uma falha (ex: Prisma fora do ar num dia) é logada, nunca derruba o processo do backend nem impede a próxima execução diária.
- O colaborador que perde o próprio ponto e também é gestor/rh recebe só a notificação pessoal — nunca a cópia de broadcast do próprio caso.
- `run(now: Date)` sempre separado do `@Cron handleCron()` — testável com data fixa, sem mockar relógio do sistema.
- Sem tela nova em `apps/web` ou `apps/mobile` — este produtor só precisa que o sino/inbox já existente (construído na spec anterior) continue funcionando como está.

## 5. Fora de escopo

- Roteamento por gestor específico do colaborador — não existe esse vínculo no schema hoje; broadcast pra todo gestor/rh é a decisão adotada (§1).
- Endpoint HTTP pra disparar manualmente ou reprocessar um dia específico — só roda via cron. Se um reprocessamento manual for necessário no futuro (ex: o job caiu um dia), é uma extensão futura, não parte desta spec.
- Configurar `expectedStartTime`/escala por funcionário na decisão de "dia útil esperado" — hoje todo mundo tem o mesmo fim de semana (sábado/domingo); jornadas variáveis (ex: alguém que trabalha fins de semana) ficam de fora deste MVP, mesma simplificação que `TimeEntriesService.listTeamToday` já assume.
- Deduplicação explícita (ex: uma tabela de "já notificado") — desnecessária porque o job só olha o dia que acabou de fechar, nunca reprocessa dias antigos.
- Qualquer mudança na UI do sino/inbox — reaproveita integralmente o que já existe.
