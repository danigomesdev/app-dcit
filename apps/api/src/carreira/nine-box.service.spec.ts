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

  it('never updates in place — each create() is a new row, all returned by list()', async () => {
    await service.create('gestor-1', { userId: 'ninebox-spec-user', desempenho: 'baixo', potencial: 'baixo' });
    await service.create('gestor-1', { userId: 'ninebox-spec-user', desempenho: 'alto', potencial: 'alto' });
    const history = await service.list('ninebox-spec-user');
    expect(history.length).toBeGreaterThanOrEqual(2);
  });
});
