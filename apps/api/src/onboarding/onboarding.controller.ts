import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { OnboardingService } from './onboarding.service';
import { AuthGuard } from '../auth/auth-guard';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @UseGuards(AuthGuard)
  @Get('tarefas')
  getTasks(@Req() req: AuthenticatedRequest) {
    return this.onboarding.getTasks(req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Post('tarefas/:taskId/toggle')
  toggleTask(
    @Param('taskId') taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.onboarding.toggleTask(req.user.sub, taskId);
  }
}
