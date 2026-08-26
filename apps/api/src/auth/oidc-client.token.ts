export const OIDC_CLIENT_CONFIG = Symbol('OIDC_CLIENT_CONFIG');

// Plain config, not a resolved openid-client `Client` — discovery is a
// network call against the IdP, and doing that during DI/module init would
// make the whole API's boot (including /health) depend on the IdP being
// reachable. AuthService uses this config to discover + build the client
// lazily, on the first real login attempt.
export interface OidcClientConfig {
  issuerUrl: string;
  clientId: string;
  clientSecret: string | undefined;
  redirectUri: string;
}
