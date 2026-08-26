import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PushTokenInputSchema } from '@ponto-dcit/shared-types';
import { PushTokensService } from './push-tokens.service';
import { AuthGuard } from '../auth/auth-guard';
import type { AuthenticatedUser } from '../auth/authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('push-tokens')
export class PushTokensController {
  constructor(private readonly pushTokens: PushTokensService) {}

  @UseGuards(AuthGuard)
  @Post()
  @HttpCode(201)
  async register(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = PushTokenInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.pushTokens.registerToken(req.user.sub, result.data.token);
  }
}
