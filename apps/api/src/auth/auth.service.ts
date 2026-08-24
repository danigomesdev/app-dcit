import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { generators, type Client } from 'openid-client';
import type { Role } from '@ponto-dcit/shared-types';
import { OIDC_CLIENT } from './oidc-client.token';

type LoginOrigin = 'web' | 'mobile';
type PendingLogin = { nonce: string; origin: LoginOrigin };

@Injectable()
export class AuthService {
  private readonly pendingLogins = new Map<string, PendingLogin>();

  constructor(
    @Inject(OIDC_CLIENT) private readonly client: Client,
    private readonly jwt: JwtService,
  ) {}

  buildAuthorizationUrl(origin: LoginOrigin): string {
    const state = generators.state();
    const nonce = generators.nonce();
    this.pendingLogins.set(state, { nonce, origin });

    return this.client.authorizationUrl({
      scope: 'openid profile email',
      state,
      nonce,
    });
  }

  async handleCallback(
    redirectUri: string,
    params: Record<string, string>,
  ): Promise<{ sessionToken: string; origin: LoginOrigin }> {
    const pending = params.state
      ? this.pendingLogins.get(params.state)
      : undefined;
    if (!pending) {
      throw new BadRequestException('Unknown or expired login attempt');
    }
    this.pendingLogins.delete(params.state);

    const tokenSet = await this.client.callback(redirectUri, params, {
      state: params.state,
      nonce: pending.nonce,
    });
    const { sub } = tokenSet.claims();
    // The id_token from a plain `response_type=code` exchange only carries
    // the required OpenID claims (sub, iss, aud, ...); scope-derived profile
    // claims like name/dcit_role are only available from the UserInfo
    // endpoint, so they must be fetched separately rather than read off the
    // id_token's claims.
    const userinfo = (await this.client.userinfo(tokenSet)) as {
      name?: string;
      dcit_role?: unknown;
    };
    const role = this.resolveRole(userinfo.dcit_role);

    const sessionToken = this.jwt.sign({
      sub,
      role,
      name: userinfo.name,
    });

    return { sessionToken, origin: pending.origin };
  }

  private resolveRole(claim: unknown): Role {
    if (claim === 'colaborador' || claim === 'gestor' || claim === 'rh') {
      return claim;
    }
    throw new BadRequestException(`Unrecognized role claim: ${String(claim)}`);
  }
}
