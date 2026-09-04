process.env.DATABASE_URL = 'file:./test.db';

import { Test, TestingModule } from '@nestjs/testing';
import { CareerEvaluationsService } from './evaluations.service';
import { PrismaService } from '../prisma/prisma.service';

const USER_ID = 'evaluations-spec-user';

describe('CareerEvaluationsService', () => {
  let service: CareerEvaluationsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CareerEvaluationsService, PrismaService],
    }).compile();
    service = module.get(CareerEvaluationsService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
    await prisma.employee.create({
      data: { userId: USER_ID, name: 'Ana Teste', role: 'colaborador', nivel: 'pleno', salarioMensal: 4700, hireDate: new Date('2024-01-01') },
    });
  });

  afterAll(async () => {
    const evaluations = await prisma.careerEvaluation.findMany({ where: { userId: USER_ID } });
    const evaluationIds = evaluations.map((e) => e.id);
    await prisma.careerPrincipioScore.deleteMany({ where: { evaluationId: { in: evaluationIds } } });
    await prisma.careerCompetenciaScore.deleteMany({ where: { evaluationId: { in: evaluationIds } } });
    await prisma.careerRequisitoCheck.deleteMany({ where: { evaluationId: { in: evaluationIds } } });
    await prisma.careerEvaluation.deleteMany({ where: { userId: USER_ID } });
    await prisma.employee.delete({ where: { userId: USER_ID } });
    await prisma.onModuleDestroy();
  });

  const PRINCIPIOS_NOTAS = [
    { principio: 'clareza', nota: 8, justificativa: 'Boa.' },
    { principio: 'meritocracia', nota: 8 },
    { principio: 'equilibrio', nota: 8 },
    { principio: 'transparencia', nota: 8 },
    { principio: 'desenvolvimento', nota: 8 },
  ];
  const COMPETENCIAS_NOTAS = [
    { competencia: 'dominio_tecnico', nota: 6 },
    { competencia: 'qualidade_solucoes', nota: 6 },
    { competencia: 'kpis_tecnicos', nota: 6 },
    { competencia: 'comunicacao_postura', nota: 6 },
    { competencia: 'organizacao_crises', nota: 6 },
    { competencia: 'visao_estrategica', nota: 6 },
  ];

  it('save() creates an evaluation with nivelAvaliado/proximoNivel derived from the employee, and computed mediaGeral', async () => {
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS,
      competencias: COMPETENCIAS_NOTAS,
      requisitosAtendidos: ['Graduação completa'],
    });
    expect(evaluation.nivelAvaliado).toBe('pleno');
    expect(evaluation.proximoNivel).toBe('senior');
    expect(evaluation.status).toBe('salva');
    expect(evaluation.evaluatorId).toBe('gestor-1');
    // (8*5 + 6*6) / 11 = 76/11 = 6.909... -> 6.9
    expect(evaluation.mediaGeral).toBeCloseTo(6.9, 1);
    expect(evaluation.principios).toHaveLength(5);
    expect(evaluation.competencias).toHaveLength(6);
  });

  it('save() persists every requisito of the próximo nível, ignoring atendido labels that belong to a different nível', async () => {
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS,
      competencias: COMPETENCIAS_NOTAS,
      // "Mais de 3 anos de experiência" is a PLENO requisito, not one of SENIOR's —
      // the employee here is pleno, so próximoNivel is senior, and this label must
      // not match (and must not silently get inserted) any of senior's requisitos.
      requisitosAtendidos: ['Mais de 3 anos de experiência'],
    });
    // senior's requisitos: 3 obrigatórios + 4 eletivos = 7 total
    expect(evaluation.requisitos).toHaveLength(7);
    expect(evaluation.requisitos.every((r) => r.atendido === false)).toBe(true);
    expect(evaluation.requisitos.some((r) => r.label === 'Mais de 3 anos de experiência')).toBe(false);
  });

  it('save() marks a requisito atendido when its exact label is sent', async () => {
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS,
      competencias: COMPETENCIAS_NOTAS,
      requisitosAtendidos: ['3 anos ou mais como Pleno, com graduação completa'],
    });
    const graduacao = evaluation.requisitos.find((r) => r.label === '3 anos ou mais como Pleno, com graduação completa');
    expect(graduacao?.atendido).toBe(true);
    expect(evaluation.requisitos.filter((r) => r.atendido).length).toBe(1);
  });

  it('save() called twice updates the same open evaluation in place rather than creating a second one', async () => {
    const first = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS,
      competencias: COMPETENCIAS_NOTAS,
      requisitosAtendidos: [],
    });
    const second = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS.map((p) => ({ ...p, nota: 10 })),
      competencias: COMPETENCIAS_NOTAS,
      requisitosAtendidos: [],
    });
    expect(second.id).toBe(first.id);
    expect(second.principios.every((p) => p.nota === 10)).toBe(true);
    const openCount = await prisma.careerEvaluation.count({ where: { userId: USER_ID, status: 'salva' } });
    expect(openCount).toBe(1);
  });

  it('getOpen() returns null when no evaluation has been saved yet for a different user', async () => {
    const result = await service.getOpen('nobody-has-evaluated-this-user');
    expect(result).toBeNull();
  });

  it('getOpen() returns the open evaluation with its children', async () => {
    await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS,
      competencias: COMPETENCIAS_NOTAS,
      requisitosAtendidos: [],
    });
    const open = await service.getOpen(USER_ID);
    expect(open?.status).toBe('salva');
    expect(open?.principios).toHaveLength(5);
  });

  it('decidir() marks the evaluation decidida with resultado em_desenvolvimento when not eligible, and does not touch Employee', async () => {
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS.map((p) => ({ ...p, nota: 2 })), // too low to be eligible
      competencias: COMPETENCIAS_NOTAS.map((c) => ({ ...c, nota: 2 })),
      requisitosAtendidos: [],
    });
    const decided = await service.decidir(evaluation.id, true);
    expect(decided.status).toBe('decidida');
    expect(decided.resultado).toBe('em_desenvolvimento');
    expect(decided.decidedAt).not.toBeNull();
    const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: USER_ID } });
    expect(employee.nivel).toBe('pleno'); // unchanged
  });

  // A pleno employee's próximoNivel is senior, so eligibility checks senior's
  // obrigatórios — NOT pleno's own ("Mais de 3 anos de experiência" etc.,
  // which are what got this employee INTO pleno, already satisfied in the past).
  const SENIOR_OBRIGATORIOS = [
    '3 anos ou mais como Pleno, com graduação completa',
    'Especialização desejável e no mínimo 3 certificações',
    'Soft skills consolidadas e referência técnica',
  ];

  it('decidir() promotes the employee (nivel + salarioMensal) when eligible and confirmarPromocao is true', async () => {
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS.map((p) => ({ ...p, nota: 10 })),
      competencias: COMPETENCIAS_NOTAS.map((c) => ({ ...c, nota: 10 })),
      requisitosAtendidos: SENIOR_OBRIGATORIOS,
    });
    const decided = await service.decidir(evaluation.id, true);
    expect(decided.resultado).toBe('promovido');
    const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: USER_ID } });
    expect(employee.nivel).toBe('senior');
    expect(employee.salarioMensal).toBe(6000); // senior's first degrau
  });

  it('decidir() computes resultado promovido but does NOT touch Employee when confirmarPromocao is false', async () => {
    await prisma.employee.update({ where: { userId: USER_ID }, data: { nivel: 'pleno', salarioMensal: 4700 } });
    const evaluation = await service.save('gestor-1', {
      userId: USER_ID,
      principios: PRINCIPIOS_NOTAS.map((p) => ({ ...p, nota: 10 })),
      competencias: COMPETENCIAS_NOTAS.map((c) => ({ ...c, nota: 10 })),
      requisitosAtendidos: SENIOR_OBRIGATORIOS,
    });
    const decided = await service.decidir(evaluation.id, false);
    expect(decided.resultado).toBe('promovido');
    const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: USER_ID } });
    expect(employee.nivel).toBe('pleno'); // unchanged — gestor did not confirm
  });
});
