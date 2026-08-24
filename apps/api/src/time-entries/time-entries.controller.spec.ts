import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './time-entries.service';
import { AuthGuard } from '../auth/auth-guard';
import type { AuthenticatedUser } from '../auth/authenticated-user';

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

    expect(serviceMock.create).toHaveBeenCalledWith({
      userId: 'user-123',
      clockedAt: '2026-08-19T13:00:00.000Z',
    });
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

    expect(serviceMock.create).toHaveBeenCalledWith({
      userId: 'authenticated-user',
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
