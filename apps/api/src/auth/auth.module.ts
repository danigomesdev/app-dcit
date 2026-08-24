import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Issuer, type Client } from 'openid-client';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth-guard';

export const OIDC_CLIENT = Symbol('OIDC_CLIENT');

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    {
      provide: OIDC_CLIENT,
      useFactory: async (): Promise<Client> => {
        const issuer = await Issuer.discover(
          process.env.OIDC_ISSUER_URL as string,
        );
        return new issuer.Client({
          client_id: process.env.OIDC_CLIENT_ID as string,
          client_secret: process.env.OIDC_CLIENT_SECRET,
          redirect_uris: [process.env.OIDC_REDIRECT_URI as string],
          response_types: ['code'],
        });
      },
    },
  ],
  exports: [AuthGuard],
})
export class AuthModule {}
