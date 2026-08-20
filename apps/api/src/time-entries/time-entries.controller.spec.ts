import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './time-entries.service';

describe('TimeEntriesController', () => {
  let controller: TimeEntriesController;
  const serviceMock = { create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimeEntriesController],
      providers: [{ provide: TimeEntriesService, useValue: serviceMock }],
    }).compile();

    controller = module.get(TimeEntriesController);
  });

  it('delegates a valid payload to the service', async () => {
    serviceMock.create.mockResolvedValue({
      id: '1',
      userId: 'user-123',
      clockedAt: new Date(),
      createdAt: new Date(),
    });

    await controller.create({
      userId: 'user-123',
      clockedAt: '2026-08-19T13:00:00.000Z',
    });

    expect(serviceMock.create).toHaveBeenCalledWith({
      userId: 'user-123',
      clockedAt: '2026-08-19T13:00:00.000Z',
    });
  });

  it('rejects an invalid payload before calling the service', async () => {
    await expect(
      controller.create({ userId: '', clockedAt: 'not-a-date' }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.create).not.toHaveBeenCalled();
  });
});
