import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './time-entries.service';
import { AuthGuard } from '../auth/auth-guard';
import type { AuthenticatedUser } from '../auth/authenticated-user';

describe('TimeEntriesController guard metadata', () => {
  // Deliberately does NOT go through TestingModule/.overrideGuard: it reads
  // the guard metadata Nest actually attached to the handler via
  // `@UseGuards(AuthGuard)`, so it fails if that decorator is ever removed —
  // something the behavioral tests below can't catch, since they override
  // the guard with an always-allow stub. Design spec §8 requires API test
  // coverage that POST /time-entries is guarded.
  it('applies AuthGuard to the create (POST) handler', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // Read as a function reference for Reflect metadata, never called
      // unbound.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      TimeEntriesController.prototype.create,
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
  });
});

describe('TimeEntriesController', () => {
  let controller: TimeEntriesController;
  const serviceMock = { create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimeEntriesController],
      providers: [{ provide: TimeEntriesService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(TimeEntriesController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return {
      user: { sub, role: 'colaborador', name: 'Test User' },
    } as Request & { user: AuthenticatedUser };
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('delegates a valid payload to the service using the authenticated user id', async () => {
    serviceMock.create.mockResolvedValue({
      id: '1',
      userId: 'user-123',
      clockedAt: new Date(),
      createdAt: new Date(),
    });

    await controller.create(
      { userId: 'user-123', clockedAt: '2026-08-19T13:00:00.000Z' },
      requestAs('user-123'),
    );

    expect(serviceMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-123' }),
    );
  });

  it('ignores a userId in the request body and uses the authenticated user instead', async () => {
    serviceMock.create.mockResolvedValue({
      id: '2',
      userId: 'authenticated-user',
      clockedAt: new Date(),
      createdAt: new Date(),
    });

    await controller.create(
      { userId: 'someone-else', clockedAt: '2026-08-19T13:00:00.000Z' },
      requestAs('authenticated-user'),
    );

    expect(serviceMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'authenticated-user' }),
    );
  });

  it('stamps clockedAt with the server clock, ignoring whatever the client sent', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-19T13:00:00.000Z'));
    serviceMock.create.mockResolvedValue({
      id: '3',
      userId: 'user-123',
      clockedAt: new Date(),
      createdAt: new Date(),
    });

    // Client claims a punch from a week earlier — a spoofed device clock.
    await controller.create(
      { userId: 'user-123', clockedAt: '2026-08-12T09:00:00.000Z' },
      requestAs('user-123'),
    );

    expect(serviceMock.create).toHaveBeenCalledWith({
      userId: 'user-123',
      clockedAt: '2026-08-19T13:00:00.000Z',
    });
  });

  it('rejects an invalid payload before calling the service', async () => {
    await expect(
      controller.create(
        { userId: '', clockedAt: 'not-a-date' },
        requestAs('user-123'),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.create).not.toHaveBeenCalled();
  });
});
