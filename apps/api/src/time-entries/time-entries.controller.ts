import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TimeEntryInputSchema } from '@ponto-dcit/shared-types';
import { TimeEntriesService } from './time-entries.service';
import { AuthGuard } from '../auth/auth-guard';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('time-entries')
export class TimeEntriesController {
  constructor(private readonly timeEntries: TimeEntriesService) {}

  @UseGuards(AuthGuard)
  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = TimeEntryInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    // Trustworthy-timestamp (simplified tier): the server's own clock is
    // the source of truth for when a punch is recorded, not whatever the
    // device sends — a phone's clock is trivial to change, this endpoint's
    // arrival time isn't. `clockedAt` is still accepted in the request
    // body (the mobile app's offline queue needs it to display "when I
    // tapped" locally before a sync succeeds), but it's never what gets
    // persisted. The full tier — locally signed timestamps so an offline
    // punch's original tap time is itself verifiable — is a larger,
    // separately-scoped piece of work.
    return this.timeEntries.create({
      userId: req.user.sub,
      clockedAt: new Date().toISOString(),
    });
  }

  @UseGuards(AuthGuard)
  @Get()
  async findMine(@Req() req: AuthenticatedRequest) {
    return this.timeEntries.listForUser(req.user.sub);
  }
}
