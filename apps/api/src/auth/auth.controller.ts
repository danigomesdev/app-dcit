import {
  BadRequestException,
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
  async login(
    @Query('origin') origin: string,
    @Query('redirectUri') redirectUri: string | undefined,
    @Res() res: Response,
  ) {
    const safeOrigin = origin === 'mobile' ? 'mobile' : 'web';
    const url = await this.authService.buildAuthorizationUrl(
      safeOrigin,
      safeOrigin === 'mobile' ? redirectUri : undefined,
    );
    res.redirect(url);
  }

  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    const { sessionToken, origin, mobileRedirectUri, role } =
      await this.authService.handleCallback(
        process.env.OIDC_REDIRECT_URI as string,
        req.query as Record<string, string>,
      );

    if (origin === 'web' && role === 'colaborador') {
      // The web portal is a gestor/RH tool only — colaboradores use the
      // mobile app for everything they do. Refusing here (before a cookie
      // is ever set) keeps them from landing on a sidebar full of dead
      // links that all resolve to "Sem permissão".
      const loginUrl = new URL(
        '/login',
        process.env.WEB_APP_URL ?? 'http://localhost:3001',
      );
      loginUrl.searchParams.set('error', 'colaborador_web');
      res.redirect(loginUrl.toString());
      return;
    }

    if (origin === 'mobile') {
      // expo-web-browser's openAuthSessionAsync needs a redirect back to the
      // exact redirect URI it was given to close the in-app browser and hand
      // control back to JS. In Expo Go that's an exp:// URL computed by
      // expo-auth-session's makeRedirectUri (Expo Go doesn't own a custom
      // URL scheme like a standalone/dev-client build would), so the app
      // sends it up front on /auth/login and we hand it back here rather
      // than hardcoding one scheme that would only work in a real build.
      if (!mobileRedirectUri) {
        throw new BadRequestException('Missing mobile redirect URI');
      }
      const separator = mobileRedirectUri.includes('?') ? '&' : '?';
      res.redirect(
        `${mobileRedirectUri}${separator}token=${encodeURIComponent(sessionToken)}`,
      );
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
