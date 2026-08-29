process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { ConvencoesService } from './convencoes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ConvencoesService', () => {
  let service: ConvencoesService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConvencoesService, PrismaService],
    }).compile();

    service = module.get(ConvencoesService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.convencaoColetiva.deleteMany({
      where: { nome: { startsWith: 'Convenção Teste ' } },
    });
    await prisma.onModuleDestroy();
  });

  const VALID_INPUT = {
    nome: 'Convenção Teste A',
    cnpj: '12345678000199',
    categoriaSindical: 'Metalúrgicos',
    expectedDailyMinutes: 480,
    overtimePercent: 50,
  };

  it('creates and lists a convenção', async () => {
    const created = await service.create(VALID_INPUT);

    expect(created.nome).toBe('Convenção Teste A');
    expect(created.expectedDailyMinutes).toBe(480);

    const all = await service.list();
    expect(all.find((c) => c.id === created.id)?.nome).toBe(
      'Convenção Teste A',
    );
  });

  it('lists ordered by nome ascending', async () => {
    await service.create({ ...VALID_INPUT, nome: 'Convenção Teste Zebra' });
    await service.create({ ...VALID_INPUT, nome: 'Convenção Teste Abelha' });

    const all = await service.list();
    const names = all
      .map((c) => c.nome)
      .filter((n) => n.startsWith('Convenção Teste'));
    expect(names).toEqual([...names].sort());
  });

  it('updates a convenção', async () => {
    const created = await service.create({
      ...VALID_INPUT,
      nome: 'Convenção Teste B',
    });

    const updated = await service.update(created.id, {
      ...VALID_INPUT,
      nome: 'Convenção Teste B Editada',
      overtimePercent: 100,
    });

    expect(updated.nome).toBe('Convenção Teste B Editada');
    expect(updated.overtimePercent).toBe(100);
  });

  it('deletes a convenção', async () => {
    const created = await service.create({
      ...VALID_INPUT,
      nome: 'Convenção Teste C',
    });

    await service.delete(created.id);

    const all = await service.list();
    expect(all.find((c) => c.id === created.id)).toBeUndefined();
  });

  it('does not throw when deleting an id that does not exist', async () => {
    await expect(service.delete('does-not-exist')).resolves.not.toThrow();
  });

  it('throws NotFoundException when updating an id that does not exist', async () => {
    await expect(service.update('does-not-exist', VALID_INPUT)).rejects.toThrow(
      'Convenção coletiva não encontrada.',
    );
  });
});
