process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { OperacionalService } from './operacional.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OperacionalService', () => {
  let service: OperacionalService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OperacionalService, PrismaService],
    }).compile();

    service = module.get(OperacionalService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.sobreavisoRecord.deleteMany();
    await prisma.deslocamentoRecord.deleteMany();
    await prisma.onModuleDestroy();
  });

  it('reports inactive sobreaviso when there is no open record', async () => {
    const status = await service.getSobreavisoStatus('user-a');
    expect(status).toEqual({ active: false, startedAt: null });
  });

  it('toggles sobreaviso on then off', async () => {
    const activated = await service.toggleSobreaviso('user-b');
    expect(activated.active).toBe(true);
    expect(activated.startedAt).toBeInstanceOf(Date);

    const statusWhileActive = await service.getSobreavisoStatus('user-b');
    expect(statusWhileActive.active).toBe(true);

    const deactivated = await service.toggleSobreaviso('user-b');
    expect(deactivated).toEqual({ active: false, startedAt: null });

    const statusAfter = await service.getSobreavisoStatus('user-b');
    expect(statusAfter).toEqual({ active: false, startedAt: null });
  });

  it('creates and lists deslocamentos scoped to the user, newest first', async () => {
    await service.createDeslocamento('user-c', {
      startedAt: '2026-08-20T10:00:00.000Z',
      endedAt: '2026-08-20T10:30:00.000Z',
    });
    await service.createDeslocamento('user-c', {
      startedAt: '2026-08-21T09:00:00.000Z',
      endedAt: '2026-08-21T09:45:00.000Z',
    });
    await service.createDeslocamento('user-other', {
      startedAt: '2026-08-21T09:00:00.000Z',
      endedAt: '2026-08-21T09:45:00.000Z',
    });

    const results = await service.listDeslocamentos('user-c');

    expect(results).toHaveLength(2);
    expect(results[0].startedAt.toISOString()).toBe('2026-08-21T09:00:00.000Z');
  });
});
