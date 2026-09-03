process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { NineBoxService } from './nine-box.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NineBoxService', () => {
  let service: NineBoxService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NineBoxService, PrismaService],
    }).compile();
    service = module.get(NineBoxService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.nineBoxPlacement.deleteMany({ where: { userId: 'ninebox-spec-user' } });
    await prisma.onModuleDestroy();
  });

  it('creates a placement with the given gestorId', async () => {
    const placement = await service.create('gestor-1', {
      userId: 'ninebox-spec-user',
      desempenho: 'alto',
      potencial: 'medio',
    });
    expect(placement.gestorId).toBe('gestor-1');
  });

  it('never updates in place — a new placement is a new row, and current() returns the most recent', async () => {
    await service.create('gestor-1', { userId: 'ninebox-spec-user', desempenho: 'baixo', potencial: 'baixo' });
    const newest = await service.create('gestor-1', { userId: 'ninebox-spec-user', desempenho: 'alto', potencial: 'alto' });
    const current = await service.current('ninebox-spec-user');
    expect(current?.id).toBe(newest.id);
    const history = await service.list('ninebox-spec-user');
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it('current() returns null when nothing was ever placed', async () => {
    const current = await service.current('ninebox-spec-nobody');
    expect(current).toBeNull();
  });
});
