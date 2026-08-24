import { Provider } from 'oidc-provider';

const PORT = process.env.PORT || 9000;
const ISSUER = `http://localhost:${PORT}`;

export const ACCOUNTS = {
  'colaborador-1': {
    sub: 'colaborador-1',
    name: 'Ana Colaboradora',
    email: 'colaborador@dev.local',
    dcit_role: 'colaborador',
  },
  'gestor-1': {
    sub: 'gestor-1',
    name: 'Bruno Gestor',
    email: 'gestor@dev.local',
    dcit_role: 'gestor',
  },
  'rh-1': {
    sub: 'rh-1',
    name: 'Carla RH',
    email: 'rh@dev.local',
    dcit_role: 'rh',
  },
};

export async function findAccount(_ctx, id) {
  const claims = ACCOUNTS[id];
  if (!claims) {
    return undefined;
  }
  return {
    accountId: id,
    async claims() {
      return claims;
    },
  };
}

const configuration = {
  clients: [
    {
      client_id: 'ponto-dcit',
      client_secret: 'dev-secret',
      redirect_uris: ['http://localhost:3000/auth/callback'],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
    },
  ],
  features: {
    devInteractions: { enabled: true },
  },
  claims: {
    openid: ['sub'],
    profile: ['name', 'dcit_role'],
    email: ['email'],
  },
  findAccount,
};

export const provider = new Provider(ISSUER, configuration);

if (import.meta.url === `file://${process.argv[1]}`) {
  provider.listen(PORT, () => {
    console.log(`Mock IdP listening at ${ISSUER}`);
    console.log('Seeded accounts (type the sub on the dev sign-in screen): colaborador-1, gestor-1, rh-1');
  });
}

export { ISSUER };
