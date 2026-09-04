import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { MuralController } from './mural.controller';
import { MuralService } from './mural.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

const GUARDED_HANDLERS = [
  'listPosts',
  'toggleReaction',
  'listBirthdays',
  'createPost',
] as const;

describe('MuralController guard metadata', () => {
  it.each(GUARDED_HANDLERS)('applies AuthGuard to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      MuralController.prototype[handlerName],
    ) as unknown[] | undefined;

    expect(guards).toContain(AuthGuard);
  });

  it.each(['createPost'] as const)('applies RolesGuard(gestor, rh) to %s', (handlerName) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      MuralController.prototype[handlerName],
    ) as unknown[] | undefined;
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      MuralController.prototype[handlerName],
    ) as unknown[] | undefined;

    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual(['gestor', 'rh']);
  });
});

describe('MuralController', () => {
  let controller: MuralController;
  const serviceMock = {
    listPosts: jest.fn(),
    toggleReaction: jest.fn(),
    listBirthdays: jest.fn(),
    createPost: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MuralController],
      providers: [{ provide: MuralService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(MuralController);
  });

  function requestAs(sub: string): Request & { user: AuthenticatedUser } {
    return {
      user: { sub, role: 'colaborador', name: 'Test User' },
    } as Request & {
      user: AuthenticatedUser;
    };
  }

  it('lists posts for the authenticated user', async () => {
    serviceMock.listPosts.mockResolvedValue([]);

    await controller.listPosts(requestAs('user-1'));

    expect(serviceMock.listPosts).toHaveBeenCalledWith('user-1');
  });

  it('toggles a reaction for the authenticated user', async () => {
    serviceMock.toggleReaction.mockResolvedValue({
      reactionCount: 1,
      reacted: true,
    });

    await controller.toggleReaction('post-1', requestAs('user-1'));

    expect(serviceMock.toggleReaction).toHaveBeenCalledWith('post-1', 'user-1');
  });

  it('lists birthdays', async () => {
    serviceMock.listBirthdays.mockResolvedValue([]);

    await controller.listBirthdays();

    expect(serviceMock.listBirthdays).toHaveBeenCalled();
  });

  it('creates a post with a valid payload', async () => {
    serviceMock.createPost.mockResolvedValue({ id: 'post-1' });

    await controller.createPost(
      { glyph: '🎉', title: 'Boas-vindas!', body: 'Corpo.' },
      requestAs('user-1'),
    );

    expect(serviceMock.createPost).toHaveBeenCalledWith(
      { glyph: '🎉', title: 'Boas-vindas!', body: 'Corpo.' },
      'user-1',
    );
  });

  it('rejects a post payload missing a title', async () => {
    await expect(
      controller.createPost({ glyph: '🎉', body: 'Corpo.' }, requestAs('user-1')),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.createPost).not.toHaveBeenCalled();
  });

  it('rejects a post payload with an empty body', async () => {
    await expect(
      controller.createPost(
        { glyph: '🎉', title: 'Boas-vindas!', body: '' },
        requestAs('user-1'),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.createPost).not.toHaveBeenCalled();
  });
});
