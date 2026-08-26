import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login')
  async login(@Query('origin') origin: string, @Res() res: Response) {
    const safeOrigin = origin === 'mobile' ? 'mobile' : 'web';
    const url = await this.authService.buildAuthorizationUrl(safeOrigin);
    res.redirect(url);
  }

  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    const { sessionToken, origin } = await this.authService.handleCallback(
      process.env.OIDC_REDIRECT_URI as string,
      req.query as Record<string, string>,
    );

    if (origin === 'mobile') {
      res.json({ token: sessionToken });
      return;
    }

    res.cookie('ponto_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });
    res.redirect(process.env.WEB_APP_URL ?? 'http://localhost:3001');
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('ponto_session');
  }
}
