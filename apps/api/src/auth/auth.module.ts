import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth-guard';
import { RolesGuard } from './roles.guard';
import { OIDC_CLIENT_CONFIG, type OidcClientConfig } from './oidc-client.token';

// Kept as a single reference so the exact same dynamic module instance is
// both imported (so AuthModule's own providers can use JwtService) and
// re-exported (so AuthGuard, when instantiated for a *different* module via
// `@UseGuards(AuthGuard)`, can still resolve its JwtService dependency there).
const jwtModule = JwtModule.registerAsync({
  useFactory: () => ({
    secret: process.env.JWT_SECRET,
    signOptions: { expiresIn: '8h' },
  }),
});

@Module({
  imports: [jwtModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    RolesGuard,
    {
      // Just plain env config — no network I/O here. Actual OIDC discovery
      // (Issuer.discover) is deferred to AuthService's first real login
      // attempt, so an unreachable IdP can't stop the app from booting.
      provide: OIDC_CLIENT_CONFIG,
      useFactory: (): OidcClientConfig => ({
        issuerUrl: process.env.OIDC_ISSUER_URL as string,
        clientId: process.env.OIDC_CLIENT_ID as string,
        clientSecret: process.env.OIDC_CLIENT_SECRET,
        redirectUri: process.env.OIDC_REDIRECT_URI as string,
      }),
    },
  ],
  exports: [AuthGuard, RolesGuard, jwtModule],
})
export class AuthModule {}
