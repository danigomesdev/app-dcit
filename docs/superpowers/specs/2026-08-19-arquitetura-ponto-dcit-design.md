# Arquitetura — Ponto DCIT

**Status:** Aprovado para implementação (MVP)
**Spec funcional de referência:** [`docs/spec-funcional.md`](../../spec-funcional.md) (v2)

## 1. Objetivo e escopo

Esta spec define a arquitetura técnica e a estrutura de repositório do Ponto DCIT — pensada para o produto completo (todas as fases da spec funcional), mas com implementação faseada começando pelo MVP (Fase 1: marcação de ponto, espelho/banco de horas, férias/justificativas, upload de documentos sem OCR, mural básico, geração de AFD).

Fora de escopo desta spec: o desenho detalhado de cada tela/fluxo (fica para os planos de implementação de cada fase) e o desenho dos módulos das Fases 2 e 3 (OCR, holerite, plantão/sobreaviso, benefícios) — esses só serão detalhados quando a fase correspondente for iniciada.

## 2. Contexto e decisões de partida

- **Time**: pequeno, ainda não formado, sem stack corporativa pré-definida.
- **Decisão de stack**: TypeScript ponta a ponta (mobile, backend, web), para reduzir o número de linguagens que o time precisa dominar e maximizar o pool de contratação disponível no mercado.
- **Decisão de repositório**: monorepo — favorece consistência entre as três partes do produto e mudanças coordenadas, especialmente relevante para regras de negócio (cálculo de horas, RBAC) que precisam ser idênticas nas pontas.
- **Git hosting**: GitHub.
- **Localização do projeto**: `OneDrive - DCIT Tecnologia\ponto-dcit` (pasta corporativa já sincronizada do usuário).

## 3. Arquitetura geral

```
ponto-dcit/
  apps/
    mobile/        # Expo (React Native) — app do colaborador/gestor
    web/            # Next.js — painel RH/gestor
    api/            # NestJS — backend
  packages/
    shared-types/   # schemas Zod + tipos TS — contrato único de API
  infra/
    docker/          # docker-compose (Postgres) para dev local
  docs/
    spec-funcional.md
    superpowers/specs/
  turbo.json
  pnpm-workspace.yaml
```

Ferramentas de monorepo: **pnpm workspaces** + **Turborepo** para orquestração de build/test/lint entre os três apps e o pacote compartilhado.

## 4. Backend (`apps/api`)

**Estilo**: monólito modular (não microserviços) — não se justifica a complexidade operacional de microserviços para o tamanho de time atual. Módulos do NestJS são organizados por domínio de negócio, não por fase do roadmap, para que os módulos das Fases 2/3 se encaixem depois sem exigir refatoração dos módulos do MVP.

Módulos do MVP:
- `auth` — login corporativo via SSO/Active Directory (OIDC), emissão de sessão (JWT) para mobile e web.
- `time-tracking` — marcação de ponto, espelho de ponto, banco de horas, validação de timestamp assinado, geração de AFD (Portaria 671/2021).
- `leave-requests` — solicitação e aprovação de férias e justificativas de ponto.
- `documents` — upload e repositório de documentos e atestados (sem OCR no MVP; o serviço de OCR entra como integração externa deste módulo na Fase 2, sem mudar seu contrato de dados).
- `approvals` — fluxo de aprovação (gestor/RH) com RBAC granular por campo sensível.
- `notifications` — envio de push notifications (lembretes de marcação, aprovações pendentes).
- `announcements` — mural de avisos.

**Banco de dados**: PostgreSQL. Migrations gerenciadas pelo ORM do NestJS (a escolha entre Prisma e TypeORM fica para o plano de implementação do MVP, não é uma decisão arquitetural que trava a estrutura do repositório).

## 5. Mobile (`apps/mobile`)

**Princípio central**: offline-first desde o MVP, não como exceção. A marcação de ponto nunca pode bloquear (decisão confirmada com o usuário), então o fluxo de marcação não depende de rede disponível no momento do toque.

Fluxo de marcação:
1. Colaborador toca em "Bater Ponto".
2. App grava o registro imediatamente em uma fila local (SQLite, via WatermelonDB ou equivalente), com timestamp assinado localmente no momento do toque.
3. Geolocalização é capturada em paralelo, de forma best-effort — sua ausência ou imprecisão não impede os passos 1-2.
4. Confirmação visual imediata ao colaborador.
5. Um worker de sincronização em background envia os registros pendentes para a API assim que há conectividade.
6. A API valida a assinatura do timestamp e a janela de tolerância contra um relógio confiável (NTP) antes de persistir o registro como oficial. Conflitos (duas marcações para o mesmo evento) são resolvidos priorizando o registro mais antigo; o excedente é sinalizado para revisão do RH, nunca descartado silenciosamente.

Sem verificação biométrica em nenhum ponto do fluxo (decisão confirmada com o usuário).

## 6. Web (`apps/web`)

Next.js, com rotas segregadas por papel. RH acessa todos os dados (incluindo CID/médico/CRM de atestados); gestor acessa apenas o resultado agregado das aprovações e o mapa de presença — nunca dados clínicos, conforme o RBAC granular definido na spec funcional (seção 6).

## 7. `packages/shared-types`

Schemas Zod definem o contrato único de dados (`TimeEntry`, `LeaveRequest`, `User`, papéis de RBAC, etc.), usados tanto para validação no backend quanto para tipagem estática no mobile e no web. Isso evita que a lógica de cálculo de horas extras ou as regras de RBAC divirjam entre as três pontas.

## 8. Testes

- **Unit**: Jest, por módulo do backend.
- **E2E web**: Playwright, cobrindo os fluxos de aprovação e visibilidade por papel (RH vs. gestor).
- **E2E mobile**: Detox (ou equivalente), priorizando o fluxo crítico de marcação online/offline e sincronização — é o fluxo com maior risco técnico e jurídico do produto.

## 9. CI/CD

GitHub Actions executando lint, testes e build a cada push/PR, orquestrado via Turborepo (só roda pipelines dos pacotes afetados pela mudança).

## 10. Riscos técnicos conhecidos (herdados da spec funcional)

- **Timestamp confiável offline**: a integridade da assinatura local é o ponto mais sensível do sistema — se comprometida, o registro perde validade como prova em fiscalização trabalhista. Merece atenção extra de segurança no plano de implementação do MVP.
- **Migração de histórico** dos sistemas atuais (Solides / Meu RH) não está resolvida nesta spec — depende da decisão em aberto na spec funcional (seção 11) sobre substituição total vs. coexistência temporária, e será tratada antes do cutover, não no scaffolding inicial.

## 11. Fora de escopo do MVP (referência para não se perder no scaffolding)

Os seguintes módulos existem na spec funcional mas não têm pasta/código no MVP — serão desenhados quando a fase correspondente for iniciada: OCR de atestados, holerite interativo, mapa de presença ao vivo e alertas preventivos do gestor, onboarding guiado, plantão/sobreaviso/deslocamento, clube de vantagens, matriz de certificações, integrações de folha de pagamento e reembolso.
