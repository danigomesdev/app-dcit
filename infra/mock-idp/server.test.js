import http from 'http';
import { provider, ACCOUNTS, findAccount } from './server.js';

describe('mock IdP', () => {
  let server;
  let baseUrl;

  beforeAll((done) => {
    server = http.createServer(provider.callback());
    server.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('exposes OIDC discovery metadata', async () => {
    const response = await fetch(`${baseUrl}/.well-known/openid-configuration`);
    expect(response.status).toBe(200);

    const metadata = await response.json();
    expect(metadata.authorization_endpoint).toContain('/auth');
    expect(metadata.token_endpoint).toContain('/token');
    expect(metadata.scopes_supported).toEqual(
      expect.arrayContaining(['openid', 'profile', 'email']),
    );
  });

  it('resolves claims for each seeded account', async () => {
    for (const [id, expectedClaims] of Object.entries(ACCOUNTS)) {
      const account = await findAccount(null, id);
      expect(account).toBeDefined();
      expect(account.accountId).toBe(id);
      await expect(account.claims()).resolves.toEqual(expectedClaims);
    }
  });

  it('returns undefined for an unknown account id', async () => {
    const account = await findAccount(null, 'does-not-exist');
    expect(account).toBeUndefined();
  });
});
