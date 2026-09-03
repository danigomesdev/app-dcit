process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { TrackRequirementsService } from './trilha.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TrackRequirementsService', () => {
  let service: TrackRequirementsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrackRequirementsService, PrismaService],
    }).compile();
    service = module.get(TrackRequirementsService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.trackRequirement.deleteMany({ where: { userId: 'trilha-spec-user' } });
    await prisma.onModuleDestroy();
  });

  it('creates a requirement defaulting to pendente', async () => {
    const req = await service.create({ userId: 'trilha-spec-user', title: 'Certificação AWS' });
    expect(req.status).toBe('pendente');
  });

  it('lists only requirements for the given user', async () => {
    await service.create({ userId: 'trilha-spec-other', title: 'Outro' });
    const reqs = await service.list('trilha-spec-user');
    expect(reqs.every((r) => r.userId === 'trilha-spec-user')).toBe(true);
  });

  it('updates status', async () => {
    const req = await service.create({ userId: 'trilha-spec-user', title: 'Curso X' });
    const updated = await service.updateStatus(req.id, 'concluido');
    expect(updated.status).toBe('concluido');
  });

  it('removes a requirement', async () => {
    const req = await service.create({ userId: 'trilha-spec-user', title: 'Temp' });
    await service.remove(req.id);
    const reqs = await service.list('trilha-spec-user');
    expect(reqs.find((r) => r.id === req.id)).toBeUndefined();
  });
});
