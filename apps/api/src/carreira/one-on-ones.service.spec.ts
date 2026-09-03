process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { OneOnOnesService } from './one-on-ones.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OneOnOnesService', () => {
  let service: OneOnOnesService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OneOnOnesService, PrismaService],
    }).compile();
    service = module.get(OneOnOnesService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    const records = await prisma.oneOnOne.findMany({ where: { userId: 'oneonone-spec-user' } });
    await prisma.oneOnOneAcao.deleteMany({ where: { oneOnOneId: { in: records.map((r) => r.id) } } });
    await prisma.oneOnOne.deleteMany({ where: { userId: 'oneonone-spec-user' } });
    await prisma.onModuleDestroy();
  });

  it('creates a OneOnOne and its acoes together, with gestorId from the caller', async () => {
    const created = await service.create('gestor-1', {
      userId: 'oneonone-spec-user',
      pauta: 'Alinhamento mensal',
      acoes: [{ descricao: 'Enviar relatório' }, { descricao: 'Marcar follow-up' }],
    });
    expect(created.gestorId).toBe('gestor-1');
    expect(created.acoes).toHaveLength(2);
    expect(created.acoes.every((a) => a.status === 'pendente')).toBe(true);
  });

  it('lists each OneOnOne with its own acoes joined, not mixed with another record\'s', async () => {
    const first = await service.create('gestor-1', {
      userId: 'oneonone-spec-user',
      pauta: 'Conversa 1',
      acoes: [{ descricao: 'Ação A' }],
    });
    const second = await service.create('gestor-1', {
      userId: 'oneonone-spec-user',
      pauta: 'Conversa 2',
      acoes: [{ descricao: 'Ação B' }],
    });
    const list = await service.list('oneonone-spec-user');
    const firstListed = list.find((r) => r.id === first.id);
    const secondListed = list.find((r) => r.id === second.id);
    expect(firstListed?.acoes.map((a) => a.descricao)).toEqual(['Ação A']);
    expect(secondListed?.acoes.map((a) => a.descricao)).toEqual(['Ação B']);
  });

  it('toggling one acao status does not affect siblings from the same OneOnOne', async () => {
    const created = await service.create('gestor-1', {
      userId: 'oneonone-spec-user',
      pauta: 'Conversa 3',
      acoes: [{ descricao: 'Ação C' }, { descricao: 'Ação D' }],
    });
    await service.updateAcaoStatus(created.acoes[0].id, 'concluido');
    const list = await service.list('oneonone-spec-user');
    const record = list.find((r) => r.id === created.id);
    const updated = record?.acoes.find((a) => a.id === created.acoes[0].id);
    const untouched = record?.acoes.find((a) => a.id === created.acoes[1].id);
    expect(updated?.status).toBe('concluido');
    expect(untouched?.status).toBe('pendente');
  });
});
