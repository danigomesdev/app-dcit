import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Issuer, generators, type Client } from 'openid-client';
import type { Role } from '@ponto-dcit/shared-types';
import { OIDC_CLIENT_CONFIG, type OidcClientConfig } from './oidc-client.token';

type LoginOrigin = 'web' | 'mobile';
type PendingLogin = {
  nonce: string;
  origin: LoginOrigin;
  mobileRedirectUri?: string;
};

// Identity mapping today because the mock IdP already emits our exact
// role strings. When a real IdP is wired up, its claim shape (e.g. Entra
// ID group GUIDs) is unknown yet — this is the one place to update the
// mapping without touching any other code, per design spec §6.
const CLAIM_TO_ROLE = new Map<string, Role>([
  ['colaborador', 'colaborador'],
  ['gestor', 'gestor'],
  ['rh', 'rh'],
]);

@Injectable()
export class AuthService {
  private readonly pendingLogins = new Map<string, PendingLogin>();
  private clientPromise: Promise<Client> | null = null;

  constructor(
    @Inject(OIDC_CLIENT_CONFIG) private readonly config: OidcClientConfig,
    private readonly jwt: JwtService,
  ) {}

  // OIDC discovery hits the IdP over the network, so it can't run at module
  // init / app boot without making the whole API's startup (including
  // /health) depend on the IdP being reachable. Instead it's deferred to the
  // first real login attempt and memoized here so subsequent logins reuse
  // the same client rather than re-discovering every time.
  private getClient(): Promise<Client> {
    if (!this.clientPromise) {
      this.clientPromise = Issuer.discover(this.config.issuerUrl).then(
        (issuer) =>
          new issuer.Client({
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            redirect_uris: [this.config.redirectUri],
            response_types: ['code'],
          }),
      );
    }
    return this.clientPromise;
  }

  async buildAuthorizationUrl(
    origin: LoginOrigin,
    mobileRedirectUri?: string,
  ): Promise<string> {
    const client = await this.getClient();
    const state = generators.state();
    const nonce = generators.nonce();
    this.pendingLogins.set(state, { nonce, origin, mobileRedirectUri });

    return client.authorizationUrl({
      scope: 'openid profile email',
      state,
      nonce,
    });
  }

  async handleCallback(
    redirectUri: string,
    params: Record<string, string>,
  ): Promise<{
    sessionToken: string;
    origin: LoginOrigin;
    mobileRedirectUri?: string;
  }> {
    const pending = params.state
      ? this.pendingLogins.get(params.state)
      : undefined;
    if (!pending) {
      throw new BadRequestException('Unknown or expired login attempt');
    }
    this.pendingLogins.delete(params.state);

    const client = await this.getClient();
    const tokenSet = await client.callback(redirectUri, params, {
      state: params.state,
      nonce: pending.nonce,
    });
    const { sub } = tokenSet.claims();
    // The id_token from a plain `response_type=code` exchange only carries
    // the required OpenID claims (sub, iss, aud, ...); scope-derived profile
    // claims like name/dcit_role are only available from the UserInfo
    // endpoint, so they must be fetched separately rather than read off the
    // id_token's claims.
    const userinfo = (await client.userinfo(tokenSet)) as {
      name?: string;
      dcit_role?: unknown;
    };
    const role = this.resolveRole(userinfo.dcit_role);

    const sessionToken = this.jwt.sign({
      sub,
      role,
      name: userinfo.name,
    });

    return {
      sessionToken,
      origin: pending.origin,
      mobileRedirectUri: pending.mobileRedirectUri,
    };
  }

  private resolveRole(claim: unknown): Role {
    const role =
      typeof claim === 'string' ? CLAIM_TO_ROLE.get(claim) : undefined;
    if (!role) {
      throw new BadRequestException(
        `Unrecognized role claim: ${String(claim)}`,
      );
    }
    return role;
  }
}
