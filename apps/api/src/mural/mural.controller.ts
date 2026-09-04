import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { MuralPostInputSchema } from '@ponto-dcit/shared-types';
import { MuralService } from './mural.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('mural')
export class MuralController {
  constructor(private readonly mural: MuralService) {}

  @UseGuards(AuthGuard)
  @Get('posts')
  listPosts(@Req() req: AuthenticatedRequest) {
    return this.mural.listPosts(req.user.sub);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Post('posts')
  @HttpCode(201)
  async createPost(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = MuralPostInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.mural.createPost(result.data, req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Post('posts/:id/react')
  toggleReaction(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.mural.toggleReaction(id, req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Get('birthdays')
  listBirthdays() {
    return this.mural.listBirthdays();
  }
}
