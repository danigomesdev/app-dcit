import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { MuralService } from './mural.service';
import { AuthGuard } from '../auth/auth-guard';
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
